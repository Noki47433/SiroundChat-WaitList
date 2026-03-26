import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { scoreBusinessRisk } from "@/lib/admin/risk";

export const ADMIN_RANGE_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90
} as const;

export type AdminRangeKey = keyof typeof ADMIN_RANGE_DAYS;

export type Severity = "info" | "success" | "warn" | "danger";

export type AdminNotification = {
  id: number;
  businessId: string;
  businessName: string;
  type: string;
  title: string;
  body: string | null;
  severity: Severity;
  createdAt: string;
};

export type AdminKpi = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  delta: number | null;
  series: number[];
  suffix?: string;
};

export type AdminOverviewData = {
  range: AdminRangeKey;
  kpis: AdminKpi[];
  chartSeries: Array<{
    day: string;
    mrr: number;
    messages: number;
    leads: number;
  }>;
  planDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  notifications: AdminNotification[];
  atRisk: Array<{
    businessId: string;
    businessName: string;
    score: number;
    reasons: string[];
    phone: string | null;
  }>;
  highPerformers: Array<{
    businessId: string;
    businessName: string;
    highlights: string[];
    phone: string | null;
  }>;
};

export type AdminBusinessRow = {
  id: string;
  name: string;
  industry: string | null;
  plan: string;
  status: string;
  websiteSessions: number;
  reservations: number;
  conversations: number;
  messages: number;
  leads: number;
  visitors: number;
  aiCostUsd: number;
  aiTokens: number;
  mrrEur: number;
  profitEstimate: number;
  trendPct: number | null;
  healthScore: number;
  scoreBreakdown: {
    demand: number;
    conversions: number;
    operations: number;
    efficiency: number;
    trend: number;
  };
  phone: string | null;
  websiteUrl: string | null;
  risk: "at_risk" | "healthy" | "high_performer";
  riskScore: number;
  lastMessageAt: string | null;
};

export type AdminBusinessesData = {
  range: AdminRangeKey;
  rows: AdminBusinessRow[];
};

export type BusinessDetailData = {
  range: AdminRangeKey;
  business: {
    id: string;
    name: string;
    industry: string | null;
    city: string | null;
    phone: string | null;
    websiteUrl: string | null;
    plan: string;
    status: string;
    createdAt: string;
    mrrEur: number;
  };
  usageSeries: Array<{
    day: string;
    conversations: number;
    messages: number;
    aiMessages: number;
    humanMessages: number;
    leads: number;
    visitors: number;
    tokensIn: number;
    tokensOut: number;
    cost: number;
  }>;
  snapshot: {
    websiteSessions: number;
    reservations: number;
    conversations: number;
    messages: number;
    leads: number;
    visitors: number;
    aiCostUsd: number;
    aiTokens: number;
    avgCostPerConversation: number;
    responseMinutes: number | null;
    trendPct: number | null;
    healthScore: number;
    scoreBreakdown: {
      demand: number;
      conversions: number;
      operations: number;
      efficiency: number;
      trend: number;
    };
    topLeadTypes: Array<{ name: string; value: number }>;
  };
  reservations: Array<{
    id: string;
    createdAt: string;
    dateTime: string;
    customerName: string | null;
    partySize: number | null;
    status: string;
  }>;
  leads: Array<{
    id: string;
    createdAt: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    leadType: string | null;
  }>;
  conversations: Array<{
    id: string;
    channel: string;
    visitorId: string | null;
    status: string;
    createdAt: string;
    lastMessageAt: string;
    messageCount: number;
    latestMessage: string | null;
  }>;
  events: AdminNotification[];
};

export type LiveConversation = {
  id: string;
  businessId: string;
  businessName: string;
  channel: string;
  status: string;
  visitorId: string | null;
  createdAt: string;
  lastMessageAt: string;
  latestMessage: string | null;
  durationMinutes: number;
};

export type AdminLiveData = {
  activeConversations: LiveConversation[];
  events: AdminNotification[];
  systemHealth: {
    realtimeConnected: boolean;
    lastEventAt: string | null;
  };
};

export type AdminConversationRow = {
  id: string;
  businessId: string;
  businessName: string;
  channel: string;
  status: string;
  visitorId: string | null;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  latestMessage: string | null;
};

export type RevenueData = {
  range: AdminRangeKey;
  summary: {
    mrrEur: number;
    newMrrEur: number;
    churnedMrrEur: number;
    conversionRate: number;
  };
  series: Array<{
    day: string;
    mrr: number;
    newMrr: number;
    churnedMrr: number;
  }>;
  planDistribution: Array<{ name: string; value: number }>;
};

export type CostsData = {
  range: AdminRangeKey;
  totalAiCostUsd: number;
  costByBusiness: Array<{
    businessId: string;
    businessName: string;
    cost: number;
  }>;
  anomalies: Array<{
    businessId: string;
    businessName: string;
    todayCost: number;
    baselineCost: number;
    ratio: number;
  }>;
  series: Array<{
    day: string;
    cost: number;
    tokensIn: number;
    tokensOut: number;
  }>;
};

type BusinessRow = {
  id: string;
  name: string | null;
  business_name: string | null;
  industry: string | null;
  plan: string | null;
  status: string | null;
  phone: string | null;
  website_url: string | null;
  city: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  business_id: string;
  plan: string | null;
  status: string | null;
  mrr_eur: number | string | null;
  created_at: string;
  updated_at: string | null;
};

