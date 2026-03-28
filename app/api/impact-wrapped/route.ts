import { NextResponse } from "next/server";
import { canAccessBillingWorkspace } from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import type { Period, WrappedRaw } from "@/lib/wrapped/computeWrapped";

export const runtime = "nodejs";

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const getPeriodRange = (period: Period) => {
  const now = new Date();
  const days = period === "weekly" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return { start, end: now };
};

const buildMock = (period: Period): WrappedRaw => {
  const { start, end } = getPeriodRange(period);
  return {
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    lastUpdated: end.toISOString(),
    revenueInfluencedCents: 3400,
    leadsCount: 4,
    reservationsCount: 1,
    customersHelpedCount: 1,
    timeSavedMinutes: 4,
    peakDayISO: period === "monthly" ? new Date(end.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString() : null,
    peakDayLeads: period === "monthly" ? 2 : null,
    topQuestion: period === "monthly" ? "Do you have availability tomorrow at 8?" : null,
    topIntent: period === "monthly" ? "Reservations" : null,
    mvpConversation: {
      id: "mock-convo",
      customerQuestion: "Do you have availability tomorrow at 8?",
      botResponse: "Yes — want indoor or outdoor seating?",
      outcomeLabel: "Reservation captured"
    },
    prevRevenueInfluencedCents: period === "monthly" ? 2800 : 3000,
    prevLeadsCount: period === "monthly" ? 3 : 2,
    prevReservationsCount: period === "monthly" ? 1 : 0,
    prevTimeSavedMinutes: period === "monthly" ? 3 : 2
  };
};

const buildEmpty = (period: Period): WrappedRaw => {
  const { start, end } = getPeriodRange(period);
  return {
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    lastUpdated: end.toISOString(),
    revenueInfluencedCents: null,
    leadsCount: null,
    reservationsCount: null,
    customersHelpedCount: null,
    timeSavedMinutes: null,
    peakDayISO: null,
    peakDayLeads: null,
    topQuestion: null,
    topIntent: null,
    mvpConversation: null,
    prevRevenueInfluencedCents: null,
    prevLeadsCount: null,
    prevReservationsCount: null,
    prevTimeSavedMinutes: null
  };
};

const getDemoBusinessId = () => {
  const value =
    process.env.WRAPPED_DEMO_BUSINESS_ID ??
    process.env.NEXT_PUBLIC_WRAPPED_DEMO_BUSINESS_ID ??
    "";
  return value.trim() || null;
};

const getKiaKosovaDemoWrapped = (period: Period): WrappedRaw => {
  if (period === "weekly") {
    return {
      period,
      periodStart: "2026-01-14T00:00:00.000Z",
      periodEnd: "2026-01-21T23:59:59.999Z",
      lastUpdated: "2026-01-21T18:54:00.000Z",
      revenueInfluencedCents: 45000,
      leadsCount: 28,
      reservationsCount: 9,
      customersHelpedCount: 41,
      timeSavedMinutes: 198,
      peakDayISO: "2026-01-18",
      peakDayLeads: 9,
      topQuestion: "A keni KIA Sportage në stok dhe sa kushton?",
      topIntent: "Test drive booking",
      mvpConversation: {
        id: "demo-kia-mvp-001",
        customerQuestion: "A mund ta rezervoj një test drive për KIA Sportage këtë të premte në ora 16:00?",
        botResponse: "Po. A preferoni Prishtinë apo Fushë Kosovë? Dhe a jeni i interesuar për benzine apo dizel?",
        outcomeLabel: "Reservation captured"
      },
      prevRevenueInfluencedCents: 37000,
      prevLeadsCount: 21,
      prevReservationsCount: 6,
      prevTimeSavedMinutes: 152
    };
  }

  return {
    period,
    periodStart: "2025-12-22T00:00:00.000Z",
    periodEnd: "2026-01-21T23:59:59.999Z",
    lastUpdated: "2026-01-21T18:54:00.000Z",
    revenueInfluencedCents: 186000,
    leadsCount: 112,
    reservationsCount: 37,
    customersHelpedCount: 164,
    timeSavedMinutes: 792,
    peakDayISO: "2026-01-07",
    peakDayLeads: 14,
    topQuestion: "Sa është kësti mujor për KIA Sportage me financim?",
    topIntent: "Financing inquiry",
    mvpConversation: {
      id: "demo-kia-mvp-002",
      customerQuestion: "A keni ofertë financimi për KIA Ceed dhe sa është kësti mujor?",
      botResponse: "Po. A mund ta di buxhetin tuaj mujor dhe a preferoni periudhë 36 apo 60 muaj?",
      outcomeLabel: "Lead captured"
    },
    prevRevenueInfluencedCents: 142000,
    prevLeadsCount: 89,
    prevReservationsCount: 24,
    prevTimeSavedMinutes: 610
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId");
  const period = url.searchParams.get("period") as Period | null;
  const forceMock = url.searchParams.get("mock") === "1";
  const forceDemo = url.searchParams.get("demo") === "1";

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

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

  const canAccess = await canAccessBillingWorkspace(user.id, businessId);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const demoBusinessId = getDemoBusinessId();
  const matchesDemoBusiness =
    businessId.toLowerCase().includes("kia") || (demoBusinessId ? businessId === demoBusinessId : false);
  const useDemo = forceDemo || process.env.NEXT_PUBLIC_WRAPPED_DEMO === "1" || matchesDemoBusiness;

  if (useDemo) {
    return NextResponse.json({ ok: true, data: getKiaKosovaDemoWrapped(period), demo: true });
  }

  const useMock = forceMock || process.env.NEXT_PUBLIC_WRAPPED_MOCK === "1";

  if (useMock) {
    return NextResponse.json({ ok: true, data: buildMock(period), mock: true });
  }

  const { data: summaries, error } = await (supabase as any)
    .from("business_impact_summaries")
    .select("*")
    .eq("business_id", businessId)
    .eq("period", period)
    .order("period_start", { ascending: false })
    .limit(2);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const current = summaries?.[0] ?? null;
  const previous = summaries?.[1] ?? null;

  if (!current) {
    return NextResponse.json({ ok: true, data: buildEmpty(period), mock: false, empty: true });
  }

  const metrics = (current.metrics ?? {}) as Record<string, unknown>;
  const prevMetrics = (previous?.metrics ?? {}) as Record<string, unknown>;

  const revenueEstimated = asNumber(metrics.revenue_estimated);
  const prevRevenueEstimated = asNumber(prevMetrics.revenue_estimated);
  const leadsCount = asNumber(metrics.leads);
  const reservationsCount = asNumber(metrics.reservations);
  const helpedCount = asNumber(metrics.helped_conversations);
  const hasRevenueSignals = (leadsCount ?? 0) + (reservationsCount ?? 0) > 0;

  const raw: WrappedRaw = {
    period,
    periodStart: current.period_start ?? new Date().toISOString(),
    periodEnd: current.period_end ?? new Date().toISOString(),
    lastUpdated: current.created_at ?? new Date().toISOString(),
    revenueInfluencedCents:
      revenueEstimated === null || !hasRevenueSignals ? null : Math.round(revenueEstimated * 100),
    leadsCount,
    reservationsCount,
    customersHelpedCount: helpedCount && helpedCount > 0 ? helpedCount : null,
    timeSavedMinutes: helpedCount && helpedCount > 0 ? asNumber(metrics.time_saved_minutes) : null,
    peakDayISO: typeof metrics.peak_day_iso === "string" ? metrics.peak_day_iso : null,
    peakDayLeads: asNumber(metrics.peak_day_leads),
    topQuestion: typeof metrics.top_question === "string" ? metrics.top_question : null,
    topIntent: typeof metrics.top_intent === "string" ? metrics.top_intent : null,
    mvpConversation: null,
    prevRevenueInfluencedCents: prevRevenueEstimated === null ? null : Math.round(prevRevenueEstimated * 100),
    prevLeadsCount: asNumber(prevMetrics.leads),
    prevReservationsCount: asNumber(prevMetrics.reservations),
    prevTimeSavedMinutes: asNumber(prevMetrics.time_saved_minutes)
  };

  return NextResponse.json({ ok: true, data: raw, mock: false });
}
