import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { addDays, getRollingRangeInTimeZone } from "@/lib/utils/timezone";

export const runtime = "nodejs";

type Period = "weekly" | "monthly";

type Highlight = {
  key: string;
  title: string;
  value: string;
  subtext?: string;
  emoji?: string;
  tone: "success" | "info" | "warning";
  cta?: { label: string; href: string };
};

type MetricsSnapshot = {
  opens: number;
  conversations_started: number;
  messages: number;
  leads: number;
  reservations: number;
  contact_intent: number;
  helped_conversations: number;
  time_saved_minutes: number;
  revenue_estimated: number;
};

const PERIOD_DAYS: Record<Period, number> = {
  weekly: 7,
  monthly: 30
};

const ANALYTICS_TYPES = [
  "widget_opened",
  "conversation_started",
  "message_received",
  "lead_created",
  "reservation_created",
  "contact_intent_detected",
  "topic_mentioned"
] as const;

const THANKS_PHRASES = ["thanks", "thank you", "appreciate", "got it", "sounds good", "perfect", "great", "awesome"];
const RESOLVED_PHRASES = ["glad i could help", "happy to help", "let me know if you need anything else", "all set", "resolved"];

const initCounts = () => ({
  opens: 0,
  conversations: 0,
  messages: 0,
  leads: 0,
  reservations: 0,
  contactIntent: 0
});

