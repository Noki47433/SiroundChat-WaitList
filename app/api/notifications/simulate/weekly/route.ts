import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { addDays, getRollingRangeInTimeZone } from "@/lib/utils/timezone";

export const runtime = "nodejs";

const ANALYTICS_TYPES = [
  "message_received",
  "widget_opened",
  "lead_created",
  "reservation_created",
  "contact_intent_detected",
  "topic_mentioned"
] as const;

type WindowMetrics = {
  opens: number;
  messages: number;
  leads: number;
  reservations: number;
  contact_intent: number;
};

type SummaryMetrics = WindowMetrics & {
  top_topic: string | null;
};

const initMetrics = (): WindowMetrics => ({
  opens: 0,
  messages: 0,
  leads: 0,
  reservations: 0,
  contact_intent: 0
});

const formatPercentChange = (current: number, previous: number) => {
  if (previous <= 0) return null;
  const diff = Math.round(((current - previous) / previous) * 100);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}%`;
};

export async function POST() {
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

  const timeZone = typeof business.timezone === "string" && business.timezone ? business.timezone : "UTC";
  const { start, end } = getRollingRangeInTimeZone(timeZone, 7);
  const prevStart = addDays(start, -7);

  const admin = getSupabaseAdminClient();
  const { data: events, error: eventsError } = await (admin as any)
    .from("analytics_events")
    .select("type, timestamp, metadata")
    .eq("business_id", business.id)
    .gte("timestamp", prevStart.toISOString())
    .lte("timestamp", end.toISOString())
    .in("type", ANALYTICS_TYPES);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const { data: submissions, error: submissionsError } = await (admin as any)
    .from("site_form_submissions")
    .select("form_type, created_at")
    .eq("business_id", business.id)
    .eq("form_type", "reservation")
    .gte("created_at", prevStart.toISOString())
    .lte("created_at", end.toISOString());

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const current = initMetrics();
  const previous = initMetrics();
  const topicCounts = new Map<string, number>();

  (events ?? []).forEach((event: { type?: string; timestamp?: string; metadata?: unknown }) => {
    const timestamp = typeof event.timestamp === "string" ? event.timestamp : "";
    if (!timestamp) return;
    const createdAt = new Date(timestamp);
    if (Number.isNaN(createdAt.getTime())) return;

    const inCurrent = createdAt >= start;
    const inPrevious = createdAt >= prevStart && createdAt < start;
    if (!inCurrent && !inPrevious) return;

    const bucket = inCurrent ? current : previous;
    switch (event.type) {
      case "message_received":
        bucket.messages += 1;
        break;
      case "widget_opened":
        bucket.opens += 1;
        break;
      case "lead_created":
        bucket.leads += 1;
        break;
      case "reservation_created":
        bucket.reservations += 1;
        break;
      case "contact_intent_detected":
        bucket.contact_intent += 1;
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

  (submissions ?? []).forEach((row: { created_at?: string | null }) => {
    const timestamp = typeof row.created_at === "string" ? row.created_at : "";
    if (!timestamp) return;
    const createdAt = new Date(timestamp);
    if (Number.isNaN(createdAt.getTime())) return;
    if (createdAt >= start) {
      current.reservations += 1;
    } else if (createdAt >= prevStart && createdAt < start) {
      previous.reservations += 1;
    }
  });

  let topTopic: string | null = null;
  let topTopicCount = 0;
  for (const [topic, count] of topicCounts.entries()) {
    if (count > topTopicCount) {
      topTopicCount = count;
      topTopic = topic;
    }
  }

  const metrics: SummaryMetrics = {
    ...current,
    top_topic: topTopic
  };

  const totalCurrent =
    current.opens +
    current.messages +
    current.leads +
    current.reservations +
    current.contact_intent;

  const totalPrevious =
    previous.opens +
    previous.messages +
    previous.leads +
    previous.reservations +
    previous.contact_intent;

  const opensChange = formatPercentChange(current.opens, previous.opens);
  const leadsChange = formatPercentChange(current.leads, previous.leads);
  const trendParts = [
    opensChange ? `opens ${opensChange}` : null,
    leadsChange ? `leads ${leadsChange}` : null
  ].filter(Boolean);

  let trendLine = "";
  if (totalPrevious > 0 && trendParts.length) {
    trendLine = `vs previous week: ${trendParts.join(", ")}.`;
  } else if (totalPrevious === 0 && totalCurrent > 0) {
    trendLine = "New activity started this week.";
  }

  const topTopicLabel = topTopic ?? "-";

  const body =
    totalCurrent === 0
      ? "Not enough activity yet this week. Once visitors chat, you'll see opens, messages, leads, and reservations here."
      : `In the last 7 days: ${current.opens} opens, ${current.messages} messages, ${current.leads} leads, ${current.reservations} reservations. Top topic: ${topTopicLabel}.${trendLine ? ` ${trendLine}` : ""}`;

  const severity = current.leads + current.reservations >= 1 ? "success" : "info";

  const dateKey = new Date().toISOString().slice(0, 10);
  const sourceId = `simulate_weekly_${business.id}_${dateKey}`;

  const inserted = await createNotificationIfNotExists(
    business.id,
    {
      title: "Your weekly SiroundChat summary",
      body,
      severity,
      category: "insight",
      cta_label: "View analytics",
      cta_url: "/dashboard/analytics",
      data: {
        window: "7d",
        opens: current.opens,
        messages: current.messages,
        leads: current.leads,
        reservations: current.reservations,
        contact_intent: current.contact_intent,
        top_topic: topTopic,
        prev_opens: previous.opens,
        prev_messages: previous.messages,
        prev_leads: previous.leads,
        prev_reservations: previous.reservations,
        prev_contact_intent: previous.contact_intent,
        window_start: start.toISOString(),
        window_end: end.toISOString(),
        prev_start: prevStart.toISOString(),
        prev_end: start.toISOString()
      }
    },
    "simulate_weekly_summary",
    sourceId
  );

  return NextResponse.json({ ok: true, notificationId: inserted?.id ?? null, metrics });
}

// Manual test:
// 1) Go /dashboard/settings in dev
// 2) Click weekly -> verify notification row appears and UI renders
// 3) Click monthly -> verify