type BillingSubscriptionSourceRow = {
  id: string;
  business_id: string;
  plan_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

type BillingPlanPriceRow = {
  id: string;
  price_cents: number;
};

type DailyMetricRow = {
  business_id: string;
  day: string;
  conversations_count: number;
  messages_count: number;
  ai_messages_count: number;
  human_messages_count: number;
  leads_count: number;
  visitors_count: number;
  tokens_in: number;
  tokens_out: number;
  ai_cost_usd: number;
};

type EventRow = {
  id: number;
  business_id: string;
  type: string;
  title: string;
  body: string | null;
  severity: Severity;
  created_at: string;
};

type ConversationRow = {
  id: string;
  business_id: string;
  channel: string;
  status: string;
  visitor_id: string | null;
  created_at: string;
  last_message_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  business_id: string;
  sender: string;
  content: string;
  created_at: string;
};

type WebsiteAnalyticsRow = {
  business_id: string;
  event_type: string | null;
  session_id: string | null;
  channel: string | null;
  occurred_at: string | null;
};

type ReservationMetricRow = {
  id: string;
  business_id: string;
  status: string | null;
  created_at: string | null;
  datetime: string | null;
  customer_name: string | null;
  party_size: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const pctDelta = (current: number, previous: number) => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const toDateOnly = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toYmd = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

const buildDayKeys = (end: Date, days: number) => {
  const start = addDays(toDateOnly(end), -(days - 1));
  return Array.from({ length: days }, (_, index) => toYmd(addDays(start, index)));
};

const normalizeRange = (value?: string | null): AdminRangeKey => {
  if (!value) return "30d";
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
};

const diffDaysInclusive = (fromDay: string, toDay: string) => {
  const from = toDateOnly(fromDay).getTime();
  const to = toDateOnly(toDay).getTime();
  return Math.max(1, Math.floor((to - from) / DAY_MS) + 1);
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AI_INPUT_COST_PER_MILLION = Number(process.env.ADMIN_AI_INPUT_COST_PER_MILLION_USD ?? "0.15");
const AI_OUTPUT_COST_PER_MILLION = Number(process.env.ADMIN_AI_OUTPUT_COST_PER_MILLION_USD ?? "0.6");

const deriveAiCostUsd = (tokensIn: number, tokensOut: number, recordedCostUsd: number) => {
  if (recordedCostUsd > 0) return Number(recordedCostUsd.toFixed(2));
  const derived = (tokensIn / 1_000_000) * AI_INPUT_COST_PER_MILLION + (tokensOut / 1_000_000) * AI_OUTPUT_COST_PER_MILLION;
  return Number(derived.toFixed(2));
};

const percentChange = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const toDayKey = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toYmd(date);
};

const isReservationCountable = (status: string | null) => {
  const normalized = (status ?? "").toLowerCase();
  return normalized !== "canceled" && normalized !== "cancelled" && normalized !== "no_show";
};

const buildHealthScore = (input: {
  websiteSessions: number;
  leads: number;
  reservations: number;
  conversations: number;
  messages: number;
  aiCostUsd: number;
  trendPct: number | null;
  responseMinutes?: number | null;
}) => {
  const demand = Math.round(clamp((input.websiteSessions + input.conversations * 3) / 250, 0, 1) * 20);
  const conversions = Math.round(clamp((input.leads * 4 + input.reservations * 7) / 60, 0, 1) * 30);
  const conversationDepth = input.conversations > 0 ? input.messages / input.conversations : 0;
  const depthSignal = clamp(conversationDepth / 8, 0, 1);
  const responseSignal =
    input.responseMinutes == null ? 0.55 : clamp((20 - Math.min(input.responseMinutes, 20)) / 20, 0, 1);
  const operations = Math.round(clamp(depthSignal * 0.55 + responseSignal * 0.45, 0, 1) * 20);
  const outcomeValue = input.leads * 12 + input.reservations * 18 + input.conversations * 1.5;
  const efficiencyRatio = input.aiCostUsd > 0 ? outcomeValue / input.aiCostUsd : outcomeValue > 0 ? 20 : 0;
  const efficiency = Math.round(clamp(efficiencyRatio / 20, 0, 1) * 15);
  const normalizedTrend = clamp(((input.trendPct ?? 0) + 50) / 100, 0, 1);
  const trend = Math.round(normalizedTrend * 15);
  const total = demand + conversions + operations + efficiency + trend;

  return {
    total: clamp(total, 0, 100),
    breakdown: {
      demand,
      conversions,
      operations,
      efficiency,
      trend
    }
  };
};

const sumRows = (rows: DailyMetricRow[], field: keyof DailyMetricRow, predicate: (row: DailyMetricRow) => boolean) =>
  rows.filter(predicate).reduce((sum, row) => sum + toNumber(row[field]), 0);

const buildDailyTotals = (rows: DailyMetricRow[]) => {
  const totals = new Map<string, DailyMetricRow>();

  rows.forEach((row) => {
    const existing = totals.get(row.day);
    if (!existing) {
      totals.set(row.day, { ...row, business_id: "*" });
      return;
    }

    existing.conversations_count += toNumber(row.conversations_count);
    existing.messages_count += toNumber(row.messages_count);
    existing.ai_messages_count += toNumber(row.ai_messages_count);
    existing.human_messages_count += toNumber(row.human_messages_count);
    existing.leads_count += toNumber(row.leads_count);
    existing.visitors_count += toNumber(row.visitors_count);
    existing.tokens_in += toNumber(row.tokens_in);
    existing.tokens_out += toNumber(row.tokens_out);
    existing.ai_cost_usd += toNumber(row.ai_cost_usd);
  });

  return totals;
};

const formatCurrency = (value: number, currency: "EUR" | "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0
  }).format(value);

const latestByBusiness = (subscriptions: SubscriptionRow[]) => {
  const sorted = [...subscriptions].sort((a, b) => {
    const aTs = new Date(a.updated_at ?? a.created_at).getTime();
    const bTs = new Date(b.updated_at ?? b.created_at).getTime();
    return bTs - aTs;
  });

  const map = new Map<string, SubscriptionRow>();
  sorted.forEach((subscription) => {
    if (!map.has(subscription.business_id)) {
      map.set(subscription.business_id, subscription);
    }
  });

  return map;
};

const toSubscriptionRows = (
  subscriptions: BillingSubscriptionSourceRow[],
  priceByPlanId: Map<string, number>
): SubscriptionRow[] =>
  subscriptions.map((subscription) => ({
    id: subscription.id,
    business_id: subscription.business_id,
    plan: subscription.plan_id,
    status: subscription.status,
    mrr_eur: priceByPlanId.get(subscription.plan_id ?? "") ?? 0,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at
  }));

const fetchBillingSubscriptionRows = async (
  supabase: any,
  options: {
    all?: boolean;
    businessId?: string;
    businessIds?: string[];
    limit?: number;
  }
): Promise<SubscriptionRow[]> => {
  const planQuery = (supabase as any).from("billing_plans").select("id, price_cents");
  let subscriptionQuery = (supabase as any)
    .from("billing_subscriptions")
    .select("id, business_id, plan_id, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.all) {
    // No business filter.
  } else if (options.businessId) {
    subscriptionQuery = subscriptionQuery.eq("business_id", options.businessId);
  } else if (options.businessIds?.length) {
    subscriptionQuery = subscriptionQuery.in("business_id", options.businessIds);
  } else {
    return [];
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    subscriptionQuery = subscriptionQuery.limit(options.limit);
  }

  const [subscriptionsResult, plansResult] = await Promise.all([subscriptionQuery, planQuery]);
  if (subscriptionsResult.error) {
    console.error("[ADMIN_BILLING_SUBSCRIPTIONS_ERROR]", subscriptionsResult.error);
    return [];
  }

  if (plansResult.error) {
    console.error("[ADMIN_BILLING_PLANS_ERROR]", plansResult.error);
    return [];
  }

  const priceByPlanId = new Map(
    ((plansResult.data ?? []) as BillingPlanPriceRow[]).map((plan) => [plan.id, plan.price_cents / 100])
  );

  return toSubscriptionRows(
    (subscriptionsResult.data ?? []) as BillingSubscriptionSourceRow[],
    priceByPlanId
  );
};

const mrrForDay = (subscription: SubscriptionRow, day: string) => {
  const status = (subscription.status ?? "").toLowerCase();
  const mrr = toNumber(subscription.mrr_eur);
  if (status === "trialing") return 0;

  if (status === "canceled") {
    const canceledAt = subscription.updated_at ? toYmd(subscription.updated_at) : null;
    if (canceledAt && day < canceledAt) return mrr;
    return 0;
  }

  if (status === "active" || status === "past_due") return mrr;
  return 0;
};

const buildSubscriptionMrrSeries = (dayKeys: string[], latestSubs: Map<string, SubscriptionRow>) =>
  dayKeys.map((day) => {
    let total = 0;
    latestSubs.forEach((subscription) => {
      total += mrrForDay(subscription, day);
    });
    return total;
  });

const mapEvents = (events: EventRow[], businesses: Map<string, BusinessRow>): AdminNotification[] =>
  events.map((event) => ({
    id: event.id,
    businessId: event.business_id,
    businessName:
      businesses.get(event.business_id)?.name ?? businesses.get(event.business_id)?.business_name ?? "Unknown business",
    type: event.type,
    title: event.title,
    body: event.body,
    severity: event.severity,
    createdAt: event.created_at
  }));

const buildRiskLists = (
  businesses: BusinessRow[],
  latestSubs: Map<string, SubscriptionRow>,
  rows: DailyMetricRow[],
  endDate: Date
) => {
  const today = toDateOnly(endDate);
  const current7Start = toYmd(addDays(today, -6));
  const prev7Start = toYmd(addDays(today, -13));
  const prev7End = toYmd(addDays(today, -7));

  const scored = businesses.map((business) => {
    const businessRows = rows.filter((row) => row.business_id === business.id);
    const messagesLast7d = sumRows(
      businessRows,
      "messages_count",
      (row) => row.day >= current7Start && row.day <= toYmd(today)
    );
    const messagesPrev7d = sumRows(
      businessRows,
      "messages_count",
      (row) => row.day >= prev7Start && row.day <= prev7End
    );
    const leadsLast7d = sumRows(businessRows, "leads_count", (row) => row.day >= current7Start && row.day <= toYmd(today));
    const leadsPrev7d = sumRows(businessRows, "leads_count", (row) => row.day >= prev7Start && row.day <= prev7End);
    const aiCostLast7d = sumRows(businessRows, "ai_cost_usd", (row) => row.day >= current7Start && row.day <= toYmd(today));

    const latestSub = latestSubs.get(business.id);

    return scoreBusinessRisk({
      businessId: business.id,
      businessName: business.name ?? business.business_name ?? "Unnamed business",
      subscriptionStatus: latestSub?.status ?? business.status ?? null,
      revenueMrrEur: toNumber(latestSub?.mrr_eur),
      messagesLast7d,
      messagesPrev7d,
      leadsLast7d,
      leadsPrev7d,
      aiCostLast7d
    });
  });

  const atRisk = scored
    .filter((item) => item.atRisk)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => ({
      businessId: item.businessId,
      businessName: item.businessName,
      score: item.score,
      reasons: item.reasons
    }));

  const highPerformers = scored
    .filter((item) => item.highPerformer)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => ({
      businessId: item.businessId,
      businessName: item.businessName,
      highlights: item.highlights
    }));

  return {
    scored,
    atRisk,
    highPerformers
  };
};

