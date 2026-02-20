import { NextResponse } from "next/server";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { addDays, getRollingRangeInTimeZone } from "@/lib/utils/timezone";

export const runtime = "nodejs";

const ACTIVITY_MESSAGE_THRESHOLD = 10;
const REVENUE_RESERVATION_THRESHOLD = 3;
const REVENUE_LEAD_THRESHOLD = 3;
const CONTACT_INTENT_THRESHOLD = 3;

const getWeekKey = (date: Date) => `${getISOWeekYear(date)}-W${getISOWeek(date)}`;

const isAuthorized = (request: Request) => {
  const secret = request.headers.get("x-cron-secret");
  return Boolean(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
};

type TopicStats = { total30: number; week7: number; prev7: number };
type BizMetrics = {
  messageReceived7: number;
  leadCreated7: number;
  reservationCreated7: number;
  contactIntent7: number;
  topics: Map<string, TopicStats>;
};

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const now = new Date();

  const { data: businesses, error: businessesError } = await (admin as any)
    .from("businesses")
    .select("id, timezone");

  if (businessesError) {
    return NextResponse.json({ error: businessesError.message }, { status: 500 });
  }

  if (!businesses?.length) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  const ranges = new Map<
    string,
    { weekStart: Date; prevWeekStart: Date; monthStart: Date; timeZone: string }
  >();

  let earliestStart = now;

  for (const business of businesses as Array<{ id: string; timezone?: string | null }>) {
    const timeZone = business.timezone ?? "UTC";
    const { start: weekStart } = getRollingRangeInTimeZone(timeZone, 7);
    const prevWeekStart = addDays(weekStart, -7);
    const { start: monthStart } = getRollingRangeInTimeZone(timeZone, 30);

    if (monthStart < earliestStart) {
      earliestStart = monthStart;
    }

    ranges.set(business.id, { weekStart, prevWeekStart, monthStart, timeZone });
  }

  const { data: events, error: eventsError } = await (admin as any)
    .from("analytics_events")
    .select("business_id, type, timestamp, metadata")
    .gte("timestamp", earliestStart.toISOString())
    .in("type", [
      "message_received",
      "lead_created",
      "reservation_created",
      "contact_intent_detected",
      "topic_mentioned"
    ]);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const metrics = new Map<string, BizMetrics>();

  const getMetrics = (businessId: string): BizMetrics => {
    const existing = metrics.get(businessId);
    if (existing) return existing;

    // IMPORTANT: type the Map to avoid TS inferring `never`
    const created: BizMetrics = {
      messageReceived7: 0,
      leadCreated7: 0,
      reservationCreated7: 0,
      contactIntent7: 0,
      topics: new Map<string, TopicStats>()
    };

    metrics.set(businessId, created);
    return created;
  };

  for (const event of (events ?? []) as any[]) {
    const businessId = typeof event.business_id === "string" ? event.business_id : "";
    if (!businessId) continue;

    const range = ranges.get(businessId);
    if (!range) continue;

    const createdAt = new Date(event.timestamp);
    if (Number.isNaN(createdAt.getTime())) continue;

    const withinWeek = createdAt >= range.weekStart;
    const withinPrevWeek = createdAt >= range.prevWeekStart && createdAt < range.weekStart;
    const withinMonth = createdAt >= range.monthStart;

    const bucket = getMetrics(businessId);

    switch (event.type) {
      case "message_received":
        if (withinWeek) bucket.messageReceived7 += 1;
        break;

      case "lead_created":
        if (withinWeek) bucket.leadCreated7 += 1;
        break;

      case "reservation_created":
        if (withinWeek) bucket.reservationCreated7 += 1;
        break;

      case "contact_intent_detected":
        if (withinWeek) bucket.contactIntent7 += 1;
        break;

      case "topic_mentioned": {
        if (!withinMonth) break;

        const topic = event?.metadata?.topic;
        if (typeof topic !== "string") break;

        const cleaned = topic.trim();
        if (!cleaned) break;

        const stat = bucket.topics.get(cleaned) ?? { total30: 0, week7: 0, prev7: 0 };
        stat.total30 += 1;
        if (withinWeek) stat.week7 += 1;
        if (withinPrevWeek) stat.prev7 += 1;
        bucket.topics.set(cleaned, stat);
        break;
      }

      default:
        break;
    }
  }

  const weekKey = getWeekKey(now);
  let processed = 0;

  for (const [businessId, bucket] of metrics.entries()) {
    const hasActivity =
      bucket.messageReceived7 >= ACTIVITY_MESSAGE_THRESHOLD ||
      bucket.leadCreated7 >= 1 ||
      bucket.reservationCreated7 >= 1;

    if (!hasActivity) continue;

    processed += 1;

    // Revenue insight
    if (bucket.reservationCreated7 >= REVENUE_RESERVATION_THRESHOLD) {
      const title = `This week SiroundChat created ${bucket.reservationCreated7} reservations!`;
      await createNotificationIfNotExists(
        businessId,
        {
          title,
          body: title,
          severity: "success",
          category: "revenue",
          cta_label: "View reservations",
          cta_url: "/dashboard/reservations",
          data: { count: bucket.reservationCreated7 }
        },
        "weekly_insight_revenue",
        `weekly_${weekKey}-${businessId}-reservations`
      );
    } else if (bucket.leadCreated7 >= REVENUE_LEAD_THRESHOLD) {
      const title = `You captured ${bucket.leadCreated7} new leads this week.`;
      await createNotificationIfNotExists(
        businessId,
        {
          title,
          body: title,
          severity: "success",
          category: "revenue",
          cta_label: "View leads",
          cta_url: "/dashboard/leads",
          data: { count: bucket.leadCreated7 }
        },
        "weekly_insight_revenue",
        `weekly_${weekKey}-${businessId}-leads`
      );
    } else if (bucket.contactIntent7 >= CONTACT_INTENT_THRESHOLD) {
      const title = `Visitors asked for your contact ${bucket.contactIntent7} times this week.`;
      await createNotificationIfNotExists(
        businessId,
        {
          title,
          body: title,
          severity: "success",
          category: "revenue",
          cta_label: "View conversations",
          cta_url: "/dashboard/conversations",
          data: { count: bucket.contactIntent7 }
        },
        "weekly_insight_revenue",
        `weekly_${weekKey}-${businessId}-contact`
      );
    }

    // Product insight: trending topic -> suggest adding to FAQ
    let chosenTopic: string | null = null;
    let chosenScore = 0;

    for (const [topic, stats] of bucket.topics.entries()) {
      const spike = stats.prev7 > 0 && stats.week7 >= stats.prev7 * 2;
      const trending = stats.total30 >= 10 || spike;
      if (!trending) continue;

      const score = stats.total30 + stats.week7;
      if (score > chosenScore) {
        chosenScore = score;
        chosenTopic = topic;
      }
    }

    const safeTopic = typeof chosenTopic === "string" ? chosenTopic.trim() : "";
    if (safeTopic) {
      const title = `Customers keep asking about ${safeTopic} — add it to your FAQ.`;
      const topicKey = safeTopic
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      await createNotificationIfNotExists(
        businessId,
        {
          title,
          body: title,
          severity: "info",
          category: "product",
          cta_label: "Update FAQ",
          cta_url: `/dashboard/knowledge?topic=${encodeURIComponent(safeTopic)}`,
          data: { topic: safeTopic }
        },
        "weekly_insight_product",
        `weekly_${weekKey}-${businessId}-topic-${topicKey || "topic"}`
      );
    }
  }

  return NextResponse.json({ success: true, processed });
}

export { handle as GET, handle as POST };