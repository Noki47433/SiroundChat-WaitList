import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import AnalyticsTabs from "./AnalyticsTabs.client";
import MatterMetrics from "./MatterMetrics.client";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = {
  "7d": 7,
  "30d": 30,
  "90d": 90
} as const;

type RangeKey = keyof typeof RANGE_OPTIONS;

type DailyPoint = {
  key: string;
  label: string;
  value: number;
};

type FunnelStep = {
  label: string;
  value: number;
  helper: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_STATE = "We will surface insights here once events are recorded.";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

const formatDuration = (ms: number | null) => {
  if (ms === null || Number.isNaN(ms)) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
};

const normalizeQuestion = (value: string | null | undefined) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s?]/g, "")
    .trim();
};

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildDailySeries = (
  items: Array<{ created_at?: string | null; timestamp?: string | null }>,
  rangeStart: Date,
  rangeDays: number,
  timeZone: string,
  field: "created_at" | "timestamp" = "created_at"
): DailyPoint[] => {
  const keyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone });
  const labelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "2-digit"
  });
  const buckets: Record<string, number> = {};

  items.forEach((item) => {
    const stamp = field === "timestamp" ? item.timestamp : item.created_at;
    if (!stamp) return;
    const key = keyFormatter.format(new Date(stamp));
    buckets[key] = (buckets[key] ?? 0) + 1;
  });

  return Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY_MS);
    const key = keyFormatter.format(date);
    return {
      key,
      label: labelFormatter.format(date),
      value: buckets[key] ?? 0
    };
  });
};