type BaseDataOptions = {
  metricsFromDay: string;
  metricsToDay?: string;
  eventsLimit?: number;
  businessesLimit?: number;
  subscriptionRowsPerBusiness?: number;
};

const getBaseData = async (options: BaseDataOptions) => {
  const supabase = getSupabaseServerAdminClient();

  const businessesLimit = Math.max(1, options.businessesLimit ?? 500);
  const metricsToDay = options.metricsToDay ?? toYmd(toDateOnly(new Date()));

  // Bounded business fetch: avoid unbounded scans on low Supabase compute.
  const { data: businessesRaw } = await (supabase as any)
    .from("businesses")
    .select("id, name, business_name, industry, plan, status, phone, website_url, city, created_at")
    .order("created_at", { ascending: false })
    .limit(businessesLimit);

  const businesses = ((businessesRaw ?? []) as BusinessRow[]).map((row) => ({
    ...row,
    name: row.name ?? row.business_name
  }));

  if (!businesses.length) {
    return {
      supabase,
      businesses: [] as BusinessRow[],
      subscriptions: [] as SubscriptionRow[],
      metrics: [] as DailyMetricRow[],
      events: [] as EventRow[]
    };
  }

  const businessIds = businesses.map((business) => business.id);
  const metricsDays = diffDaysInclusive(options.metricsFromDay, metricsToDay);
  const metricsLimit = Math.max(businessIds.length * (metricsDays + 1), businessesLimit);
  const subscriptionsLimit = Math.max(
    businessIds.length * Math.max(1, options.subscriptionRowsPerBusiness ?? 8),
    businessesLimit
  );

  const [subscriptions, metricsResult, eventsResult] = await Promise.all([
    fetchBillingSubscriptionRows(supabase as any, {
      businessIds,
      limit: subscriptionsLimit
    }),
    // Read only the metrics window required by the caller (no raw messages scans).
    (supabase as any)
      .from("business_metrics_daily")
      .select(
        "business_id, day, conversations_count, messages_count, ai_messages_count, human_messages_count, leads_count, visitors_count, tokens_in, tokens_out, ai_cost_usd"
      )
      .in("business_id", businessIds)
      .gte("day", options.metricsFromDay)
      .lte("day", metricsToDay)
      .order("day", { ascending: true })
      .limit(metricsLimit),
    // Feed is intentionally bounded to a small window for dashboard activity panel.
    (supabase as any)
      .from("events")
      .select("id, business_id, type, title, body, severity, created_at")
      .in("business_id", businessIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, options.eventsLimit ?? 20))
  ]);

  return {
    supabase,
    businesses,
    subscriptions,
    metrics: (metricsResult.data ?? []) as DailyMetricRow[],
    events: (eventsResult.data ?? []) as EventRow[]
  };
};

