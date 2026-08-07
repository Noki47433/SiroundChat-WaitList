import { log } from "@/lib/utils/log";
import { getTimeZoneOffsetMs } from "@/lib/utils/timezone";
import { sendChannelMessage } from "@/lib/channels/provider-adapter";
import { evaluateBehaviorRules } from "@/lib/chatbot/behavior-offers";
import { decryptSecret } from "@/lib/crypto/secret-box";

type SupabaseLike = any;

type ReservationRow = {
  id: string;
  business_id: string;
  conversation_id: string;
  customer_name: string;
  datetime: string;
};

const formatterForTz = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

const getTzParts = (date: Date, timeZone: string) => {
  const parts: Record<string, string> = {};
  for (const part of formatterForTz(timeZone).formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
};

const toUtcFromLocal = (base: Date, timeZone: string, hour: number, minute: number) => {
  const parts = getTzParts(base, timeZone);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc - offset);
};

export function applyQuietHours(sendAt: Date, timeZone: string): Date {
  const local = getTzParts(sendAt, timeZone);
  const quiet = local.hour >= 22 || local.hour < 8;
  if (!quiet) return sendAt;

  if (local.hour >= 22) {
    const nextDay = new Date(sendAt.getTime() + 24 * 60 * 60 * 1000);
    return toUtcFromLocal(nextDay, timeZone, 8, 5);
  }

  return toUtcFromLocal(sendAt, timeZone, 8, 5);
}

const getBusinessTimeZone = async (admin: SupabaseLike, businessId: string) => {
  const { data } = await admin.from("businesses").select("timezone").eq("id", businessId).maybeSingle();
  return (data?.timezone as string | null) ?? "UTC";
};

const insertOutboxMessage = async (
  admin: SupabaseLike,
  payload: {
    business_id: string;
    customer_id?: string | null;
    channel: string;
    template_key: string;
    send_at: string;
    message: string;
    conversation_id?: string | null;
    inbox_id?: string | null;
    metadata?: Record<string, unknown>;
  }
) => {
  const body = {
    message: payload.message,
    conversation_id: payload.conversation_id ?? null,
    inbox_id: payload.inbox_id ?? null,
    ...(payload.metadata ?? {})
  };

  const { error } = await admin.from("outbox_messages").insert({
    business_id: payload.business_id,
    customer_id: payload.customer_id ?? null,
    channel: payload.channel,
    template_key: payload.template_key,
    send_at: payload.send_at,
    payload: body,
    status: "pending"
  });

  if (error && error.code !== "23505") {
    throw error;
  }
};

const insertAnalytics = async (
  admin: SupabaseLike,
  businessId: string,
  type: string,
  metadata: Record<string, unknown>,
  customerId?: string | null,
  conversationId?: string | null,
  valueNumeric?: number | null
) => {
  await admin.from("analytics_events").insert({
    business_id: businessId,
    customer_id: customerId ?? null,
    conversation_id: conversationId ?? null,
    type,
    metadata,
    value_numeric: valueNumeric ?? null,
    timestamp: new Date().toISOString()
  });
};

export async function scheduleReservationFollowups(
  admin: SupabaseLike,
  reservation: ReservationRow,
  customerId?: string | null
) {
  const businessId = reservation.business_id;
  const timezone = await getBusinessTimeZone(admin, businessId);
  const reservationAt = new Date(reservation.datetime);
  if (Number.isNaN(reservationAt.getTime())) return;

  const { data: rules } = await admin
    .from("followup_rules")
    .select("rule_type, config")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .in("rule_type", ["reservation_reminder", "post_visit_feedback"]);

  const reminderRule = (rules ?? []).find((rule: any) => rule.rule_type === "reservation_reminder");
  const reminderHours: number[] = Array.isArray(reminderRule?.config?.hours_before)
    ? reminderRule.config.hours_before
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0)
    : [24, 2];

  for (const hoursBefore of reminderHours) {
    const sendAt = new Date(reservationAt.getTime() - hoursBefore * 60 * 60 * 1000);
    if (sendAt.getTime() <= Date.now()) continue;

    const adjusted = applyQuietHours(sendAt, timezone);

    await insertOutboxMessage(admin, {
      business_id: businessId,
      customer_id: customerId ?? null,
      channel: "web_chat",
      template_key: `reservation_reminder_${hoursBefore}h`,
      send_at: adjusted.toISOString(),
      message: `Reminder: your reservation is in ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}.`,
      conversation_id: reservation.conversation_id,
      metadata: { reservation_id: reservation.id }
    });
  }

  const postVisitRule = (rules ?? []).find((rule: any) => rule.rule_type === "post_visit_feedback");
  if (postVisitRule?.config?.enabled !== false) {
    const sendAt = applyQuietHours(new Date(reservationAt.getTime() + 2 * 60 * 60 * 1000), timezone);
    await insertOutboxMessage(admin, {
      business_id: businessId,
      customer_id: customerId ?? null,
      channel: "web_chat",
      template_key: "post_visit_feedback",
      send_at: sendAt.toISOString(),
      message: "Thanks for visiting. Could you share your feedback?",
      conversation_id: reservation.conversation_id,
      metadata: { reservation_id: reservation.id }
    });
  }
}

