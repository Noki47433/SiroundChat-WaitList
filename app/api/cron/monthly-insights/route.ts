import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { getRollingRangeInTimeZone } from "@/lib/utils/timezone";

const MONTHLY_MESSAGE_THRESHOLD = 40;
const MONTHLY_LEAD_THRESHOLD = 3;
const MONTHLY_RESERVATION_THRESHOLD = 3;

const getMonthKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatCurrency = (amount: number, currency: string) => {
  const rounded = Math.round(amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(rounded);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(rounded);
  }
};

const isAuthorized = (request: Request) => {
  const secret = request.headers.get("x-cron-secret");
  return Boolean(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
};

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const now = new Date();
  const monthKey = getMonthKey(now);

  const { data: businesses, error: businessesError } = await (admin as any)
    .from("businesses")
    .select("id, timezone");

  if (businessesError) {
    return NextResponse.json({ error: businessesError.message }, { status: 500 });
  }

  if (!businesses?.length) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  const ranges = new Map<string, { monthStart: Date }>();
  let earliestStart = now;

  businesses.forEach((business: { id: string; timezone?: string | null }) => {
    const timeZone = business.timezone ?? "UTC";
    const { start: monthStart } = getRollingRangeInTimeZone(timeZone, 30);
    if (monthStart < earliestStart) {
      earliestStart = monthStart;
    }
    ranges.set(business.id, { monthStart });
  });

  const { data: events, error: eventsError } = await (admin as any)
    .from("analytics_events")
    .select("business_id, type, timestamp")
    .gte("timestamp", earliestStart.toISOString())
    .in("type", ["message_received", "lead_created", "reservation_created"]);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  type BizMetrics = { messages30: number; leads30: number; reservations30: number };
  const metrics = new Map<string, BizMetrics>();
  const getMetrics = (businessId: string) => {
    const existing = metrics.get(businessId);
    if (existing) return existing;
    const created = { messages30: 0, leads30: 0, reservations30: 0 };
    metrics.set(businessId, created);
    return created;
  };

  (events ?? []).forEach((event: any) => {
    const businessId = event.business_id as string;
    const range = ranges.get(businessId);
    if (!range) return;

    const createdAt = new Date(event.timestamp);
    if (Number.isNaN(createdAt.getTime())) return;
    if (createdAt < range.monthStart) return;

    const bucket = getMetrics(businessId);
    if (event.type === "message_received") bucket.messages30 += 1;
    if (event.type === "lead_created") bucket.leads30 += 1;
    if (event.type === "reservation_created") bucket.reservations30 += 1;
  });

  let processed = 0;

  for (const [businessId, bucket] of metrics.entries()) {
    const hasActivity =
      bucket.messages30 >= MONTHLY_MESSAGE_THRESHOLD ||
      bucket.leads30 >= MONTHLY_LEAD_THRESHOLD ||
      bucket.reservations30 >= MONTHLY_RESERVATION_THRESHOLD;

    if (!hasActivity) {
      continue;
    }

    processed += 1;

    const { data: existingSettings } = await (admin as any)
      .from("business_notification_settings")
      .select("avg_order_value, close_rate, currency")
      .eq("business_id", businessId)
      .maybeSingle();

    let settings = existingSettings ?? null;
    if (!settings) {
      const { data: created } = await (admin as any)
        .from("business_notification_settings")
        .insert({ business_id: businessId })
        .select("avg_order_value, close_rate, currency")
        .single();
      settings = created ?? null;
    }

    const hasLeadsOrReservations = bucket.leads30 > 0 || bucket.reservations30 > 0;

    if (!settings || settings.avg_order_value === null || settings.close_rate === null) {
      if (hasLeadsOrReservations) {
        await createNotificationIfNotExists(
          businessId,
          {
            title: "Set your estimates to unlock revenue insights",
            body: "Add your average order value and close rate to see estimated revenue from SiroundChat.",
            severity: "info",
            category: "insight",
            cta_label: "Update settings",
            cta_url: "/dashboard/settings",
            data: {}
          },
          "monthly_insight_setup",
          `monthly_${monthKey}-${businessId}-setup`
        );
      }
      continue;
    }

    if (bucket.leads30 <= 0) {
      continue;
    }

    const estimated = bucket.leads30 * Number(settings.close_rate) * Number(settings.avg_order_value);
    const currency = settings.currency ?? "EUR";
    const formatted = formatCurrency(estimated, currency);

    await createNotificationIfNotExists(
      businessId,
      {
        title: "Estimated revenue from chat leads",
        body: `Based on ${bucket.leads30} leads, your estimated revenue is ${formatted} this month.`,
        severity: "success",
        category: "revenue",
        cta_label: "View leads",
        cta_url: "/dashboard/leads",
        data: { estimated_revenue: estimated, leads: bucket.leads30, currency }
      },
      "monthly_insight_estimate",
      `monthly_${monthKey}-${businessId}-estimate`
    );
  }

  return NextResponse.json({ success: true, processed });
}

export { handle as GET, handle as POST };