export async function getAdminOverviewData(rangeInput?: string | null): Promise<AdminOverviewData> {
  const range = normalizeRange(rangeInput);
  const rangeDays = ADMIN_RANGE_DAYS[range];
  const today = toDateOnly(new Date());
  const todayKey = toYmd(today);
  const metricsLookbackDays = Math.max(rangeDays, 60);
  const metricsFromDay = toYmd(addDays(today, -(metricsLookbackDays - 1)));

  // Overview now relies only on bounded, aggregated reads.
  const { businesses, subscriptions, metrics, events } = await getBaseData({
    metricsFromDay,
    metricsToDay: todayKey,
    eventsLimit: 20,
    businessesLimit: 400,
    subscriptionRowsPerBusiness: 8
  });
  const businessMap = new Map<string, BusinessRow>(businesses.map((business) => [business.id, business]));
  const latestSubs = latestByBusiness(subscriptions);

  const currentMrr = Array.from(latestSubs.values()).reduce((sum, subscription) => {
    const status = (subscription.status ?? "").toLowerCase();
    if (status === "active" || status === "past_due") {
      return sum + toNumber(subscription.mrr_eur);
    }
    return sum;
  }, 0);

  const payingBusinesses = Array.from(latestSubs.values()).filter((subscription) => {
    const status = (subscription.status ?? "").toLowerCase();
    return status === "active" || status === "past_due";
  }).length;

  const trials = businesses.filter((business) => {
    const sub = latestSubs.get(business.id);
    const subStatus = (sub?.status ?? "").toLowerCase();
    const plan = (business.plan ?? sub?.plan ?? "").toLowerCase();
    return subStatus === "trialing" || plan === "trial";
  }).length;

  const thirtyStart = toYmd(addDays(today, -29));
  const prevThirtyStart = toYmd(addDays(today, -59));
  const prevThirtyEnd = toYmd(addDays(today, -30));
  const sevenStart = toYmd(addDays(today, -6));
  const prevSevenStart = toYmd(addDays(today, -13));
  const prevSevenEnd = toYmd(addDays(today, -7));

  const aiCost30d = sumRows(metrics, "ai_cost_usd", (row) => row.day >= thirtyStart && row.day <= todayKey);
  const aiCostPrev30d = sumRows(metrics, "ai_cost_usd", (row) => row.day >= prevThirtyStart && row.day <= prevThirtyEnd);
  const visitors7d = sumRows(metrics, "visitors_count", (row) => row.day >= sevenStart && row.day <= todayKey);
  const visitorsPrev7d = sumRows(metrics, "visitors_count", (row) => row.day >= prevSevenStart && row.day <= prevSevenEnd);

  const churnCurrentBase = subscriptions.filter((sub) => {
    if (!sub.updated_at) return false;
    const day = toYmd(sub.updated_at);
    return day >= thirtyStart && day <= todayKey;
  });
  const churnPrevBase = subscriptions.filter((sub) => {
    if (!sub.updated_at) return false;
    const day = toYmd(sub.updated_at);
    return day >= prevThirtyStart && day <= prevThirtyEnd;
  });

  const churn30d =
    churnCurrentBase.length === 0
      ? 0
      : (churnCurrentBase.filter((sub) => (sub.status ?? "").toLowerCase() === "canceled").length / churnCurrentBase.length) *
        100;

  const churnPrev30d =
    churnPrevBase.length === 0
      ? 0
      : (churnPrevBase.filter((sub) => (sub.status ?? "").toLowerCase() === "canceled").length / churnPrevBase.length) * 100;

  const grossMargin = currentMrr > 0 ? ((currentMrr - aiCost30d) / currentMrr) * 100 : 0;
  const grossMarginPrev = currentMrr > 0 ? ((currentMrr - aiCostPrev30d) / currentMrr) * 100 : 0;

  const dayKeys = buildDayKeys(today, rangeDays);
  const totalsByDay = buildDailyTotals(metrics);

  // "Messages (24h)" now reads from daily aggregates instead of exact counts on raw messages.
  const messages24 = totalsByDay.get(todayKey)?.messages_count ?? 0;
  const messagesPrev24 = totalsByDay.get(toYmd(addDays(today, -1)))?.messages_count ?? 0;
  const messagesSeries = dayKeys.map((day) => totalsByDay.get(day)?.messages_count ?? 0);
  const leadsSeries = dayKeys.map((day) => totalsByDay.get(day)?.leads_count ?? 0);
  const visitorsSeries = dayKeys.map((day) => totalsByDay.get(day)?.visitors_count ?? 0);
  const aiCostSeries = dayKeys.map((day) => Number((totalsByDay.get(day)?.ai_cost_usd ?? 0).toFixed(2)));
  const mrrSeries = buildSubscriptionMrrSeries(dayKeys, latestSubs);
  const churnSeries = dayKeys.map((day) => {
    const canceled = subscriptions.filter((sub) => {
      if (!sub.updated_at) return false;
      return toYmd(sub.updated_at) === day && (sub.status ?? "").toLowerCase() === "canceled";
    }).length;
    const touched = subscriptions.filter((sub) => sub.updated_at && toYmd(sub.updated_at) === day).length;
    if (!touched) return 0;
    return Number(((canceled / touched) * 100).toFixed(2));
  });
  const grossMarginSeries = dayKeys.map((day, index) => {
    const revenue = mrrSeries[index] ?? 0;
    const cost = aiCostSeries[index] ?? 0;
    if (!revenue) return 0;
    return Number((((revenue - cost) / revenue) * 100).toFixed(2));
  });

  const [mrrNow, mrrPrev] = [
    mrrSeries[mrrSeries.length - 1] ?? currentMrr,
    mrrSeries[Math.max(0, mrrSeries.length - 2)] ?? null
  ];

  const planDistributionMap = new Map<string, number>();
  Array.from(latestSubs.values()).forEach((subscription) => {
    const plan = subscription.plan ?? "unknown";
    planDistributionMap.set(plan, (planDistributionMap.get(plan) ?? 0) + 1);
  });
  if (planDistributionMap.size === 0) {
    businesses.forEach((business) => {
      const plan = business.plan ?? "trial";
      planDistributionMap.set(plan, (planDistributionMap.get(plan) ?? 0) + 1);
    });
  }

  const planColors = ["#7CFF9D", "#30D158", "#00A86B", "#32D4A4", "#79FFE1"];
  const planDistribution = Array.from(planDistributionMap.entries()).map(([name, value], index) => ({
    name,
    value,
    color: planColors[index % planColors.length]
  }));

  const risk = buildRiskLists(businesses, latestSubs, metrics, today);
  const phoneLookup = new Map(businesses.map((business) => [business.id, business.phone ?? null]));

  const kpis: AdminKpi[] = [
    {
      key: "mrr",
      label: "MRR (EUR)",
      value: currentMrr,
      displayValue: formatCurrency(currentMrr, "EUR"),
      delta: mrrPrev ? pctDelta(mrrNow, mrrPrev) : null,
      series: mrrSeries
    },
    {
      key: "paying",
      label: "Paying Businesses",
      value: payingBusinesses,
      displayValue: String(payingBusinesses),
      delta: null,
      series: dayKeys.map((_, index) => {
        let total = 0;
        latestSubs.forEach((subscription) => {
          const status = (subscription.status ?? "").toLowerCase();
          const day = dayKeys[index];
          if ((status === "active" || status === "past_due") && mrrForDay(subscription, day) >= 0) {
            total += 1;
          }
        });
        return total;
      })
    },
    {
      key: "trials",
      label: "Trials",
      value: trials,
      displayValue: String(trials),
      delta: null,
      series: dayKeys.map(() => trials)
    },
    {
      key: "churn",
      label: "Churn (30d)",
      value: churn30d,
      displayValue: `${churn30d.toFixed(1)}%`,
      delta: pctDelta(churn30d, churnPrev30d),
      series: churnSeries,
      suffix: "%"
    },
    {
      key: "messages24h",
      label: "Messages (24h)",
      value: messages24,
      displayValue: String(messages24),
      delta: pctDelta(messages24, messagesPrev24),
      series: messagesSeries
    },
    {
      key: "aiCost",
      label: "AI Cost (30d)",
      value: aiCost30d,
      displayValue: formatCurrency(aiCost30d, "USD"),
      delta: pctDelta(aiCost30d, aiCostPrev30d),
      series: aiCostSeries
    },
    {
      key: "grossMargin",
      label: "Gross Margin %",
      value: grossMargin,
      displayValue: `${grossMargin.toFixed(1)}%`,
      delta: pctDelta(grossMargin, grossMarginPrev),
      series: grossMarginSeries,
      suffix: "%"
    },
    {
      key: "visitors7d",
      label: "Website Visitors (7d)",
      value: visitors7d,
      displayValue: String(visitors7d),
      delta: pctDelta(visitors7d, visitorsPrev7d),
      series: visitorsSeries
    }
  ];

  return {
    range,
    kpis,
    chartSeries: dayKeys.map((day, index) => ({
      day,
      mrr: Number((mrrSeries[index] ?? 0).toFixed(2)),
      messages: messagesSeries[index] ?? 0,
      leads: leadsSeries[index] ?? 0
    })),
    planDistribution,
    notifications: mapEvents(events, businessMap),
    atRisk: risk.atRisk.map((item) => ({
      ...item,
      phone: phoneLookup.get(item.businessId) ?? null
    })),
    highPerformers: risk.highPerformers.map((item) => ({
      ...item,
      phone: phoneLookup.get(item.businessId) ?? null
    }))
  };
}