export async function runOutboxTask(admin: SupabaseLike, limit = 100) {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("outbox_messages")
    .select("id,business_id,customer_id,channel,template_key,payload,send_at")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const messageBody = String(payload.message ?? "").trim();
    const conversationId = typeof payload.conversation_id === "string" ? payload.conversation_id : null;

    try {
      if (row.channel === "web_chat") {
        if (conversationId && messageBody) {
          await admin.from("chat_messages").insert({
            conversation_id: conversationId,
            sender: "assistant",
            message_text: messageBody
          });
        }

        await admin.from("outbox_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        sent += 1;
        continue;
      }

      const inboxId = typeof payload.inbox_id === "string" ? payload.inbox_id : null;
      const to = typeof payload.to === "string" ? payload.to : null;

      if (!inboxId || !to || !messageBody) {
        await admin
          .from("outbox_messages")
          .update({ status: "failed", error: "Missing inbox_id/to/message payload" })
          .eq("id", row.id);
        failed += 1;
        continue;
      }

      const { data: inbox } = await admin
        .from("channel_inboxes")
        .select("id,channel,external_account_id,access_token_encrypted,business_id")
        .eq("id", inboxId)
        .maybeSingle();

      if (!inbox?.id) {
        await admin.from("outbox_messages").update({ status: "failed", error: "Inbox not found" }).eq("id", row.id);
        failed += 1;
        continue;
      }

      // P0 W2: decrypt the stored token only here, at the point of use.
      let decryptedToken: string | null = null;
      try {
        decryptedToken = decryptSecret(inbox.access_token_encrypted ?? null);
      } catch {
        decryptedToken = null; // never log or surface the secret
      }

      const sendResult = await sendChannelMessage({
        channel: inbox.channel,
        inbox: { ...inbox, access_token_encrypted: decryptedToken },
        to,
        body: messageBody
      });

      if (sendResult.success) {
        await admin.from("channel_messages").insert({
          business_id: row.business_id,
          inbox_id: inbox.id,
          customer_id: row.customer_id ?? null,
          external_message_id: sendResult.externalMessageId ?? null,
          direction: "out",
          body: messageBody,
          raw: { outbox_id: row.id }
        });

        await admin.from("outbox_messages").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", row.id);
        sent += 1;
      } else if (sendResult.queued) {
        await admin.from("outbox_messages").update({ error: sendResult.error ?? "Provider not configured" }).eq("id", row.id);
      } else {
        await admin
          .from("outbox_messages")
          .update({ status: "failed", error: sendResult.error ?? "Provider send failed" })
          .eq("id", row.id);
        failed += 1;
      }
    } catch (taskError) {
      failed += 1;
      await admin
        .from("outbox_messages")
        .update({ status: "failed", error: taskError instanceof Error ? taskError.message : "Unknown error" })
        .eq("id", row.id);
    }
  }

  return { processed: (rows ?? []).length, sent, failed };
}

const hasCompletedReservation = async (admin: SupabaseLike, businessId: string, conversationId: string, startedAt: string) => {
  const { data } = await admin
    .from("analytics_events")
    .select("id")
    .eq("business_id", businessId)
    .in("type", ["reservation_completed", "reservation_created"])
    .eq("conversation_id", conversationId)
    .gte("timestamp", startedAt)
    .limit(1);

  return Boolean(data?.length);
};

const wasAbandonedRecoverySentRecently = async (admin: SupabaseLike, businessId: string, conversationId: string) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("offers")
    .select("id")
    .eq("business_id", businessId)
    .eq("offer_type", "abandoned_recovery")
    .contains("offer_payload", { conversation_id: conversationId })
    .gte("sent_at", since)
    .limit(1);

  return Boolean(data?.length);
};