const formatPercentChange = (current: number, previous: number) => {
  if (previous <= 0) return null;
  const diff = Math.round(((current - previous) / previous) * 100);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}%`;
};

const formatCurrency = (amount: number, currency: string) => {
  const rounded = Math.round(amount * 100) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(rounded);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(rounded);
  }
};

const parseText = (value: string | null | undefined) => value?.toLowerCase() ?? "";

const hasPhrase = (text: string, phrases: string[]) =>
  phrases.some((phrase) => text.includes(phrase));

type ConversationRow = {
  id: string;
  takeover_enabled: boolean | null;
  takeover_by: string | null;
  takeover_ended_at: string | null;
};

const isHumanTakeover = (row: ConversationRow) =>
  Boolean(row.takeover_enabled || row.takeover_by || row.takeover_ended_at);

const computeHelpedConversations = async (
  admin: ReturnType<typeof getSupabaseAdminClient>,
  conversationRows: ConversationRow[],
  startIso: string,
  endIso: string
) => {
  const conversationIds = conversationRows.map((row) => row.id);
  if (!conversationIds.length) {
    return { helped: 0, total: 0 };
  }

  const { data: leadRows } = await (admin as any)
    .from("leads")
    .select("conversation_id")
    .in("conversation_id", conversationIds);

  const { data: reservationRows } = await (admin as any)
    .from("reservations")
    .select("conversation_id")
    .in("conversation_id", conversationIds);

  const leadConversations = new Set(
    (leadRows ?? [])
      .map((row: { conversation_id?: string | null }) => row.conversation_id ?? "")
      .filter(Boolean)
  );
  const reservationConversations = new Set(
    (reservationRows ?? [])
      .map((row: { conversation_id?: string | null }) => row.conversation_id ?? "")
      .filter(Boolean)
  );

  const { data: messages } = await (admin as any)
    .from("chat_messages")
    .select("conversation_id, sender, message_text, created_at")
    .in("conversation_id", conversationIds)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });

  const assistantCounts = new Map<string, number>();
  const lastMessages = new Map<
    string,
    { sender: string; text: string }
  >();

  (messages ?? []).forEach((message: { conversation_id?: string; sender?: string; message_text?: string }) => {
    const conversationId = message.conversation_id ?? "";
    if (!conversationId) return;

    const sender = message.sender ?? "";
    const text = message.message_text ?? "";

    if (sender === "assistant" || sender === "ai") {
      assistantCounts.set(conversationId, (assistantCounts.get(conversationId) ?? 0) + 1);
    }

    lastMessages.set(conversationId, { sender, text });
  });

  let helped = 0;

  conversationRows.forEach((row) => {
    if (isHumanTakeover(row)) return;
    if (leadConversations.has(row.id) || reservationConversations.has(row.id)) return;

    const assistantCount = assistantCounts.get(row.id) ?? 0;
    if (assistantCount < 3) return;

    const lastMessage = lastMessages.get(row.id);
    if (!lastMessage) return;

    const text = parseText(lastMessage.text);
    if (!text) return;

    const resolved =
      lastMessage.sender === "user"
        ? hasPhrase(text, THANKS_PHRASES)
        : hasPhrase(text, RESOLVED_PHRASES);

    if (resolved) {
      helped += 1;
    }
  });

  return { helped, total: conversationIds.length };
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const period = body?.period as Period | undefined;
  const force = Boolean(body?.force);

  if (period !== "weekly" && period !== "monthly") {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: business, error: businessError } = await (supabase as any)
    .from("businesses")
    .select("id, timezone")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  if (!business?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = PERIOD_DAYS[period];
  const timeZone = typeof business.timezone === "string" && business.timezone ? business.timezone : "UTC";
  const { start, end } = getRollingRangeInTimeZone(timeZone, days);
  const prevStart = addDays(start, -days);

  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStartIso = prevStart.toISOString();

  const admin = getSupabaseAdminClient();

  const { data: existing } = await (admin as any)
    .from("business_impact_summaries")
    .select("*")
    .eq("business_id", business.id)
    .eq("period", period)
    .eq("period_start", startIso)
    .maybeSingle();

  if (existing && !force) {
    return NextResponse.json({
      ok: true,
      summaryId: existing.id,
      period: existing.period,
      period_start: existing.period_start,
      period_end: existing.period_end,
      metrics: existing.metrics ?? {},
      highlights: existing.highlights ?? []
    });
  }

  const { data: events, error: eventsError } = await (admin as any)
    .from("analytics_events")
    .select("type, timestamp, metadata")
    .eq("business_id", business.id)
    .gte("timestamp", prevStartIso)
    .lte("timestamp", endIso)
    .in("type", ANALYTICS_TYPES);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const currentCounts = initCounts();
  const previousCounts = initCounts();
  const topicCounts = new Map<string, number>();

  (events ?? []).forEach((event: { type?: string; timestamp?: string; metadata?: unknown }) => {
    const timestamp = typeof event.timestamp === "string" ? event.timestamp : "";
    if (!timestamp) return;
    const createdAt = new Date(timestamp);
    if (Number.isNaN(createdAt.getTime())) return;

    const inCurrent = createdAt >= start;
    const inPrevious = createdAt >= prevStart && createdAt < start;
    if (!inCurrent && !inPrevious) return;

    const bucket = inCurrent ? currentCounts : previousCounts;
    switch (event.type) {
      case "widget_opened":
        bucket.opens += 1;
        break;
      case "conversation_started":
        bucket.conversations += 1;
        break;
      case "message_received":
        bucket.messages += 1;
        break;
      case "lead_created":
        bucket.leads += 1;
        break;
      case "reservation_created":
        bucket.reservations += 1;
        break;
      case "contact_intent_detected":
        bucket.contactIntent += 1;
        break;
      case "topic_mentioned": {
        if (!inCurrent) break;
        const meta = event.metadata as { topic?: unknown } | null;
        const topic = meta?.topic;
        if (typeof topic !== "string") break;
        const cleaned = topic.trim();
        if (!cleaned) break;
        topicCounts.set(cleaned, (topicCounts.get(cleaned) ?? 0) + 1);
        break;
      }
      default:
        break;
    }
  });

  const { data: currentConversations } = await (admin as any)
    .from("chat_conversations")
    .select("id, takeover_enabled, takeover_by, takeover_ended_at, created_at")
    .eq("business_id", business.id)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  const { data: previousConversations } = await (admin as any)
    .from("chat_conversations")
    .select("id, takeover_enabled, takeover_by, takeover_ended_at, created_at")
    .eq("business_id", business.id)
    .gte("created_at", prevStartIso)
    .lt("created_at", startIso);

  let conversationsCurrent = currentCounts.conversations;
  let conversationsPrev = previousCounts.conversations;

  if (conversationsCurrent === 0 && conversationsPrev === 0) {
    conversationsCurrent = currentConversations?.length ?? 0;
    conversationsPrev = previousConversations?.length ?? 0;
  }

  let messagesCurrent = currentCounts.messages;
  let messagesPrev = previousCounts.messages;

  if (messagesCurrent === 0 && messagesPrev === 0) {
    const currentIds = (currentConversations ?? []).map((row: { id: string }) => row.id);
    const prevIds = (previousConversations ?? []).map((row: { id: string }) => row.id);

    if (currentIds.length) {
      const { count } = await (admin as any)
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", currentIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      messagesCurrent = count ?? 0;
    }

    if (prevIds.length) {
      const { count } = await (admin as any)
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", prevIds)
        .gte("created_at", prevStartIso)
        .lt("created_at", startIso);
      messagesPrev = count ?? 0;
    }
  }

  let leadsCurrent = currentCounts.leads;
  let leadsPrev = previousCounts.leads;

  if (leadsCurrent === 0 && leadsPrev === 0) {
    const { count: currentCount } = await (admin as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    const { count: prevCount } = await (admin as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", prevStartIso)
      .lt("created_at", startIso);
    leadsCurrent = currentCount ?? 0;
    leadsPrev = prevCount ?? 0;
  }

  let reservationsCurrent = currentCounts.reservations;
  let reservationsPrev = previousCounts.reservations;

  if (reservationsCurrent === 0 && reservationsPrev === 0) {
    const { count: currentReservations } = await (admin as any)
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    const { count: prevReservations } = await (admin as any)
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", prevStartIso)
      .lt("created_at", startIso);

    const { count: currentSubmissions } = await (admin as any)
      .from("site_form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("form_type", "reservation")
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    const { count: prevSubmissions } = await (admin as any)
      .from("site_form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("form_type", "reservation")
      .gte("created_at", prevStartIso)
      .lt("created_at", startIso);

    reservationsCurrent = (currentReservations ?? 0) + (currentSubmissions ?? 0);
    reservationsPrev = (prevReservations ?? 0) + (prevSubmissions ?? 0);
  }

  const { helped: helpedCurrent } = await computeHelpedConversations(
    admin,
    (currentConversations ?? []) as ConversationRow[],
    startIso,
    endIso
  );

  const { helped: helpedPrev } = await computeHelpedConversations(
    admin,
    (previousConversations ?? []) as ConversationRow[],
    prevStartIso,
    startIso
  );

  const { data: valueSettings } = await (admin as any)
    .from("business_value_settings")
    .select("avg_order_value, reservation_value, lead_value, close_rate, currency")
    .eq("business_id", business.id)
    .maybeSingle();

  const closeRate = Number(valueSettings?.close_rate ?? 0.15);
  const leadValue = Number(valueSettings?.lead_value ?? 15);
  const baseReservationValue = Number(valueSettings?.reservation_value ?? 25);
  const avgOrderValue = valueSettings?.avg_order_value !== null && valueSettings?.avg_order_value !== undefined
    ? Number(valueSettings.avg_order_value)
    : null;
  const reservationValue = avgOrderValue ?? baseReservationValue;
  const currency = typeof valueSettings?.currency === "string" && valueSettings.currency
    ? valueSettings.currency
    : "EUR";

  const revenueCurrent = leadsCurrent * closeRate * leadValue + reservationsCurrent * reservationValue;
  const revenuePrev = leadsPrev * closeRate * leadValue + reservationsPrev * reservationValue;

  const metrics: MetricsSnapshot = {
    opens: currentCounts.opens,
    conversations_started: conversationsCurrent,
    messages: messagesCurrent,
    leads: leadsCurrent,
    reservations: reservationsCurrent,
    contact_intent: currentCounts.contactIntent,
    helped_conversations: helpedCurrent,
    time_saved_minutes: helpedCurrent * 4,
    revenue_estimated: revenueCurrent
  };

  const opensDelta = formatPercentChange(currentCounts.opens, previousCounts.opens);
  const leadsDelta = formatPercentChange(leadsCurrent, leadsPrev);
  const reservationsDelta = formatPercentChange(reservationsCurrent, reservationsPrev);
  const helpedDelta = formatPercentChange(helpedCurrent, helpedPrev);
  const revenueDelta = formatPercentChange(revenueCurrent, revenuePrev);

  let topTopic: string | null = null;
  let topTopicCount = 0;
  for (const [topic, count] of topicCounts.entries()) {
    if (count > topTopicCount) {
      topTopicCount = count;
      topTopic = topic;
    }
  }

  const totalCurrent =
    metrics.opens +
    metrics.messages +
    metrics.leads +
    metrics.reservations +
    metrics.contact_intent;

  const totalPrevious =
    previousCounts.opens +
    messagesPrev +
    leadsPrev +
    reservationsPrev +
    previousCounts.contactIntent;

  const trendParts = [
    opensDelta ? `opens ${opensDelta}` : null,
    leadsDelta ? `leads ${leadsDelta}` : null
  ].filter(Boolean);

  let trendText = "";
  if (totalPrevious > 0 && trendParts.length) {
    trendText = `vs previous period: ${trendParts.join(", ")}.`;
  } else if (totalPrevious === 0 && totalCurrent > 0) {
    trendText = "New activity started this period.";
  } else if (totalCurrent === 0) {
    trendText = "Not enough activity yet.";
  }

  const revenueReady = leadsCurrent + reservationsCurrent > 0;
  const helpedReady = helpedCurrent > 0;
  const timeSavedMinutes = helpedCurrent * 4;
  const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

  const highlights: Highlight[] = [
    {
      key: "revenue",
      title: "Estimated revenue influenced",
      value: revenueReady ? formatCurrency(revenueCurrent, currency) : "Not enough data yet",
      subtext: revenueReady
        ? "Based on your lead + reservation values"
        : "Capture a lead or reservation to estimate revenue.",
      tone: revenueReady ? "success" : "info"
    },
    {
      key: "helped",
      title: "Customers helped",
      value: helpedReady ? String(helpedCurrent) : "Not enough data yet",
      subtext: helpedReady
        ? "Conversations resolved without human takeover"
        : "We need resolved chat conversations to compute this.",
      tone: helpedReady ? "success" : "info"
    },
    {
      key: "time_saved",
      title: "Time saved",
      value: helpedReady ? `${timeSavedMinutes}m` : "Not enough data yet",
      subtext: helpedReady ? `That's about ${timeSavedHours} hours.` : "Each resolved chat saves about 4 minutes.",
      tone: helpedReady ? "success" : "info"
    },
    {
      key: "lead_reservation",
      title: "Leads + reservations captured",
      value: `${leadsCurrent} leads • ${reservationsCurrent} reservations`,
      subtext: trendText || " ",
      tone: leadsCurrent + reservationsCurrent > 0 ? "success" : "info"
    },
    {
      key: "fun_fact",
      title: "Fun fact",
      value: (() => {
        if (timeSavedMinutes >= 60) {
          return `You saved ~${timeSavedHours} hours — basically a full Netflix movie.`;
        }
        if (revenueCurrent >= 100) {
          return "That's a full dinner rush worth of value.";
        }
        if (helpedCurrent >= 10) {
          return "That's like a whole day of customers handled automatically.";
        }
        return "Not enough data yet";
      })(),
      subtext:
        timeSavedMinutes >= 60 || revenueCurrent >= 100 || helpedCurrent >= 10
          ? undefined
          : "More activity unlocks fun comparisons.",
      tone: totalCurrent > 0 ? "success" : "info"
    }
  ];

  const payload = {
    business_id: business.id,
    period,
    period_start: startIso,
    period_end: endIso,
    metrics: {
      ...metrics,
      prev_opens: previousCounts.opens,
      prev_conversations_started: conversationsPrev,
      prev_messages: messagesPrev,
      prev_leads: leadsPrev,
      prev_reservations: reservationsPrev,
      prev_contact_intent: previousCounts.contactIntent,
      prev_helped_conversations: helpedPrev,
      prev_time_saved_minutes: helpedPrev * 4,
      prev_revenue_estimated: revenuePrev,
      opens_delta_pct: opensDelta,
      leads_delta_pct: leadsDelta,
      reservations_delta_pct: reservationsDelta,
      helped_delta_pct: helpedDelta,
      revenue_delta_pct: revenueDelta,
      currency,
      close_rate: closeRate,
      lead_value: leadValue,
      reservation_value: reservationValue,
      avg_order_value: avgOrderValue,
      top_topic: topTopic
    },
    highlights
  };

  const { data: inserted, error: insertError } = force
    ? await (admin as any)
        .from("business_impact_summaries")
        .upsert(payload, { onConflict: "business_id,period,period_start" })
        .select("*")
        .maybeSingle()
    : await (admin as any)
        .from("business_impact_summaries")
        .insert(payload)
        .select("*")
        .maybeSingle();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    summaryId: inserted?.id ?? null,
    period,
    period_start: startIso,
    period_end: endIso,
    metrics: payload.metrics,
    highlights
  });
}