export async function getAdminBusinessesData(rangeInput?: string | null): Promise<AdminBusinessesData> {
  const range = normalizeRange(rangeInput ?? "7d");
  const rangeDays = ADMIN_RANGE_DAYS[range];
  const today = toDateOnly(new Date());
  const currentStart = toYmd(addDays(today, -(rangeDays - 1)));
  const previousStart = toYmd(addDays(today, -(rangeDays * 2 - 1)));
  const previousEnd = toYmd(addDays(today, -rangeDays));
  const currentEnd = toYmd(today);

  const { supabase, businesses, subscriptions, metrics } = await getBaseData({ metricsFromDay: previousStart });
  if (!businesses.length) {
    return { range, rows: [] };
  }
  const latestSubs = latestByBusiness(subscriptions);
  const risk = buildRiskLists(businesses, latestSubs, metrics, today);
  const riskMap = new Map(risk.scored.map((item) => [item.businessId, item]));
  const businessIds = businesses.map((business) => business.id);

  const [conversationsResult, reservationsResult, websiteEventsResult] = await Promise.all([
    (supabase as any)
      .from("conversations")
      .select("id, business_id, last_message_at")
      .in("business_id", businessIds)
      .order("last_message_at", { ascending: false })
      .limit(1500),
    (supabase as any)
      .from("reservations")
      .select("id, business_id, status, created_at, datetime, customer_name, party_size")
      .in("business_id", businessIds)
      .gte("created_at", `${previousStart}T00:00:00.000Z`)
      .order("created_at", { ascending: false })
      .limit(Math.max(500, businessIds.length * rangeDays * 4)),
    (supabase as any)
      .from("website_analytics_events")
      .select("business_id, event_type, session_id, channel, occurred_at")
      .in("business_id", businessIds)
      .gte("occurred_at", `${previousStart}T00:00:00.000Z`)
      .order("occurred_at", { ascending: false })
      .limit(Math.max(1000, businessIds.length * rangeDays * 12))
  ]);

  const lastMessageMap = new Map<string, string>();
  (((conversationsResult as any)?.data ?? []) as Array<{ business_id: string; last_message_at: string }>).forEach((row) => {
    if (!lastMessageMap.has(row.business_id)) {
      lastMessageMap.set(row.business_id, row.last_message_at);
    }
  });

  const reservationsByBusiness = new Map<string, ReservationMetricRow[]>();
  ((reservationsResult?.data ?? []) as ReservationMetricRow[]).forEach((row) => {
    const list = reservationsByBusiness.get(row.business_id) ?? [];
    list.push(row);
    reservationsByBusiness.set(row.business_id, list);
  });

  const websiteEventsByBusiness = new Map<string, WebsiteAnalyticsRow[]>();
  ((websiteEventsResult?.data ?? []) as WebsiteAnalyticsRow[]).forEach((row) => {
    const list = websiteEventsByBusiness.get(row.business_id) ?? [];
    list.push(row);
    websiteEventsByBusiness.set(row.business_id, list);
  });

  const rows = businesses.map((business) => {
    const businessRows = metrics.filter((row) => row.business_id === business.id && row.day >= currentStart && row.day <= toYmd(today));
    const previousBusinessRows = metrics.filter(
      (row) => row.business_id === business.id && row.day >= previousStart && row.day <= previousEnd
    );
    const subscription = latestSubs.get(business.id);
    const mrrEur = toNumber(subscription?.mrr_eur);

    const aggregate = businessRows.reduce(
      (acc, row) => {
        acc.conversations += toNumber(row.conversations_count);
        acc.messages += toNumber(row.messages_count);
        acc.leads += toNumber(row.leads_count);
        acc.visitors += toNumber(row.visitors_count);
        acc.tokensIn += toNumber(row.tokens_in);
        acc.tokensOut += toNumber(row.tokens_out);
        acc.aiCostUsd += toNumber(row.ai_cost_usd);
        return acc;
      },
      { conversations: 0, messages: 0, leads: 0, visitors: 0, tokensIn: 0, tokensOut: 0, aiCostUsd: 0 }
    );
    const previousAggregate = previousBusinessRows.reduce(
      (acc, row) => {
        acc.conversations += toNumber(row.conversations_count);
        acc.leads += toNumber(row.leads_count);
        return acc;
      },
      { conversations: 0, leads: 0 }
    );

    const reservationRows = reservationsByBusiness.get(business.id) ?? [];
    const currentReservations = reservationRows.filter((row) => {
      const day = toDayKey(row.created_at);
      return day != null && day >= currentStart && day <= currentEnd && isReservationCountable(row.status);
    }).length;
    const previousReservations = reservationRows.filter((row) => {
      const day = toDayKey(row.created_at);
      return day != null && day >= previousStart && day <= previousEnd && isReservationCountable(row.status);
    }).length;

    const websiteRows = websiteEventsByBusiness.get(business.id) ?? [];
    const currentSessionIds = new Set(
      websiteRows
        .filter((row) => {
          const day = toDayKey(row.occurred_at);
          return row.event_type === "page_view" && row.session_id && day != null && day >= currentStart && day <= currentEnd;
        })
        .map((row) => row.session_id as string)
    );
    const previousSessionIds = new Set(
      websiteRows
        .filter((row) => {
          const day = toDayKey(row.occurred_at);
          return row.event_type === "page_view" && row.session_id && day != null && day >= previousStart && day <= previousEnd;
        })
        .map((row) => row.session_id as string)
    );
    const currentWebsiteSessions = currentSessionIds.size;
    const previousWebsiteSessions = previousSessionIds.size;
    const aiCostUsd = deriveAiCostUsd(aggregate.tokensIn, aggregate.tokensOut, aggregate.aiCostUsd);
    const aiTokens = aggregate.tokensIn + aggregate.tokensOut;
    const trendCurrent = currentWebsiteSessions + aggregate.leads * 6 + currentReservations * 8 + aggregate.conversations * 2;
    const trendPrevious =
      previousWebsiteSessions + previousAggregate.leads * 6 + previousReservations * 8 + previousAggregate.conversations * 2;
    const trendPct = percentChange(trendCurrent, trendPrevious);
    const health = buildHealthScore({
      websiteSessions: currentWebsiteSessions,
      leads: aggregate.leads,
      reservations: currentReservations,
      conversations: aggregate.conversations,
      messages: aggregate.messages,
      aiCostUsd,
      trendPct
    });

    const riskEntry = riskMap.get(business.id);
    const riskState: AdminBusinessRow["risk"] = riskEntry?.atRisk
      ? "at_risk"
      : riskEntry?.highPerformer
        ? "high_performer"
        : "healthy";

    return {
      id: business.id,
      name: business.name ?? business.business_name ?? "Unnamed business",
      industry: business.industry,
      plan: subscription?.plan ?? business.plan ?? "trial",
      status: subscription?.status ?? business.status ?? "active",
      websiteSessions: currentWebsiteSessions,
      reservations: currentReservations,
      conversations: aggregate.conversations,
      messages: aggregate.messages,
      leads: aggregate.leads,
      visitors: aggregate.visitors,
      aiCostUsd,
      aiTokens,
      mrrEur,
      profitEstimate: Number((mrrEur - aiCostUsd).toFixed(2)),
      trendPct,
      healthScore: health.total,
      scoreBreakdown: health.breakdown,
      phone: business.phone,
      websiteUrl: business.website_url,
      risk: riskState,
      riskScore: riskEntry?.score ?? 0,
      lastMessageAt: lastMessageMap.get(business.id) ?? null
    } satisfies AdminBusinessRow;
  });

  rows.sort((a, b) => b.healthScore - a.healthScore || b.websiteSessions - a.websiteSessions);

  return {
    range,
    rows
  };
}

