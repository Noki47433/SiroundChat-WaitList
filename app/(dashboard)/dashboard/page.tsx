import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import dynamicImport from "next/dynamic";
import { OverviewHeader } from "@/components/dashboard/OverviewHeader";
import { RecentTable } from "@/components/dashboard/RecentTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ImpactSummaryGate } from "@/app/(dashboard)/dashboard/_components/ImpactSummaryGate";
import { SummaryBootstrapTrigger } from "@/app/(dashboard)/dashboard/_components/SummaryBootstrapTrigger";
import { buildHealthSuggestions } from "@/lib/health/weekly";
import { logActivity } from "@/lib/activity/log";

const KpiCard = dynamicImport(() => import("@/components/dashboard/KpiCard").then((mod) => mod.KpiCard), { ssr: false });
const ConversationsTrend = dynamicImport(
  () => import("@/components/dashboard/Charts/ConversationsTrend").then((mod) => mod.ConversationsTrend),
  { ssr: false }
);
const ConversionDonut = dynamicImport(
  () => import("@/components/dashboard/Charts/ConversionDonut").then((mod) => mod.ConversionDonut),
  { ssr: false }
);

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = {
  "7d": 7,
  "30d": 30,
  "90d": 90
} as const;

type RangeKey = keyof typeof RANGE_OPTIONS;

type DailyPoint = {
  label: string;
  value: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

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
      label: labelFormatter.format(date),
      value: buckets[key] ?? 0
    };
  });
};

const computeDelta = (current: number, previous: number) => {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
};

const formatSummaryRange = (start: string, end: string, timeZone: string) => {
  try {
    const startLabel = new Date(start).toLocaleDateString("en-US", {
      timeZone,
      month: "short",
      day: "numeric"
    });
    const endLabel = new Date(end).toLocaleDateString("en-US", {
      timeZone,
      month: "short",
      day: "numeric"
    });
    return `${startLabel} - ${endLabel}`;
  } catch {
    return "";
  }
};

