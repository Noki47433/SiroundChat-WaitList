import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeHealthScore, getWeekStartMonday, percentile50, toISODate } from "@/lib/health/weekly";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

const isAuthorized = (request: Request) => {
  const secret = request.headers.get("x-cron-secret");
  return Boolean(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
};

type AggregateMap = Map<string, number>;

const increment = (map: AggregateMap, key: string, value = 1) => {
  map.set(key, (map.get(key) ?? 0) + value);
};

const computeAverageResponseSecondsByBusiness = (rows: Array<{ business_id: string; sender: string; created_at: string }>) => {
  const lastUserByBusinessConversation = new Map<string, number>();
  const samplesByBusiness = new Map<string, number[]>();

  for (const row of rows) {
    const stamp = new Date(row.created_at).getTime();
    if (!Number.isFinite(stamp)) continue;
    const key = `${row.business_id}::${row.sender === "assistant" ? "assistant" : "user"}::${row.created_at}`;
    void key;
    const convKey = `${row.business_id}::${(row as any).conversation_id ?? ""}`;
    if (row.sender === "user") {
      lastUserByBusinessConversation.set(convKey, stamp);
      continue;
    }
    if (row.sender === "assistant" || row.sender === "ai") {
      const lastUser = lastUserByBusinessConversation.get(convKey);
      if (!lastUser || stamp < lastUser) continue;
      const seconds = (stamp - lastUser) / 1000;
      const samples = samplesByBusiness.get(row.business_id) ?? [];
      samples.push(seconds);
      samplesByBusiness.set(row.business_id, samples);
      lastUserByBusinessConversation.delete(convKey);
    }
  }

  const avgByBusiness = new Map<string, number>();
  for (const [businessId, samples] of samplesByBusiness.entries()) {
    if (!samples.length) {
      avgByBusiness.set(businessId, 0);
      continue;
    }
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    avgByBusiness.set(businessId, Math.round(avg));
  }
  return avgByBusiness;
};

const getGlobalUptimeRatio = async (admin: any, startIso: string, endIso: string) => {
  const { data: incidents } = await (admin as any)
    .from("status_incidents")
    .select("started_at, resolved_at")
    .eq("is_public", true)
    .not("resolved_at", "is", null)
    .lte("started_at", endIso)
    .gte("resolved_at", startIso);

  const windowStart = new Date(startIso).getTime();
  const windowEnd = new Date(endIso).getTime();
  const windowMinutes = Math.max(1, (windowEnd - windowStart) / (1000 * 60));

  let incidentMinutes = 0;
  for (const incident of incidents ?? []) {
    const started = new Date(incident.started_at).getTime();
    const resolved = new Date(incident.resolved_at).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(resolved)) continue;
    const start = Math.max(started, windowStart);
    const end = Math.min(resolved, windowEnd);
    if (end <= start) continue;
    incidentMinutes += (end - start) / (1000 * 60);
  }

  const uptime = 1 - incidentMinutes / windowMinutes;
  return Math.max(0, Math.min(1, Number(uptime.toFixed(4))));
};

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  const now = new Date();
  const thisWeekStart = getWeekStartMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * DAY_MS);
  const startIso = lastWeekStart.toISOString();
  const endIso = thisWeekStart.toISOString();
  const weekStartDate = toISODate(lastWeekStart);

  const [businessesResult, conversationsResult, leadsResult, reservationsResult, intentsResult, errorsResult, messagesResult] =
    await Promise.all([
      (admin as any).from("businesses").select("id, industry"),
      (admin as any).from("chat_conversations").select("business_id").gte("created_at", startIso).lt("created_at", endIso),
      (admin as any).from("leads").select("business_id").gte("created_at", startIso).lt("created_at", endIso),
      (admin as any)
        .from("reservations")
        .select("business_id, status")
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      (admin as any)
        .from("analytics_events")
        .select("business_id, type")
        .gte("timestamp", startIso)
        .lt("timestamp", endIso)
        // If intent signals are not emitted in this workspace, missed intents stay at 0 by design.
        .in("type", ["booking_intent_detected", "booking_intent", "intent_booking"]),
      (admin as any).from("error_events").select("business_id").gte("created_at", startIso).lt("created_at", endIso),
      (admin as any)
        .from("chat_messages")
        .select("conversation_id, sender, created_at, chat_conversations!inner(business_id)")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: true })
    ]);

  if (businessesResult.error) {
    return NextResponse.json({ error: businessesResult.error.message }, { status: 500 });
  }

  const businesses = (businessesResult.data ?? []) as Array<{ id: string; industry: string | null }>;
  if (!businesses.length) {
    return NextResponse.json({ success: true, processed: 0, week_start: weekStartDate }, { status: 200 });
  }

  const conversationCounts: AggregateMap = new Map();
  const leadCounts: AggregateMap = new Map();
  const bookingCounts: AggregateMap = new Map();
  const intentCounts: AggregateMap = new Map();
  const errorCounts: AggregateMap = new Map();

  for (const row of conversationsResult.data ?? []) {
    if (!row.business_id) continue;
    increment(conversationCounts, row.business_id);
  }
  for (const row of leadsResult.data ?? []) {
    if (!row.business_id) continue;
    increment(leadCounts, row.business_id);
  }
  for (const row of reservationsResult.data ?? []) {
    if (!row.business_id) continue;
    if (row.status === "cancelled" || row.status === "canceled" || row.status === "no_show") continue;
    increment(bookingCounts, row.business_id);
  }
  for (const row of intentsResult.data ?? []) {
    if (!row.business_id) continue;
    increment(intentCounts, row.business_id);
  }
  for (const row of errorsResult.data ?? []) {
    if (!row.business_id) continue;
    increment(errorCounts, row.business_id);
  }

  const responseRows = ((messagesResult.data ?? []) as any[]).map((row) => ({
    conversation_id: row.conversation_id as string,
    sender: row.sender as string,
    created_at: row.created_at as string,
    business_id: row.chat_conversations?.business_id as string
  }));

  const avgResponseByBusiness = computeAverageResponseSecondsByBusiness(responseRows);
  const uptimeRatio = await getGlobalUptimeRatio(admin, startIso, endIso);

  const upserts = businesses.map((business) => {
    const conversationsCount = conversationCounts.get(business.id) ?? 0;
    const leadsCount = leadCounts.get(business.id) ?? 0;
    const bookingsCount = bookingCounts.get(business.id) ?? 0;
    const intentsCount = intentCounts.get(business.id) ?? 0;
    const missedIntentsCount = Math.max(0, intentsCount - Math.max(leadsCount, bookingsCount));
    const errorEventsCount = errorCounts.get(business.id) ?? 0;
    const avgResponseTimeSec = avgResponseByBusiness.get(business.id) ?? 0;

    const healthScore = computeHealthScore({
      conversationsCount,
      bookingsCount,
      missedIntentsCount,
      avgResponseTimeSec,
      errorEventsCount
    });

    return {
      week_start: weekStartDate,
      business_id: business.id,
      conversations_count: conversationsCount,
      leads_count: leadsCount,
      bookings_count: bookingsCount,
      missed_intents_count: missedIntentsCount,
      avg_response_time_sec: avgResponseTimeSec,
      error_events_count: errorEventsCount,
      uptime_ratio: uptimeRatio,
      health_score: healthScore,
      computed_at: new Date().toISOString()
    };
  });

  const { error: upsertError } = await (admin as any)
    .from("business_weekly_metrics")
    .upsert(upserts, { onConflict: "business_id,week_start" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const byIndustry = new Map<
    string,
    Array<{
      conversations: number;
      leads: number;
      bookings: number;
      conversion: number;
      health: number;
    }>
  >();

  for (const row of upserts) {
    const business = businesses.find((item) => item.id === row.business_id);
    const industry = (business?.industry ?? "general").trim() || "general";
    const current = byIndustry.get(industry) ?? [];
    const conversion = row.conversations_count > 0 ? row.bookings_count / row.conversations_count : 0;
    current.push({
      conversations: row.conversations_count,
      leads: row.leads_count,
      bookings: row.bookings_count,
      conversion,
      health: row.health_score
    });
    byIndustry.set(industry, current);
  }

  const benchmarkUpserts = Array.from(byIndustry.entries()).map(([industry, rows]) => ({
    week_start: weekStartDate,
    industry,
    conversations_p50: Math.round(percentile50(rows.map((item) => item.conversations))),
    leads_p50: Math.round(percentile50(rows.map((item) => item.leads))),
    bookings_p50: Math.round(percentile50(rows.map((item) => item.bookings))),
    conversion_p50: Number(percentile50(rows.map((item) => item.conversion)).toFixed(4)),
    health_p50: Math.round(percentile50(rows.map((item) => item.health)))
  }));

  if (benchmarkUpserts.length) {
    const { error: benchmarkError } = await (admin as any)
      .from("industry_benchmarks_weekly")
      .upsert(benchmarkUpserts, { onConflict: "industry,week_start" });
    if (benchmarkError) {
      return NextResponse.json({ error: benchmarkError.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      success: true,
      processed: upserts.length,
      industries: benchmarkUpserts.length,
      week_start: weekStartDate
    },
    { status: 200 }
  );
}

export { handle as GET, handle as POST };