export async function runAbandonedRecoveryTask(admin: SupabaseLike) {
  const { data: rules } = await admin
    .from("followup_rules")
    .select("business_id, config")
    .eq("rule_type", "abandoned_booking")
    .eq("is_active", true);

  const thresholdByBusiness = new Map<string, number>();
  (rules ?? []).forEach((rule: any) => {
    const minutes = Number(rule?.config?.threshold_minutes ?? 15);
    thresholdByBusiness.set(rule.business_id, Number.isFinite(minutes) ? minutes : 15);
  });

  const { data: starts, error } = await admin
    .from("analytics_events")
    .select("business_id,conversation_id,timestamp,metadata")
    .eq("type", "reservation_started")
    .order("timestamp", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  let sent = 0;

  for (const event of starts ?? []) {
    const businessId = String(event.business_id ?? "");
    const conversationId =
      typeof event.conversation_id === "string"
        ? event.conversation_id
        : typeof event.metadata?.conversation_id === "string"
          ? event.metadata.conversation_id
          : null;

    if (!businessId || !conversationId) continue;

    const thresholdMinutes = thresholdByBusiness.get(businessId) ?? 15;
    const startedAtMs = new Date(event.timestamp).getTime();
    if (!Number.isFinite(startedAtMs)) continue;

    const elapsedMs = Date.now() - startedAtMs;
    if (elapsedMs < thresholdMinutes * 60 * 1000) continue;

    if (await hasCompletedReservation(admin, businessId, conversationId, event.timestamp)) continue;
    if (await wasAbandonedRecoverySentRecently(admin, businessId, conversationId)) continue;

    const { data: customerEvent } = await admin
      .from("customer_events")
      .select("customer_id")
      .eq("business_id", businessId)
      .eq("type", "message_received")
      .contains("payload", { conversation_id: conversationId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = (customerEvent?.customer_id as string | null) ?? null;
    const message = "Looks like you didn’t finish booking — want me to complete it?";

    await admin.from("offers").insert({
      business_id: businessId,
      customer_id: customerId,
      conversation_id: conversationId,
      channel: "web_chat",
      offer_type: "abandoned_recovery",
      offer_payload: {
        conversation_id: conversationId,
        message
      }
    });

    await insertOutboxMessage(admin, {
      business_id: businessId,
      customer_id: customerId,
      channel: "web_chat",
      template_key: "abandoned_booking_recovery",
      send_at: new Date().toISOString(),
      message,
      conversation_id: conversationId,
      metadata: { conversation_id: conversationId }
    });

    await insertAnalytics(admin, businessId, "abandoned_recovery_sent", { conversation_id: conversationId }, customerId, conversationId);
    sent += 1;
  }

  return { sent };
}

const resolveThursdayAt1800 = (baseDate: Date, timeZone: string) => {
  const local = getTzParts(baseDate, timeZone);
  const currentLocalDateUtc = toUtcFromLocal(baseDate, timeZone, local.hour, local.minute);
  const currentDay = currentLocalDateUtc.getUTCDay();
  const targetDay = 4; // Thursday
  const distance = (targetDay - currentDay + 7) % 7;
  const targetDate = new Date(baseDate.getTime() + distance * 24 * 60 * 60 * 1000);
  return applyQuietHours(toUtcFromLocal(targetDate, timeZone, 18, 0), timeZone);
};

export async function runBehaviorOffersTask(admin: SupabaseLike) {
  const { data: rules } = await admin
    .from("behavior_offer_rules")
    .select("id,business_id,name,condition,action,is_active")
    .eq("is_active", true)
    .limit(200);

  if (!rules?.length) {
    return { triggered: 0 };
  }

  let triggered = 0;

  for (const rule of rules) {
    const businessId = rule.business_id as string;
    const timezone = await getBusinessTimeZone(admin, businessId);

    const { data: customers } = await admin
      .from("customers")
      .select("id,email,phone,tags")
      .eq("business_id", businessId)
      .order("last_seen_at", { ascending: false })
      .limit(400);

    for (const customer of customers ?? []) {
      const customerId = customer.id as string;
      const customerEmail = typeof customer.email === "string" ? customer.email : null;
      const customerPhone = typeof customer.phone === "string" ? customer.phone : null;
      if (!customerEmail && !customerPhone) continue;

      const latestQuery = admin
        .from("reservations")
        .select("datetime")
        .eq("business_id", businessId)
        .order("datetime", { ascending: false })
        .limit(1);

      const fridayQuery = admin
        .from("reservations")
        .select("datetime")
        .eq("business_id", businessId)
        .gte("datetime", new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString())
        .limit(500);

      if (customerEmail && customerPhone) {
        latestQuery.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
        fridayQuery.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        latestQuery.eq("customer_email", customerEmail);
        fridayQuery.eq("customer_email", customerEmail);
      } else if (customerPhone) {
        latestQuery.eq("customer_phone", customerPhone);
        fridayQuery.eq("customer_phone", customerPhone);
      }

      const [{ data: latestReservation }, { data: fridayReservations }] = await Promise.all([
        latestQuery.maybeSingle(),
        fridayQuery
      ]);

      const fridayCount = (fridayReservations ?? []).filter((row: any) => {
        const date = new Date(row.datetime);
        return !Number.isNaN(date.getTime()) && date.getUTCDay() === 5;
      }).length;

      const evaluations = evaluateBehaviorRules(
        [
          {
            id: rule.id,
            name: rule.name,
            condition: rule.condition,
            action: rule.action,
            is_active: rule.is_active
          }
        ],
        {
          now: new Date(),
          lastReservationAt: latestReservation?.datetime ? new Date(latestReservation.datetime) : null,
          fridayReservationCount: fridayCount,
          customerTags: Array.isArray(customer.tags) ? customer.tags : []
        }
      );

      if (!evaluations.length) continue;

      const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await admin
        .from("offers")
        .select("id")
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .contains("offer_payload", { behavior_rule_id: rule.id })
        .gte("sent_at", recentSince)
        .limit(1);

      if (existing?.length) continue;

      const action = (rule.action ?? {}) as Record<string, unknown>;
      const message = String(action.message ?? "We have a special offer for you.");
      const channel = String(action.channel ?? "web_chat");
      const offerType = String(action.offer_type ?? "comeback");

      let sendAt = new Date();
      const conditionType = typeof (rule.condition as Record<string, unknown> | null)?.type === "string"
        ? String((rule.condition as Record<string, unknown>).type)
        : "";
      if (conditionType === "friday_regular") {
        sendAt = resolveThursdayAt1800(new Date(), timezone);
      }
      sendAt = applyQuietHours(sendAt, timezone);

      await admin.from("offers").insert({
        business_id: businessId,
        customer_id: customerId,
        channel,
        offer_type: offerType,
        offer_payload: {
          behavior_rule_id: rule.id,
          message
        }
      });

      await insertOutboxMessage(admin, {
        business_id: businessId,
        customer_id: customerId,
        channel,
        template_key: "behavior_offer",
        send_at: sendAt.toISOString(),
        message,
        metadata: { behavior_rule_id: rule.id }
      });

      await insertAnalytics(admin, businessId, "offer_sent", {
        behavior_rule_id: rule.id,
        offer_type: offerType
      }, customerId);

      triggered += 1;
    }
  }

  return { triggered };
}

export async function runFollowupTask(admin: SupabaseLike) {
  const now = new Date();
  const twoHoursAgoIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const { data: reservations } = await admin
    .from("reservations")
    .select("id,business_id,conversation_id,datetime,customer_name")
    .lte("datetime", twoHoursAgoIso)
    .order("datetime", { ascending: false })
    .limit(200);

  let queued = 0;

  for (const reservation of reservations ?? []) {
    const { data: existing } = await admin
      .from("outbox_messages")
      .select("id")
      .eq("business_id", reservation.business_id)
      .eq("template_key", "post_visit_feedback")
      .contains("payload", { reservation_id: reservation.id })
      .limit(1);

    if (existing?.length) continue;

    const timezone = await getBusinessTimeZone(admin, reservation.business_id);
    const sendAt = applyQuietHours(new Date(), timezone);

    await insertOutboxMessage(admin, {
      business_id: reservation.business_id,
      channel: "web_chat",
      template_key: "post_visit_feedback",
      send_at: sendAt.toISOString(),
      message: "How was your experience? Reply with a quick rating from 1 to 5.",
      conversation_id: reservation.conversation_id,
      metadata: { reservation_id: reservation.id }
    });

    queued += 1;
  }

  return { queued };
}

export async function runCronTasks(admin: SupabaseLike, task: "outbox" | "abandoned" | "offers" | "followups" | "all") {
  const result: Record<string, unknown> = {};

  if (task === "all" || task === "outbox") {
    result.outbox = await runOutboxTask(admin);
  }

  if (task === "all" || task === "abandoned") {
    result.abandoned = await runAbandonedRecoveryTask(admin);
  }

  if (task === "all" || task === "offers") {
    result.offers = await runBehaviorOffersTask(admin);
  }

  if (task === "all" || task === "followups") {
    result.followups = await runFollowupTask(admin);
  }

  log("info", "Cron task finished", { task, result });
  return result;
}