const activityTone = (type?: string): "success" | "danger" | "warning" | "info" => {
  switch (type) {
    case "reservation_created":
    case "lead_created":
      return "success";
    case "reservation_failed":
      return "danger";
    case "fallback_triggered":
    case "fallback_occurred":
      return "warning";
    default:
      return "info";
  }
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

export default async function DashboardOverviewPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rangeParam = (searchParams?.range ?? "30d") as RangeKey;
  const rangeKey: RangeKey = RANGE_OPTIONS[rangeParam] ? rangeParam : "30d";
  const rangeDays = RANGE_OPTIONS[rangeKey];

  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Overview</p>
        <h2 className="text-3xl font-semibold">Welcome back</h2>
        <p className="text-sm text-white/60">Log in to review your dashboard activity.</p>
      </div>
    );
  }

  await logActivity({
    businessId: tenant.businessId,
    userId: tenant.userId,
    actorType: "business_user",
    eventType: "dashboard_view",
    summary: "Opened dashboard overview",
    meta: { range: rangeKey }
  });

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id, business_name, timezone, industry, created_at, onboarding_completed_at")
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

  const [
    conversations,
    currentConversationCountResult,
    previousConversationCountResult,
    leads,
    reservations,
    events,
    recentEventsResult,
    messages,
    weeklyMetricsResult,
    impactSummariesResult
  ] =
    await Promise.all([
      fetchPagedRows(async (from, to) =>
        (supabase as any)
          .from("chat_conversations")
          .select("id, user_name, is_lead, created_at")
          .eq("business_id", tenant.businessId)
          .gte("created_at", prevStartIso)
          .lt("created_at", rangeEndIso)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      (supabase as any)
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", tenant.businessId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso),
      (supabase as any)
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", tenant.businessId)
        .gte("created_at", prevStartIso)
        .lt("created_at", rangeStartIso),
      fetchPagedRows(async (from, to) =>
        (supabase as any)
          .from("leads")
          .select("id, conversation_id, name, email, created_at")
          .eq("business_id", tenant.businessId)
          .gte("created_at", prevStartIso)
          .lt("created_at", rangeEndIso)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      fetchPagedRows(async (from, to) =>
        (supabase as any)
          .from("reservations")
          .select("id, conversation_id, customer_name, status, created_at")
          .eq("business_id", tenant.businessId)
          .gte("created_at", prevStartIso)
          .lt("created_at", rangeEndIso)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
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
          .select("conversation_id, sender, created_at, chat_conversations!inner(business_id)")
          .eq("chat_conversations.business_id", tenant.businessId)
          .gte("created_at", rangeStartIso)
          .lt("created_at", rangeEndIso)
          .order("created_at", { ascending: true })
          .range(from, to)
      ),
      (supabase as any)
        .from("business_weekly_metrics")
        .select("*")
        .eq("business_id", tenant.businessId)
        .order("week_start", { ascending: false })
        .limit(2),
      (supabase as any)
        .from("business_impact_summaries")
        .select("id,period,period_start,period_end,highlights,created_at")
        .eq("business_id", tenant.businessId)
        .in("period", ["weekly", "monthly"])
        .order("period_start", { ascending: false })
        .limit(10)
    ]);

  const conversationRows = conversations as Array<{
    id: string;
    user_name?: string | null;
    is_lead?: boolean | null;
    created_at: string;
  }>;
  const leadRows = leads as Array<{
    id: string;
    conversation_id?: string | null;
    name?: string | null;
    email?: string | null;
    created_at: string;
  }>;
  const reservationRows = reservations as Array<{
    id: string;
    conversation_id?: string | null;
    customer_name?: string | null;
    status?: string | null;
    created_at: string;
  }>;
  const eventRows = events as Array<{ type?: string; timestamp?: string; metadata?: any }>;
  const recentEvents = (recentEventsResult.data ?? []) as Array<{
    type?: string;
    timestamp?: string;
    metadata?: any;
  }>;
  const currentConversationCount = currentConversationCountResult.count ?? 0;
  const previousConversationCount = previousConversationCountResult.count ?? 0;
  const messageRows = messages as Array<{
    conversation_id: string;
    sender: string;
    created_at: string;
  }>;
  const weeklyMetrics = (weeklyMetricsResult.data ?? []) as Array<{
    week_start: string;
    conversations_count: number;
    leads_count: number;
    bookings_count: number;
    missed_intents_count: number;
    avg_response_time_sec: number;
    error_events_count: number;
    health_score: number;
  }>;
  const impactSummaries = (impactSummariesResult.data ?? []) as Array<{
    id: string;
    period: "weekly" | "monthly";
    period_start: string;
    period_end: string;
    highlights?: Array<{ title?: string; value?: string; subtext?: string }> | null;
    created_at?: string | null;
  }>;

  const latestWeeklySummary = impactSummaries.find((summary) => summary.period === "weekly") ?? null;
  const latestMonthlySummary = impactSummaries.find((summary) => summary.period === "monthly") ?? null;
  const businessCreatedAt =
    business?.created_at && !Number.isNaN(new Date(business.created_at).getTime())
      ? new Date(business.created_at)
      : null;
  const businessAgeMs = businessCreatedAt ? now.getTime() - businessCreatedAt.getTime() : Number.POSITIVE_INFINITY;
  const weeklyEligible = businessAgeMs >= 7 * DAY_MS;
  const monthlyEligible = businessAgeMs >= 30 * DAY_MS;
  const eligibleImpactPeriods: Array<"weekly" | "monthly"> = [
    ...(monthlyEligible ? (["monthly"] as const) : []),
    ...(weeklyEligible ? (["weekly"] as const) : [])
  ];
  const missingImpactPeriods: Array<"weekly" | "monthly"> = [];
  if (weeklyEligible && !latestWeeklySummary) missingImpactPeriods.push("weekly");
  if (monthlyEligible && !latestMonthlySummary) missingImpactPeriods.push("monthly");

  const currentWeeklyMetric = weeklyMetrics[0] ?? null;
  const previousWeeklyMetric = weeklyMetrics[1] ?? null;

  const { data: benchmarkRowsRaw } = currentWeeklyMetric
    ? await (supabase as any)
        .from("industry_benchmarks_weekly")
        .select("*")
        .eq("week_start", currentWeeklyMetric.week_start)
        .in("industry", [business?.industry ?? "general", "general"])
    : { data: [] as any[] };
  const benchmarkRows = (benchmarkRowsRaw ?? []) as Array<{
    industry: string;
    conversion_p50: number;
    bookings_p50: number;
    health_p50: number;
  }>;
  const benchmarkByIndustry = new Map<string, (typeof benchmarkRows)[number]>(
    benchmarkRows.map((row) => [row.industry, row])
  );
  const selectedBenchmark =
    benchmarkByIndustry.get((business?.industry ?? "general").trim() || "general") ??
    benchmarkByIndustry.get("general") ??
    null;

  const currentConversations = conversationRows.filter((row) => row.created_at >= rangeStartIso);
  const currentLeads = leadRows.filter((row) => row.created_at >= rangeStartIso);
  const previousLeads = leadRows.filter((row) => row.created_at >= prevStartIso && row.created_at < rangeStartIso);
  const currentReservations = reservationRows.filter((row) => row.created_at >= rangeStartIso);
  const previousReservations = reservationRows.filter(
    (row) => row.created_at >= prevStartIso && row.created_at < rangeStartIso
  );

  const conversationIds = new Set(currentConversations.map((row) => row.id));
  const leadConversationIds = new Set(currentLeads.map((row) => row.conversation_id).filter(Boolean) as string[]);
  const reservationConversationIds = new Set(
    currentReservations.map((row) => row.conversation_id).filter(Boolean) as string[]
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
  const fallbackCount = eventCounts.fallback_triggered ?? eventCounts.fallback_occurred ?? 0;

  const userMessageCounts = new Map<string, number>();
  const responseTimes: number[] = [];
  const lastUserMessageAt = new Map<string, Date>();

  for (const row of messageRows) {
    const date = new Date(row.created_at);
    if (row.sender === "user") {
      userMessageCounts.set(row.conversation_id, (userMessageCounts.get(row.conversation_id) ?? 0) + 1);
      lastUserMessageAt.set(row.conversation_id, date);
    } else if (row.sender === "assistant") {
      const lastUser = lastUserMessageAt.get(row.conversation_id);
      if (lastUser) {
        const diff = date.getTime() - lastUser.getTime();
        if (diff >= 0) responseTimes.push(diff);
        lastUserMessageAt.delete(row.conversation_id);
      }
    }
  }

  const meaningfulConversations = Array.from(conversationIds).filter(
    (id) => (userMessageCounts.get(id) ?? 0) >= 3
  ).length;
  const messagedConversationsCount = Array.from(conversationIds).filter(
    (id) => (userMessageCounts.get(id) ?? 0) >= 1
  ).length;

  const responseTimesSorted = responseTimes.slice().sort((a, b) => a - b);
  const avgResponseMs =
    responseTimes.length > 0 ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null;
  const p95ResponseMs =
    responseTimesSorted.length > 0
      ? responseTimesSorted[Math.max(0, Math.ceil(responseTimesSorted.length * 0.95) - 1)]
      : null;

  const dailyConversations = buildDailySeries(currentConversations, rangeStart, rangeDays, timeZone, "created_at");
  const dailyLeads = buildDailySeries(currentLeads, rangeStart, rangeDays, timeZone, "created_at");
  const dailyReservations = buildDailySeries(currentReservations, rangeStart, rangeDays, timeZone, "created_at");
  const dailyFallbacks = buildDailySeries(
    eventRows.filter((row) => row?.type === "fallback_triggered" || row?.type === "fallback_occurred"),
    rangeStart,
    rangeDays,
    timeZone,
    "timestamp"
  );

  const avgResponseSeconds = avgResponseMs ? Math.round(avgResponseMs / 1000) : 0;
  const responseSeries = Array.from({ length: rangeDays }, () => avgResponseSeconds);

  const kpiCards = [
    {
      label: "Conversations",
      value: currentConversationCount,
      delta: computeDelta(currentConversationCount, previousConversationCount),
      series: dailyConversations.map((point) => point.value),
      icon: "conversations" as const
    },
    {
      label: "Leads",
      value: currentLeads.length,
      delta: computeDelta(currentLeads.length, previousLeads.length),
      series: dailyLeads.map((point) => point.value),
      icon: "leads" as const
    },
    {
      label: "Reservations",
      value: currentReservations.length,
      delta: computeDelta(currentReservations.length, previousReservations.length),
      series: dailyReservations.map((point) => point.value),
      icon: "reservations" as const
    },
    {
      label: "Avg response (s)",
      value: avgResponseSeconds,
      delta: null,
      series: responseSeries,
      icon: "response" as const
    }
  ];

  const openedBase = Math.max(currentConversationCount, chatOpenedCount, messagedConversationsCount);
  const convertedCount = convertedConversationIds.size;
  const openedNotMessaged = Math.max(openedBase - messagedConversationsCount, 0);
  const messagedNotMeaningful = Math.max(messagedConversationsCount - meaningfulConversations, 0);
  const meaningfulNotConverted = Math.max(meaningfulConversations - convertedCount, 0);

  const conversionSegments = [
    { name: "Opened only", value: openedNotMessaged, color: "#94A3B8" },
    { name: "Messaged", value: messagedNotMeaningful, color: "#38BDF8" },
    { name: "Meaningful", value: meaningfulNotConverted, color: "#818CF8" },
    { name: "Converted", value: convertedCount, color: "#34D399" }
  ];

  const recentItems = [
    ...currentConversations.map((row) => ({
      id: `conversation-${row.id}`,
      type: "conversation" as const,
      title: row.user_name ?? `Visitor ${row.id.slice(0, 4)}`,
      status: row.is_lead ? "Lead" : "New",
      timestamp: row.created_at,
      href: `/dashboard/conversations/${row.id}`
    })),
    ...currentLeads.map((row) => ({
      id: `lead-${row.id}`,
      type: "lead" as const,
      title: row.name ?? row.email ?? `Lead ${row.id.slice(0, 4)}`,
      status: "Lead",
      timestamp: row.created_at,
      href: "/dashboard/leads"
    })),
    ...currentReservations.map((row) => ({
      id: `reservation-${row.id}`,
      type: "reservation" as const,
      title: row.customer_name ?? `Reservation ${row.id.slice(0, 4)}`,
      status: row.status ?? "Pending",
      timestamp: row.created_at,
      href: "/dashboard/reservations"
    }))
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)
    .map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp).toLocaleString("en-US", {
        timeZone,
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    }));

  const activityItems = recentEvents.map((event, index) => {
    const meta = event?.metadata ?? {};
    const label = event?.type
      ? event.type
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Event";
    const time = event?.timestamp
      ? new Date(event.timestamp).toLocaleString("en-US", {
          timeZone,
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    let href: string | null = null;
    if (meta?.conversation_id) href = `/dashboard/conversations/${meta.conversation_id}`;
    if (event?.type?.startsWith("reservation")) href = "/dashboard/reservations";
    if (event?.type === "lead_created") href = "/dashboard/leads";

    return {
      id: `${event?.type ?? "event"}-${index}`,
      label,
      time,
      tone: activityTone(event?.type),
      href
    };
  });

  const fallbackRate = messagedConversationsCount
    ? Math.round((fallbackCount / messagedConversationsCount) * 100)
    : 0;
  const uptime = "99.9%";

  const healthDelta =
    currentWeeklyMetric && previousWeeklyMetric
      ? currentWeeklyMetric.health_score - previousWeeklyMetric.health_score
      : null;
  const healthSuggestions = currentWeeklyMetric
    ? buildHealthSuggestions({
        conversationsCount: currentWeeklyMetric.conversations_count,
        bookingsCount: currentWeeklyMetric.bookings_count,
        missedIntentsCount: currentWeeklyMetric.missed_intents_count,
        avgResponseTimeSec: currentWeeklyMetric.avg_response_time_sec,
        errorEventsCount: currentWeeklyMetric.error_events_count
      })
    : [];

  const currentConversion =
    currentWeeklyMetric && currentWeeklyMetric.conversations_count > 0
      ? currentWeeklyMetric.bookings_count / currentWeeklyMetric.conversations_count
      : 0;
  const benchmarkConversion = selectedBenchmark?.conversion_p50 ?? 0;
  const conversionDeltaPercent = benchmarkConversion > 0 ? ((currentConversion - benchmarkConversion) / benchmarkConversion) * 100 : null;

  const funnelSteps = [
    { label: "Opened", value: openedBase, helper: "chat_opened" },
    { label: "Messaged", value: messagedConversationsCount, helper: "1+ user message" },
    { label: "Meaningful", value: meaningfulConversations, helper: "3+ messages" },
    { label: "Converted", value: convertedCount, helper: "lead/reservation" }
  ];

  return (
    <div className="space-y-6">
      <ImpactSummaryGate businessId={tenant.businessId} eligiblePeriods={eligibleImpactPeriods} />
      {missingImpactPeriods.length ? (
        <SummaryBootstrapTrigger
          businessId={tenant.businessId}
          missingPeriods={missingImpactPeriods}
          eligiblePeriods={eligibleImpactPeriods}
        />
      ) : null}
      <OverviewHeader
        title="Welcome back"
        subtitle={`Here is what ${businessName} looked like over the past ${rangeDays} days.`}
        businessId={tenant.businessId}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            delta={card.delta}
            series={card.series}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="dashboard-heading text-sm font-semibold text-white">Conversations over time</p>
                <p className="text-xs text-[#cbbd98]">{formatNumber(currentConversationCount)} total in range</p>
              </div>
              <div className="dashboard-pill flex items-center gap-1 rounded-full p-1 text-[11px]">
                {(["7d", "30d", "90d"] as RangeKey[]).map((range) => (
                  <Link
                    key={range}
                    href={`/dashboard?range=${range}`}
                    className={[
                      "rounded-full px-3 py-1 transition",
                      rangeKey === range ? "dashboard-chip text-white" : "text-[#cbbd98] hover:text-white"
                    ].join(" ")}
                  >
                    {range}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <ConversationsTrend data={dailyConversations} />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
            <Card className="min-w-0 rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="dashboard-heading text-sm font-semibold text-white">Conversion breakdown</p>
                  <p className="text-xs text-[#cbbd98]">Opened to Messaged to Meaningful to Converted</p>
                </div>
              </div>
              <ConversionDonut segments={conversionSegments} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#cbbd98]">
                {conversionSegments.map((segment) => (
                  <div key={segment.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
                    <span>{segment.name}</span>
                    <span className="ml-auto text-white">{formatNumber(segment.value)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-3xl p-5">
              <p className="dashboard-heading text-sm font-semibold text-white">Bot health</p>
              <p className="text-xs text-[#cbbd98]">Operational quality and recovery</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="dashboard-inset flex items-center justify-between rounded-2xl px-3 py-2">
                  <span className="text-[#cbbd98]">Uptime</span>
                  <span className="text-white">{uptime}</span>
                </div>
                <div className="dashboard-inset flex items-center justify-between rounded-2xl px-3 py-2">
                  <span className="text-[#cbbd98]">Avg response</span>
                  <span className="text-white">{avgResponseMs ? `${avgResponseSeconds}s` : "-"}</span>
                </div>
                <div className="dashboard-inset flex items-center justify-between rounded-2xl px-3 py-2">
                  <span className="text-[#cbbd98]">Fallback rate</span>
                  <span className="text-white">{fallbackRate}%</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-[#1a2a3d]">
                  <div
                    className="h-2 rounded-full bg-emerald-400"
                    style={{ width: `${Math.max(100 - fallbackRate, 5)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#ccb77e]">Lower fallback rates keep conversations on track.</p>
              </div>
            </Card>
          </div>

          <RecentTable items={recentItems} />
        </div>

        <div className="lg:sticky lg:top-4">
          <ActivityFeed items={activityItems} />
          <Card className="mt-4 rounded-3xl p-5">
            <p className="dashboard-heading text-sm font-semibold text-white">Health Score</p>
            <p className="text-xs text-[#cbbd98]">Weekly performance snapshot</p>
            {currentWeeklyMetric ? (
              <>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="dashboard-heading text-3xl font-semibold text-white">{currentWeeklyMetric.health_score}</p>
                  <p className="text-xs text-[#cbbd98]">
                    {healthDelta === null ? "No prior week" : `${healthDelta >= 0 ? "+" : ""}${healthDelta} vs last week`}
                  </p>
                </div>
                <div className="mt-3 space-y-2 text-xs text-[#b7cee5]">
                  <div className="dashboard-inset flex items-center justify-between rounded-xl px-2 py-1.5">
                    <span>Errors</span>
                    <span>{currentWeeklyMetric.error_events_count}</span>
                  </div>
                  <div className="dashboard-inset flex items-center justify-between rounded-xl px-2 py-1.5">
                    <span>Missed intents</span>
                    <span>{currentWeeklyMetric.missed_intents_count}</span>
                  </div>
                  <div className="dashboard-inset flex items-center justify-between rounded-xl px-2 py-1.5">
                    <span>Avg response</span>
                    <span>{currentWeeklyMetric.avg_response_time_sec}s</span>
                  </div>
                  <div className="dashboard-inset flex items-center justify-between rounded-xl px-2 py-1.5">
                    <span>Bookings</span>
                    <span>{currentWeeklyMetric.bookings_count}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-[#dbc995]">
                  {healthSuggestions.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-[#cbbd98]">Generating your first summary...</p>
            )}
          </Card>

          <Card className="mt-4 rounded-3xl p-5">
            <p className="dashboard-heading text-sm font-semibold text-white">Compared to similar businesses</p>
            <p className="text-xs text-[#cbbd98]">Platform median for your industry this week</p>
            {currentWeeklyMetric && selectedBenchmark ? (
              <>
                <p className="mt-3 text-xs text-[#b5cae0]">
                  {conversionDeltaPercent === null
                    ? "Benchmark conversion unavailable."
                    : `You're ${conversionDeltaPercent >= 0 ? "+" : ""}${conversionDeltaPercent.toFixed(0)}% ${
                        conversionDeltaPercent >= 0 ? "above" : "below"
                      } typical businesses in ${(business?.industry ?? "general").trim() || "general"} this week.`}
                </p>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#cbbd98]">
                      <span>Conversion</span>
                      <span>
                        {(currentConversion * 100).toFixed(1)}% vs {(selectedBenchmark.conversion_p50 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-[#1a2a3d]">
                      <div
                        className="h-2 rounded-full bg-amber-300"
                        style={{
                          width: `${Math.min(100, Math.max(2, selectedBenchmark.conversion_p50 > 0 ? (currentConversion / selectedBenchmark.conversion_p50) * 50 : 0))}%`
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#cbbd98]">
                      <span>Bookings</span>
                      <span>
                        {currentWeeklyMetric.bookings_count} vs {selectedBenchmark.bookings_p50}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-[#1a2a3d]">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              2,
                              selectedBenchmark.bookings_p50 > 0
                                ? (currentWeeklyMetric.bookings_count / selectedBenchmark.bookings_p50) * 50
                                : 0
                            )
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#cbbd98]">
                      <span>Health score</span>
                      <span>
                        {currentWeeklyMetric.health_score} vs {selectedBenchmark.health_p50}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-[#1a2a3d]">
                      <div
                        className="h-2 rounded-full bg-indigo-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              2,
                              selectedBenchmark.health_p50 > 0
                                ? (currentWeeklyMetric.health_score / selectedBenchmark.health_p50) * 50
                                : 0
                            )
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-[#cbbd98]">Not enough data yet - check back soon.</p>
            )}
          </Card>

          <Card className="mt-4 rounded-3xl p-5">
            <p className="dashboard-heading text-sm font-semibold text-white">Weekly & Monthly summaries</p>
            <p className="text-xs text-[#cbbd98]">Latest generated highlights for your business</p>
            <div className="mt-3 space-y-3">
              {([
                { label: "Weekly", data: latestWeeklySummary },
                { label: "Monthly", data: latestMonthlySummary }
              ] as const).map((item) => {
                const highlight = item.data?.highlights?.[0];
                const isEligible = item.label === "Weekly" ? weeklyEligible : monthlyEligible;
                return (
                  <div key={item.label} className="dashboard-inset rounded-2xl p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">{item.label}</p>
                    {item.data ? (
                      <>
                        <p className="mt-1 text-xs text-[#cbbd98]">
                          {formatSummaryRange(item.data.period_start, item.data.period_end, timeZone)}
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {highlight?.title ?? "Summary generated"}
                        </p>
                        <p className="mt-1 text-xs text-[#e7d6a8]">
                          {highlight?.value ?? "Open impact summary for details."}
                        </p>
                      </>
                    ) : !isEligible ? (
                      <>
                        <p className="mt-1 text-xs text-[#cbbd98]">
                          {item.label === "Weekly"
                            ? "Available after 7 days of activity."
                            : "Available after 30 days of activity."}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8ba6c1]">
                          We&apos;ll unlock this automatically once enough data is available.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-xs text-[#cbbd98]">Generating your first summary...</p>
                        <p className="mt-1 text-[11px] text-[#8ba6c1]">
                          We trigger this once automatically and refresh when ready.
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="mt-4 rounded-3xl p-5">
            <p className="dashboard-heading text-sm font-semibold text-white">Funnel snapshot</p>
            <p className="text-xs text-[#cbbd98]">Current conversion momentum</p>
            <div className="mt-4 space-y-2">
              {funnelSteps.map((step) => (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-xs text-[#cbbd98]">
                    <span>{step.label}</span>
                    <span>{formatNumber(step.value)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1a2a3d]">
                    <div
                      className="h-2 rounded-full bg-amber-300"
                      style={{ width: `${openedBase ? (step.value / openedBase) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