export async function getAdminBusinessDetailData(
  businessId: string,
  rangeInput?: string | null
): Promise<BusinessDetailData | null> {
  const range = normalizeRange(rangeInput ?? "90d");
  const rangeDays = ADMIN_RANGE_DAYS[range];
  const today = toDateOnly(new Date());
  const currentStart = toYmd(addDays(today, -(rangeDays - 1)));
  const previousStart = toYmd(addDays(today, -(rangeDays * 2 - 1)));
  const previousEnd = toYmd(addDays(today, -rangeDays));
  const currentEnd = toYmd(today);

  const supabase = getSupabaseServerAdminClient();

  const [
    businessResult,
    subscriptions,
    metricsResult,
    leadsResult,
    conversationsResult,
    messagesResult,
    eventsResult,
    reservationsResult,
    websiteEventsResult
  ] =
    await Promise.all([
      (supabase as any)
        .from("businesses")
        .select("id, name, business_name, industry, city, phone, website_url, plan, status, created_at")
        .eq("id", businessId)
        .maybeSingle(),
      fetchBillingSubscriptionRows(supabase as any, { businessId }),
      (supabase as any)
        .from("business_metrics_daily")
        .select(
          "business_id, day, conversations_count, messages_count, ai_messages_count, human_messages_count, leads_count, visitors_count, tokens_in, tokens_out, ai_cost_usd"
        )
        .eq("business_id", businessId)
        .gte("day", previousStart)
        .order("day", { ascending: true }),
      (supabase as any)
        .from("leads")
        .select("id, created_at, name, phone, email, lead_type")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("conversations")
        .select("id, business_id, channel, status, visitor_id, created_at, last_message_at")
        .eq("business_id", businessId)
        .order("last_message_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("messages")
        .select("id, conversation_id, business_id, sender, content, created_at")
        .eq("business_id", businessId)
        .gte("created_at", addDays(today, -rangeDays).toISOString())
        .order("created_at", { ascending: false })
        .limit(800),
      (supabase as any)
        .from("events")
        .select("id, business_id, type, title, body, severity, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(40),
      (supabase as any)
        .from("reservations")
        .select("id, business_id, status, created_at, datetime, customer_name, party_size")
        .eq("business_id", businessId)
        .gte("created_at", `${previousStart}T00:00:00.000Z`)
        .order("created_at", { ascending: false })
        .limit(120),
      (supabase as any)
        .from("website_analytics_events")
        .select("business_id, event_type, session_id, channel, occurred_at")
        .eq("business_id", businessId)
        .gte("occurred_at", `${previousStart}T00:00:00.000Z`)
        .order("occurred_at", { ascending: false })
        .limit(rangeDays * 200)
    ]);

  const business = businessResult.data as BusinessRow | null;
  if (!business) return null;

  const latestSub = subscriptions[0];
  const metrics = (metricsResult.data ?? []) as DailyMetricRow[];
  const currentMetrics = metrics.filter((row) => row.day >= currentStart && row.day <= currentEnd);
  const leads = (leadsResult.data ?? []) as Array<{
    id: string;
    created_at: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    lead_type: string | null;
  }>;
  const conversations = (conversationsResult.data ?? []) as ConversationRow[];
  const messages = (messagesResult.data ?? []) as MessageRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const reservations = (reservationsResult.data ?? []) as ReservationMetricRow[];
  const websiteEvents = (websiteEventsResult.data ?? []) as WebsiteAnalyticsRow[];

  const dayKeys = buildDayKeys(today, rangeDays);
  const metricsByDay = new Map(currentMetrics.map((row) => [row.day, row]));

  const usageSeries = dayKeys.map((day) => {
    const row = metricsByDay.get(day);
    return {
      day,
      conversations: row?.conversations_count ?? 0,
      messages: row?.messages_count ?? 0,
      aiMessages: row?.ai_messages_count ?? 0,
      humanMessages: row?.human_messages_count ?? 0,
      leads: row?.leads_count ?? 0,
      visitors: row?.visitors_count ?? 0,
      tokensIn: row?.tokens_in ?? 0,
      tokensOut: row?.tokens_out ?? 0,
      cost: Number((row?.ai_cost_usd ?? 0).toFixed(2))
    };
  });

  const totals = usageSeries.reduce(
    (acc, row) => {
      acc.conversations += row.conversations;
      acc.messages += row.messages;
      acc.leads += row.leads;
      acc.cost += row.cost;
      acc.tokensIn += row.tokensIn;
      acc.tokensOut += row.tokensOut;
      return acc;
    },
    { conversations: 0, messages: 0, leads: 0, cost: 0, tokensIn: 0, tokensOut: 0 }
  );

  const previousMetrics = metrics.filter((row) => row.day >= previousStart && row.day <= previousEnd);
  const previousTotals = previousMetrics.reduce(
    (acc, row) => {
      acc.conversations += toNumber(row.conversations_count);
      acc.leads += toNumber(row.leads_count);
      acc.tokensIn += toNumber(row.tokens_in);
      acc.tokensOut += toNumber(row.tokens_out);
      acc.cost += toNumber(row.ai_cost_usd);
      return acc;
    },
    { conversations: 0, leads: 0, tokensIn: 0, tokensOut: 0, cost: 0 }
  );

  const currentReservations = reservations.filter((row) => {
    const day = toDayKey(row.created_at);
    return day != null && day >= currentStart && day <= currentEnd && isReservationCountable(row.status);
  });
  const previousReservations = reservations.filter((row) => {
    const day = toDayKey(row.created_at);
    return day != null && day >= previousStart && day <= previousEnd && isReservationCountable(row.status);
  });

  const currentSessionIds = new Set(
    websiteEvents
      .filter((row) => {
        const day = toDayKey(row.occurred_at);
        return row.event_type === "page_view" && row.session_id && day != null && day >= currentStart && day <= currentEnd;
      })
      .map((row) => row.session_id as string)
  );
  const previousSessionIds = new Set(
    websiteEvents
      .filter((row) => {
        const day = toDayKey(row.occurred_at);
        return row.event_type === "page_view" && row.session_id && day != null && day >= previousStart && day <= previousEnd;
      })
      .map((row) => row.session_id as string)
  );

  const aiCostUsd = deriveAiCostUsd(totals.tokensIn, totals.tokensOut, totals.cost);
  const aiTokens = totals.tokensIn + totals.tokensOut;
  const conversationsCount = totals.conversations;
  const trendCurrent =
    currentSessionIds.size + totals.leads * 6 + currentReservations.length * 8 + conversationsCount * 2;
  const trendPrevious =
    previousSessionIds.size +
    previousTotals.leads * 6 +
    previousReservations.length * 8 +
    previousTotals.conversations * 2;
  const trendPct = percentChange(trendCurrent, trendPrevious);

  const leadTypeMap = new Map<string, number>();
  leads.forEach((lead) => {
    const key = lead.lead_type ?? "unknown";
    leadTypeMap.set(key, (leadTypeMap.get(key) ?? 0) + 1);
  });

  const responseTimes: number[] = [];
  const orderedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const lastVisitorByConversation = new Map<string, number>();

  orderedMessages.forEach((message) => {
    const timestamp = new Date(message.created_at).getTime();
    if (message.sender === "visitor") {
      lastVisitorByConversation.set(message.conversation_id, timestamp);
      return;
    }

    if (message.sender === "ai" || message.sender === "human") {
      const visitorAt = lastVisitorByConversation.get(message.conversation_id);
      if (visitorAt) {
        const diff = timestamp - visitorAt;
        if (diff >= 0) responseTimes.push(diff / 1000 / 60);
        lastVisitorByConversation.delete(message.conversation_id);
      }
    }
  });

  const responseMinutes =
    responseTimes.length > 0
      ? Number((responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(2))
      : null;
  const health = buildHealthScore({
    websiteSessions: currentSessionIds.size,
    leads: totals.leads,
    reservations: currentReservations.length,
    conversations: conversationsCount,
    messages: totals.messages,
    aiCostUsd,
    trendPct,
    responseMinutes
  });

  const latestMessageByConversation = new Map<string, MessageRow>();
  const messageCountByConversation = new Map<string, number>();

  messages.forEach((message) => {
    messageCountByConversation.set(message.conversation_id, (messageCountByConversation.get(message.conversation_id) ?? 0) + 1);
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message);
    }
  });

  return {
    range,
    business: {
      id: business.id,
      name: business.name ?? business.business_name ?? "Unnamed business",
      industry: business.industry,
      city: business.city,
      phone: business.phone,
      websiteUrl: business.website_url,
      plan: latestSub?.plan ?? business.plan ?? "trial",
      status: latestSub?.status ?? business.status ?? "active",
      createdAt: business.created_at,
      mrrEur: toNumber(latestSub?.mrr_eur)
    },
    usageSeries,
    snapshot: {
      websiteSessions: currentSessionIds.size,
      reservations: currentReservations.length,
      conversations: conversationsCount,
      messages: totals.messages,
      leads: totals.leads,
      visitors: usageSeries.reduce((sum, row) => sum + row.visitors, 0),
      aiCostUsd,
      aiTokens,
      avgCostPerConversation: conversationsCount > 0 ? Number((aiCostUsd / conversationsCount).toFixed(4)) : aiCostUsd,
      responseMinutes,
      trendPct,
      healthScore: health.total,
      scoreBreakdown: health.breakdown,
      topLeadTypes: Array.from(leadTypeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }))
    },
    reservations: currentReservations.map((reservation) => ({
      id: reservation.id,
      createdAt: reservation.created_at ?? reservation.datetime ?? "",
      dateTime: reservation.datetime ?? reservation.created_at ?? "",
      customerName: reservation.customer_name,
      partySize: reservation.party_size,
      status: reservation.status ?? "unknown"
    })),
    leads: leads.map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      leadType: lead.lead_type
    })),
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      channel: conversation.channel,
      visitorId: conversation.visitor_id,
      status: conversation.status,
      createdAt: conversation.created_at,
      lastMessageAt: conversation.last_message_at,
      messageCount: messageCountByConversation.get(conversation.id) ?? 0,
      latestMessage: latestMessageByConversation.get(conversation.id)?.content ?? null
    })),
    events: mapEvents(events, new Map([[business.id, business]]))
  };
}