const buildSparklinePoints = (values: number[], width: number, height: number) => {
  if (!values.length) return "";
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

const fetchPagedRows = async <TRow,>(
  queryFactory: (from: number, to: number) => Promise<{ data?: TRow[] | null; error?: unknown }>,
  pageSize = 1000,
  maxPages = 100
) => {
  const rows: TRow[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);

    if (error) {
      throw error;
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
};

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const access = await getEntitlementAccess("advanced_analytics");
  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Analytics</p>
          <h2 className="text-3xl font-semibold">Premium analytics</h2>
          <p className="text-sm text-white/60">Conversion funnels, intent trends, and deep insights.</p>
        </div>
        <UpgradeOverlay
          entitlementKey="advanced_analytics"
          title="Upgrade plan to unlock Advanced Analytics"
          description="Detailed analytics dashboards are available on plans with advanced analytics."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="h-28"><div /></Card>
              <Card className="h-28"><div /></Card>
              <Card className="h-28"><div /></Card>
              <Card className="h-28"><div /></Card>
            </div>
            <Card className="h-64"><div /></Card>
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  const rangeParam = (searchParams?.range ?? "7d") as RangeKey;
  const rangeKey: RangeKey = RANGE_OPTIONS[rangeParam] ? rangeParam : "7d";
  const rangeDays = RANGE_OPTIONS[rangeKey];

  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Analytics</p>
        <h2 className="text-3xl font-semibold">Premium analytics</h2>
        <p className="text-sm text-white/60">Log in to review your analytics.</p>
      </div>
    );
  }

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id, business_name, timezone")
    .eq("id", tenant.businessId)
    .maybeSingle();

  const businessName = business?.business_name ?? "Your business";
  const timeZone = business?.timezone ?? "UTC";

  const now = new Date();
  const rangeStart = new Date(now.getTime() - rangeDays * DAY_MS);
  const prevStart = new Date(rangeStart.getTime() - rangeDays * DAY_MS);

  const rangeStartIso = rangeStart.toISOString();
  const rangeEndIso = now.toISOString();
  const prevStartIso = prevStart.toISOString();
  const prevEndIso = rangeStartIso;

  const [
    conversations,
    leads,
    reservations,
    prevConversationsResult,
    prevLeadsResult,
    prevReservationsResult,
    events,
    recentEventsResult,
    messages
  ] = await Promise.all([
    fetchPagedRows(async (from, to) =>
      (supabase as any)
        .from("chat_conversations")
        .select("id, created_at")
        .eq("business_id", tenant.businessId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchPagedRows(async (from, to) =>
      (supabase as any)
        .from("leads")
        .select("id, conversation_id, created_at")
        .eq("business_id", tenant.businessId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchPagedRows(async (from, to) =>
      (supabase as any)
        .from("reservations")
        .select("id, conversation_id, created_at")
        .eq("business_id", tenant.businessId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    (supabase as any)
      .from("chat_conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", tenant.businessId)
      .gte("created_at", prevStartIso)
      .lt("created_at", prevEndIso),
    (supabase as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", tenant.businessId)
      .gte("created_at", prevStartIso)
      .lt("created_at", prevEndIso),
    (supabase as any)
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", tenant.businessId)
      .gte("created_at", prevStartIso)
      .lt("created_at", prevEndIso),
    fetchPagedRows(async (from, to) =>
      (supabase as any)
        .from("analytics_events")
        .select("type, timestamp, metadata")
        .eq("business_id", tenant.businessId)
        .gte("timestamp", rangeStartIso)
        .lt("timestamp", rangeEndIso)
        .order("timestamp", { ascending: false })
        .range(from, to)
    ),
    (supabase as any)
      .from("analytics_events")
      .select("type, timestamp, metadata")
      .eq("business_id", tenant.businessId)
      .order("timestamp", { ascending: false })
      .limit(20),
    fetchPagedRows(async (from, to) =>
      (supabase as any)
        .from("chat_messages")
        .select("conversation_id, sender, message_text, created_at, chat_conversations!inner(business_id)")
        .eq("chat_conversations.business_id", tenant.businessId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true })
        .range(from, to)
    )
  ]);

  const conversationRows = conversations as Array<{ id: string; created_at: string }>;
  const leadRows = leads as Array<{ id: string; conversation_id?: string | null; created_at: string }>;
  const reservationRows = reservations as Array<{
    id: string;
    conversation_id?: string | null;
    created_at: string;
  }>;
  const eventRows = events as Array<{ type?: string; timestamp?: string; metadata?: any }>;
  const recentEvents = (recentEventsResult.data ?? []) as Array<{
    type?: string;
    timestamp?: string;
    metadata?: any;
  }>;
  const messageRows = messages as Array<{
    conversation_id: string;
    sender: string;
    message_text: string | null;
    created_at: string;
  }>;

  const prevConversations = prevConversationsResult.count ?? 0;
  const prevLeads = prevLeadsResult.count ?? 0;
  const prevReservations = prevReservationsResult.count ?? 0;

  const conversationIds = new Set(conversationRows.map((row) => row.id));
  const leadConversationIds = new Set(leadRows.map((row) => row.conversation_id).filter(Boolean) as string[]);
  const reservationConversationIds = new Set(
    reservationRows.map((row) => row.conversation_id).filter(Boolean) as string[]
  );
  const convertedConversationIds = new Set<string>([
    ...Array.from(leadConversationIds),
    ...Array.from(reservationConversationIds)
  ]);

  const eventCounts: Record<string, number> = {};
  eventRows.forEach((row) => {
    const type = row?.type ?? "";
    if (!type) return;
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
  });

  const rawChatOpened = eventCounts.chat_opened ?? 0;
  const rawWidgetOpened = eventCounts.widget_opened ?? 0;
  const chatOpenedCount = rawChatOpened > 0 ? rawChatOpened : rawWidgetOpened;
  const rawFirstMessageCount = eventCounts.first_message_sent ?? 0;
  const fallbackCount = eventCounts.fallback_triggered ?? eventCounts.fallback_occurred ?? 0;

  const userMessageCounts = new Map<string, number>();
  const responseTimes: number[] = [];
  const lastUserMessageAt = new Map<string, Date>();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  const heatmapFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false
  });

  for (const row of messageRows) {
    const timestamp = row.created_at;
    const date = new Date(timestamp);
    const parts = heatmapFormatter.formatToParts(date);
    const weekdayLabel = parts.find((part) => part.type === "weekday")?.value ?? "";
    const hourValue = parts.find((part) => part.type === "hour")?.value ?? "0";
    const dayIdx = weekdayIndex[weekdayLabel] ?? date.getUTCDay();
    const hourIdx = Number(hourValue);
    if (!Number.isNaN(hourIdx) && heatmap[dayIdx]) {
      heatmap[dayIdx][hourIdx] += 1;
    }

    if (row.sender === "user") {
      userMessageCounts.set(row.conversation_id, (userMessageCounts.get(row.conversation_id) ?? 0) + 1);
      lastUserMessageAt.set(row.conversation_id, date);
    } else if (row.sender === "assistant") {
      const lastUser = lastUserMessageAt.get(row.conversation_id);
      if (lastUser) {
        const diff = date.getTime() - lastUser.getTime();
        if (diff >= 0) {
          responseTimes.push(diff);
        }
        lastUserMessageAt.delete(row.conversation_id);
      }
    }
  }

  const meaningfulConversations = Array.from(conversationIds).filter(
    (id) => (userMessageCounts.get(id) ?? 0) >= 3
  ).length;
  const messagedConversationCount = Array.from(conversationIds).filter(
    (id) => (userMessageCounts.get(id) ?? 0) >= 1
  ).length;
  const firstMessageCount = Math.max(rawFirstMessageCount, messagedConversationCount);
  const effectiveChatOpenedCount = Math.max(chatOpenedCount, firstMessageCount);

  const droppedConversationIds = new Set<string>();
  Array.from(conversationIds).forEach((id) => {
    if ((userMessageCounts.get(id) ?? 0) === 1 && !convertedConversationIds.has(id)) {
      droppedConversationIds.add(id);
    }
  });

  const convertedQuestions: Record<string, number> = {};
  const droppedQuestions: Record<string, number> = {};

  messageRows.forEach((row) => {
    if (row.sender !== "user") return;
    const normalized = normalizeQuestion(row.message_text);
    if (!normalized || normalized.length < 4) return;
    if (convertedConversationIds.has(row.conversation_id)) {
      convertedQuestions[normalized] = (convertedQuestions[normalized] ?? 0) + 1;
    } else if (droppedConversationIds.has(row.conversation_id)) {
      droppedQuestions[normalized] = (droppedQuestions[normalized] ?? 0) + 1;
    }
  });

  const sortByCount = (entries: Record<string, number>) =>
    Object.entries(entries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

  const topConvertedQuestions = sortByCount(convertedQuestions);
  const topDroppedQuestions = sortByCount(droppedQuestions);

  const intentStats = new Map<string, { total: number; converted: number }>();
  eventRows
    .filter((row) => row?.type === "intent_detected")
    .forEach((row) => {
      const meta = row?.metadata as any;
      const intent = typeof meta?.intent === "string" ? meta.intent : null;
      if (!intent) return;
      const conversationId = typeof meta?.conversation_id === "string" ? meta.conversation_id : null;
      const current = intentStats.get(intent) ?? { total: 0, converted: 0 };
      current.total += 1;
      if (conversationId && convertedConversationIds.has(conversationId)) {
        current.converted += 1;
      }
      intentStats.set(intent, current);
    });

  const intentRows = Array.from(intentStats.entries())
    .map(([intent, data]) => ({
      intent,
      total: data.total,
      converted: data.converted,
      conversionRate: data.total ? Math.round((data.converted / data.total) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  const responseTimesSorted = responseTimes.slice().sort((a, b) => a - b);
  const avgResponseMs =
    responseTimes.length > 0 ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null;
  const p95ResponseMs =
    responseTimesSorted.length > 0
      ? responseTimesSorted[Math.max(0, Math.ceil(responseTimesSorted.length * 0.95) - 1)]
      : null;

  const responseBuckets = {
    "<1s": 0,
    "1-3s": 0,
    "3-5s": 0,
    "5s+": 0
  };
  responseTimes.forEach((value) => {
    if (value < 1000) responseBuckets["<1s"] += 1;
    else if (value < 3000) responseBuckets["1-3s"] += 1;
    else if (value < 5000) responseBuckets["3-5s"] += 1;
    else responseBuckets["5s+"] += 1;
  });

  const responseBucketMax = Math.max(...Object.values(responseBuckets), 0);

  const totalConversations = conversationRows.length;
  const totalUserMessages = Array.from(conversationIds).reduce(
    (sum, id) => sum + (userMessageCounts.get(id) ?? 0),
    0
  );
  const avgUserMessages = totalConversations > 0 ? totalUserMessages / totalConversations : null;
  const conversionConversations = Array.from(conversationIds).filter((id) => convertedConversationIds.has(id)).length;

  const conversionRate = totalConversations ? conversionConversations / totalConversations : 0;

  const conversationDaily = buildDailySeries(conversationRows, rangeStart, rangeDays, timeZone, "created_at");
  const leadDaily = buildDailySeries(leadRows, rangeStart, rangeDays, timeZone, "created_at");
  const reservationDaily = buildDailySeries(reservationRows, rangeStart, rangeDays, timeZone, "created_at");
  const fallbackDaily = buildDailySeries(
    eventRows.filter((row) => row?.type === "fallback_triggered" || row?.type === "fallback_occurred"),
    rangeStart,
    rangeDays,
    timeZone,
    "timestamp"
  );

  const dailyCounts = conversationDaily.map((point) => ({ dateLabel: point.label, value: point.value }));

  const summaryCards = [
    {
      label: "Conversations",
      value: totalConversations,
      change: prevConversations ? ((totalConversations - prevConversations) / prevConversations) * 100 : null,
      series: conversationDaily.map((point) => point.value)
    },
    {
      label: "Leads",
      value: leadRows.length,
      change: prevLeads ? ((leadRows.length - prevLeads) / prevLeads) * 100 : null,
      series: leadDaily.map((point) => point.value)
    },
    {
      label: "Reservations",
      value: reservationRows.length,
      change: prevReservations ? ((reservationRows.length - prevReservations) / prevReservations) * 100 : null,
      series: reservationDaily.map((point) => point.value)
    },
    {
      label: "Fallbacks",
      value: fallbackCount,
      change: null,
      series: fallbackDaily.map((point) => point.value)
    }
  ];

  const funnelSteps: FunnelStep[] = [
    { label: "Chat opened", value: effectiveChatOpenedCount, helper: "chat_opened" },
    { label: "First message", value: firstMessageCount, helper: "first_message_sent" },
    { label: "Meaningful", value: meaningfulConversations, helper: "3+ user" },
    { label: "Lead", value: leadRows.length, helper: "lead_created" },
    { label: "Reservation", value: reservationRows.length, helper: "reservation_created" }
  ];

  const heatmapMax = Math.max(...heatmap.flat(), 0);
  let peakDay = 0;
  let peakHour = 0;
  let peakCount = 0;
  heatmap.forEach((row, dayIdx) => {
    row.forEach((count, hourIdx) => {
      if (count > peakCount) {
        peakCount = count;
        peakDay = dayIdx;
        peakHour = hourIdx;
      }
    });
  });
  const peakLabel = heatmapMax
    ? `${weekdayLabels[peakDay]} ${String(peakHour).padStart(2, "0")}:00`
    : "-";

  const activityLabel = (type?: string, metadata?: any) => {
    switch (type) {
      case "chat_opened":
        return "Chat opened";
      case "widget_opened":
        return "Widget opened";
      case "first_message_sent":
        return "First message";
      case "conversation_started":
        return "Conversation started";
      case "message_received":
        return "Message received";
      case "lead_created":
        return "Lead created";
      case "contact_intent_detected":
        return "Contact intent";
      case "reservation_started":
        return "Reservation started";
      case "reservation_created":
        return "Reservation created";
      case "reservation_failed":
        return "Reservation failed";
      case "fallback_triggered":
        return "Fallback triggered";
      case "fallback_occurred":
        return "Fallback occurred";
      case "intent_detected":
        return metadata?.intent ? `Intent: ${metadata.intent}` : "Intent detected";
      case "topic_mentioned":
        return metadata?.topic ? `Topic: ${metadata.topic}` : "Topic mentioned";
      case "bot_response_delayed":
        return "Response delayed";
      case "owner_message_sent":
        return "Owner replied";
      default:
        return type ?? "Event";
    }
  };

  const activityTone = (type?: string) => {
    switch (type) {
      case "reservation_created":
      case "lead_created":
        return "bg-emerald-400";
      case "reservation_failed":
        return "bg-rose-400";
      case "fallback_triggered":
      case "fallback_occurred":
        return "bg-amber-400";
      case "owner_message_sent":
        return "bg-indigo-400";
      default:
        return "bg-sky-400";
    }
  };

  const activityLink = (type?: string, metadata?: any) => {
    if (metadata?.conversation_id) {
      return `/dashboard/conversations/${metadata.conversation_id}`;
    }
    if (type?.startsWith("reservation")) {
      return "/dashboard/reservations";
    }
    if (type === "lead_created") {
      return "/dashboard/leads";
    }
    return null;
  };

  const formatActivityTime = (value?: string) => {
    if (!value) return "";
    return new Date(value).toLocaleString("en-US", {
      timeZone,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const conversionPercent = totalConversations ? Math.round(conversionRate * 100) : 0;
  const convertedCount = convertedConversationIds.size;
  const notConvertedCount = Math.max(totalConversations - convertedCount, 0);
  const lastUpdatedLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Analytics</p>
          <h2 className="mt-1 text-2xl font-semibold">Engagement analytics</h2>
          <p className="text-xs text-white/60">
            {businessName} - Last {rangeDays} days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-[11px]">
            {(["7d", "30d", "90d"] as RangeKey[]).map((range) => (
              <Link
                key={range}
                href={`/dashboard/analytics?range=${range}`}
                className={[
                  "rounded-full px-3 py-1 transition",
                  rangeKey === range ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                ].join(" ")}
              >
                {range}
              </Link>
            ))}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
            Live · Updated {lastUpdatedLabel}
          </div>
        </div>
      </div>

      <MatterMetrics initialRange={rangeKey} />

      <div className="grid select-none gap-4 lg:grid-cols-[3fr,1fr] lg:items-start">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Engagement overview</p>
                  <p className="text-xs text-white/60">Daily conversations</p>
                </div>
                <div className="text-[11px] text-white/50">Total: {formatNumber(totalConversations)}</div>
              </div>
              <div className="mt-4">
                <HeroAreaChart series={dailyCounts} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatPill label="Opens" value={formatNumber(effectiveChatOpenedCount)} />
                <StatPill label="Avg response" value={formatDuration(avgResponseMs)} />
                <StatPill label="Conversion" value={`${conversionPercent}%`} />
              </div>
            </Card>

            <Card className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Conversion</p>
                  <p className="text-xs text-white/60">Converted vs not converted</p>
                </div>
                <p className="text-[11px] text-white/50">{convertedCount} / {formatNumber(totalConversations)}</p>
              </div>
              <div className="mt-6 flex items-center justify-center">
                <DonutChart value={convertedCount} total={totalConversations} />
              </div>
              <div className="mt-4 space-y-2 text-xs text-white/70">
                <LegendRow color="bg-emerald-400" label="Converted" value={formatNumber(convertedCount)} />
                <LegendRow color="bg-white/20" label="Not converted" value={formatNumber(notConvertedCount)} />
              </div>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <MiniKpiCard key={card.label} label={card.label} value={card.value} change={card.change} series={card.series} />
            ))}
          </div>

          <AnalyticsTabs
            emptyState={EMPTY_STATE}
            funnelSteps={funnelSteps}
            responseBuckets={Object.entries(responseBuckets).map(([label, value]) => ({ label, value }))}
            responseBucketMax={responseBucketMax}
            avgResponseLabel={formatDuration(avgResponseMs)}
            p95ResponseLabel={formatDuration(p95ResponseMs)}
            intentRows={intentRows}
            topConvertedQuestions={topConvertedQuestions}
            topDroppedQuestions={topDroppedQuestions}
            droppedConversationCount={droppedConversationIds.size}
            fallbackCount={fallbackCount}
            heatmap={heatmap}
            heatmapMax={heatmapMax}
            peakLabel={peakLabel}
          />
        </div>

        <aside className="lg:sticky lg:top-4">
          <Card className="max-h-[calc(100vh-140px)] overflow-auto rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Activity</p>
                <p className="text-xs text-white/60">Recent events</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {recentEvents.length ? (
                recentEvents.map((event, index) => {
                  const meta = event?.metadata ?? {};
                  const label = activityLabel(event.type, meta);
                  const link = activityLink(event.type, meta);
                  return (
                    <div
                      key={`${event.type}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 h-2 w-2 rounded-full ${activityTone(event.type)}`} />
                        <div className="flex-1">
                          <p className="text-sm text-white/80">{label}</p>
                          <p className="text-[11px] text-white/40">{formatActivityTime(event.timestamp)}</p>
                        </div>
                        {link ? (
                          <Link
                            href={link}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/60 transition hover:text-white"
                          >
                            View
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyPanel message={EMPTY_STATE} />
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

type HeroSeriesPoint = { dateLabel: string; value: number };

type HeroAreaChartProps = {
  series: HeroSeriesPoint[];
};

function HeroAreaChart({ series }: HeroAreaChartProps) {
  const values = series.map((point) => point.value);
  const hasData = values.some((value) => value > 0);
  const width = 360;
  const height = 140;
  const points = buildSparklinePoints(values, width, height);
  const areaPath = points ? `M0,${height} L${points} L${width},${height} Z` : "";

  if (!hasData) {
    return <EmptyChart message="Awaiting engagement data" />;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
      <defs>
        <linearGradient id="hero-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#hero-gradient)" />
      <polyline
        points={points}
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type DonutChartProps = {
  value: number;
  total: number;
};

function DonutChart({ value, total }: DonutChartProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = total ? value / total : 0;
  const dash = `${progress * circumference} ${circumference}`;
  const percent = Math.round(progress * 100);

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-full w-full">
        <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="#34D399"
          strokeWidth="12"
          fill="none"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold">{total ? `${percent}%` : "-"}</p>
        <p className="text-[11px] text-white/50">{formatNumber(value)} of {formatNumber(total)}</p>
      </div>
    </div>
  );
}

type MiniKpiCardProps = {
  label: string;
  value: number;
  change: number | null;
  series: number[];
};

function MiniKpiCard({ label, value, change, series }: MiniKpiCardProps) {
  const hasData = series.some((point) => point > 0);
  return (
    <Card className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
        <span className="text-[11px] text-white/60">{formatPercent(change)}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p>
      <div className="mt-3 h-8">
        {hasData ? <Sparkline data={series} /> : <div className="h-full rounded-full bg-white/5" />}
      </div>
    </Card>
  );
}

type SparklineProps = {
  data: number[];
};

function Sparkline({ data }: SparklineProps) {
  const width = 120;
  const height = 32;
  const points = buildSparklinePoints(data, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <polyline
        points={points}
        fill="none"
        stroke="#7DD3FC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LegendRowProps = {
  color: string;
  label: string;
  value: string;
};

function LegendRow({ color, label, value }: LegendRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span>{label}</span>
      </div>
      <span className="text-white/60">{value}</span>
    </div>
  );
}

type StatPillProps = {
  label: string;
  value: string;
};

function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

type EmptyPanelProps = {
  message: string;
};

function EmptyPanel({ message }: EmptyPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
      {message}
    </div>
  );
}

type EmptyChartProps = {
  message: string;
};

function EmptyChart({ message }: EmptyChartProps) {
  return (
    <div className="flex h-44 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs text-white/50">
      {message}
    </div>
  );
}