export async function getAdminLiveData(): Promise<AdminLiveData> {
  const supabase = getSupabaseServerAdminClient();

  const [businessesResult, openConversationsResult, messagesResult, eventsResult] = await Promise.all([
    (supabase as any).from("businesses").select("id, name, business_name"),
    (supabase as any)
      .from("conversations")
      .select("id, business_id, channel, status, visitor_id, created_at, last_message_at")
      .eq("status", "open")
      .order("last_message_at", { ascending: false })
      .limit(120),
    (supabase as any)
      .from("messages")
      .select("id, conversation_id, business_id, sender, content, created_at")
      .order("created_at", { ascending: false })
      .limit(600),
    (supabase as any)
      .from("events")
      .select("id, business_id, type, title, body, severity, created_at")
      .order("created_at", { ascending: false })
      .limit(80)
  ]);

  const businesses = ((businessesResult.data ?? []) as BusinessRow[]).map((row) => ({
    ...row,
    name: row.name ?? row.business_name
  }));
  const businessMap = new Map(businesses.map((business) => [business.id, business]));

  const conversations = (openConversationsResult.data ?? []) as ConversationRow[];
  const messages = (messagesResult.data ?? []) as MessageRow[];

  const latestMessageByConversation = new Map<string, MessageRow>();
  messages.forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message);
    }
  });

  const activeConversations = conversations.map((conversation) => {
    const createdAt = new Date(conversation.created_at).getTime();
    const durationMinutes = Math.max(1, Math.round((Date.now() - createdAt) / (1000 * 60)));
    return {
      id: conversation.id,
      businessId: conversation.business_id,
      businessName:
        businessMap.get(conversation.business_id)?.name ??
        businessMap.get(conversation.business_id)?.business_name ??
        "Unknown business",
      channel: conversation.channel,
      status: conversation.status,
      visitorId: conversation.visitor_id,
      createdAt: conversation.created_at,
      lastMessageAt: conversation.last_message_at,
      latestMessage: latestMessageByConversation.get(conversation.id)?.content ?? null,
      durationMinutes
    };
  });

  const mappedEvents = mapEvents((eventsResult.data ?? []) as EventRow[], businessMap);

  return {
    activeConversations,
    events: mappedEvents,
    systemHealth: {
      realtimeConnected: true,
      lastEventAt: mappedEvents[0]?.createdAt ?? null
    }
  };
}

export async function getAdminConversationsData(filters?: {
  businessId?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<AdminConversationRow[]> {
  const supabase = getSupabaseServerAdminClient();

  let query = (supabase as any)
    .from("conversations")
    .select("id, business_id, channel, status, visitor_id, created_at, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (filters?.businessId) query = query.eq("business_id", filters.businessId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);

  const [{ data: conversations }, { data: businesses }, { data: messages }] = await Promise.all([
    query,
    (supabase as any).from("businesses").select("id, name, business_name"),
    (supabase as any)
      .from("messages")
      .select("conversation_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(2000)
  ]);

  const businessMap = new Map(((businesses ?? []) as BusinessRow[]).map((row) => [row.id, row]));
  const latestMessageByConversation = new Map<string, string>();
  const messageCountByConversation = new Map<string, number>();

  ((messages ?? []) as Array<{ conversation_id: string; content: string; created_at: string }>).forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message.content);
    }
    messageCountByConversation.set(message.conversation_id, (messageCountByConversation.get(message.conversation_id) ?? 0) + 1);
  });

  return ((conversations ?? []) as ConversationRow[]).map((conversation) => ({
    id: conversation.id,
    businessId: conversation.business_id,
    businessName:
      businessMap.get(conversation.business_id)?.name ??
      businessMap.get(conversation.business_id)?.business_name ??
      "Unknown business",
    channel: conversation.channel,
    status: conversation.status,
    visitorId: conversation.visitor_id,
    createdAt: conversation.created_at,
    lastMessageAt: conversation.last_message_at,
    messageCount: messageCountByConversation.get(conversation.id) ?? 0,
    latestMessage: latestMessageByConversation.get(conversation.id) ?? null
  }));
}

export async function getAdminRevenueData(rangeInput?: string | null): Promise<RevenueData> {
  const range = normalizeRange(rangeInput ?? "90d");
  const rangeDays = ADMIN_RANGE_DAYS[range];
  const today = toDateOnly(new Date());
  const dayKeys = buildDayKeys(today, rangeDays);

  const supabase = getSupabaseServerAdminClient();
  const subscriptions = await fetchBillingSubscriptionRows(supabase as any, { all: true, limit: 10000 });
  const latestSubs = latestByBusiness(subscriptions);

  const mrrSeries = buildSubscriptionMrrSeries(dayKeys, latestSubs);
  const newMrrSeries = dayKeys.map((day) =>
    subscriptions
      .filter((subscription) => toYmd(subscription.created_at) === day)
      .filter((subscription) => {
        const status = (subscription.status ?? "").toLowerCase();
        return status === "active" || status === "past_due";
      })
      .reduce((sum, subscription) => sum + toNumber(subscription.mrr_eur), 0)
  );
  const churnedMrrSeries = dayKeys.map((day) =>
    subscriptions
      .filter((subscription) => subscription.updated_at && toYmd(subscription.updated_at) === day)
      .filter((subscription) => (subscription.status ?? "").toLowerCase() === "canceled")
      .reduce((sum, subscription) => sum + toNumber(subscription.mrr_eur), 0)
  );

  const paid = Array.from(latestSubs.values()).filter((subscription) => {
    const status = (subscription.status ?? "").toLowerCase();
    return status === "active" || status === "past_due";
  }).length;
  const trialing = Array.from(latestSubs.values()).filter((subscription) => (subscription.status ?? "").toLowerCase() === "trialing").length;

  const planDistributionMap = new Map<string, number>();
  Array.from(latestSubs.values()).forEach((subscription) => {
    const plan = subscription.plan ?? "unknown";
    planDistributionMap.set(plan, (planDistributionMap.get(plan) ?? 0) + 1);
  });

  return {
    range,
    summary: {
      mrrEur: mrrSeries[mrrSeries.length - 1] ?? 0,
      newMrrEur: newMrrSeries.reduce((sum, value) => sum + value, 0),
      churnedMrrEur: churnedMrrSeries.reduce((sum, value) => sum + value, 0),
      conversionRate: paid + trialing > 0 ? (paid / (paid + trialing)) * 100 : 0
    },
    series: dayKeys.map((day, index) => ({
      day,
      mrr: Number((mrrSeries[index] ?? 0).toFixed(2)),
      newMrr: Number((newMrrSeries[index] ?? 0).toFixed(2)),
      churnedMrr: Number((churnedMrrSeries[index] ?? 0).toFixed(2))
    })),
    planDistribution: Array.from(planDistributionMap.entries()).map(([name, value]) => ({ name, value }))
  };
}

export async function getAdminCostsData(rangeInput?: string | null): Promise<CostsData> {
  const range = normalizeRange(rangeInput ?? "30d");
  const rangeDays = ADMIN_RANGE_DAYS[range];
  const today = toDateOnly(new Date());
  const fromDay = toYmd(addDays(today, -(rangeDays - 1)));
  const baselineFromDay = toYmd(addDays(today, -13));

  const supabase = getSupabaseServerAdminClient();

  const [businessesResult, metricsResult] = await Promise.all([
    (supabase as any).from("businesses").select("id, name, business_name"),
    (supabase as any)
      .from("business_metrics_daily")
      .select(
        "business_id, day, conversations_count, messages_count, ai_messages_count, human_messages_count, leads_count, visitors_count, tokens_in, tokens_out, ai_cost_usd"
      )
      .gte("day", baselineFromDay)
      .order("day", { ascending: true })
  ]);

  const businesses = ((businessesResult.data ?? []) as BusinessRow[]).map((row) => ({
    ...row,
    name: row.name ?? row.business_name
  }));
  const businessMap = new Map(businesses.map((business) => [business.id, business]));
  const metrics = (metricsResult.data ?? []) as DailyMetricRow[];

  const currentRows = metrics.filter((row) => row.day >= fromDay && row.day <= toYmd(today));

  const totalAiCostUsd = currentRows.reduce((sum, row) => sum + toNumber(row.ai_cost_usd), 0);

  const costByBusiness = Array.from(
    currentRows.reduce((map, row) => {
      map.set(row.business_id, (map.get(row.business_id) ?? 0) + toNumber(row.ai_cost_usd));
      return map;
    }, new Map<string, number>())
  )
    .map(([businessId, cost]) => ({
      businessId,
      businessName: businessMap.get(businessId)?.name ?? businessMap.get(businessId)?.business_name ?? "Unknown business",
      cost: Number(cost.toFixed(2))
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 12);

  const anomalies = Array.from(
    metrics.reduce((map, row) => {
      if (!map.has(row.business_id)) map.set(row.business_id, [] as DailyMetricRow[]);
      map.get(row.business_id)?.push(row);
      return map;
    }, new Map<string, DailyMetricRow[]>())
  )
    .map(([businessId, rows]) => {
      const todayCost = rows.filter((row) => row.day === toYmd(today)).reduce((sum, row) => sum + toNumber(row.ai_cost_usd), 0);
      const baselineRows = rows.filter((row) => row.day >= toYmd(addDays(today, -7)) && row.day < toYmd(today));
      const baseline = baselineRows.length
        ? baselineRows.reduce((sum, row) => sum + toNumber(row.ai_cost_usd), 0) / baselineRows.length
        : 0;
      return {
        businessId,
        businessName: businessMap.get(businessId)?.name ?? businessMap.get(businessId)?.business_name ?? "Unknown business",
        todayCost,
        baselineCost: baseline,
        ratio: baseline > 0 ? todayCost / baseline : 0
      };
    })
    .filter((row) => row.baselineCost > 0 && row.ratio >= 2)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8)
    .map((row) => ({
      ...row,
      todayCost: Number(row.todayCost.toFixed(2)),
      baselineCost: Number(row.baselineCost.toFixed(2)),
      ratio: Number(row.ratio.toFixed(2))
    }));

  const dayKeys = buildDayKeys(today, rangeDays);
  const totalsByDay = buildDailyTotals(currentRows);

  return {
    range,
    totalAiCostUsd: Number(totalAiCostUsd.toFixed(2)),
    costByBusiness,
    anomalies,
    series: dayKeys.map((day) => ({
      day,
      cost: Number((totalsByDay.get(day)?.ai_cost_usd ?? 0).toFixed(2)),
      tokensIn: totalsByDay.get(day)?.tokens_in ?? 0,
      tokensOut: totalsByDay.get(day)?.tokens_out ?? 0
    }))
  };
}
