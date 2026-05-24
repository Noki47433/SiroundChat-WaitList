import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runChatbotOrchestrator } from "@/lib/chatbot/orchestrator";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { checkWebhookRateLimit } from "@/lib/channels/webhook-rate-limit";
import { log } from "@/lib/utils/log";

type Channel = "whatsapp" | "instagram";

type ParsedInboundMessage = {
  externalAccountId: string;
  externalMessageId: string;
  from: string;
  text: string;
  name?: string | null;
  email?: string | null;
};

const parseInbound = (channel: Channel, payload: Record<string, unknown>): ParsedInboundMessage | null => {
  const externalAccountId =
    (typeof payload.external_account_id === "string" && payload.external_account_id) ||
    (typeof payload.account_id === "string" && payload.account_id) ||
    (typeof payload.recipient_id === "string" && payload.recipient_id) ||
    null;

  const externalMessageId =
    (typeof payload.external_message_id === "string" && payload.external_message_id) ||
    (typeof payload.message_id === "string" && payload.message_id) ||
    (typeof payload.id === "string" && payload.id) ||
    null;

  const from =
    (typeof payload.from === "string" && payload.from) ||
    (typeof payload.sender_id === "string" && payload.sender_id) ||
    (typeof payload.phone === "string" && payload.phone) ||
    null;

  const text =
    (typeof payload.text === "string" && payload.text) ||
    (typeof payload.body === "string" && payload.body) ||
    (typeof payload.message === "string" && payload.message) ||
    null;

  if (!externalAccountId || !externalMessageId || !from || !text) {
    return null;
  }

  const name = typeof payload.name === "string" ? payload.name : null;
  const email = typeof payload.email === "string" ? payload.email : null;

  return {
    externalAccountId,
    externalMessageId,
    from,
    text,
    name,
    email
  };
};

const getIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";

export async function handleInboundWebhook(channel: Channel, request: Request) {
  const secret = request.headers.get("x-webhook-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const rate = checkWebhookRateLimit(`${channel}:${getIp(request)}`);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "Rate limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const parsed = parseInbound(channel, payload);
  if (!parsed) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const admin = getSupabaseAdminClient() as any;

  try {
    const { data: inbox, error: inboxError } = await admin
      .from("channel_inboxes")
      .select("id,business_id,channel,settings")
      .eq("channel", channel)
      .eq("external_account_id", parsed.externalAccountId)
      .maybeSingle();

    if (inboxError || !inbox?.id || !inbox?.business_id) {
      return new Response(JSON.stringify({ error: "Inbox not configured" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const channelEntitlement = channel === "instagram" ? "instagram" : "whatsapp";
    const [channelAccess, inboxAccess, automationAccess] = await Promise.all([
      getBusinessEntitlementAccess(inbox.business_id as string, channelEntitlement),
      getBusinessEntitlementAccess(inbox.business_id as string, "unified_inbox"),
      getBusinessEntitlementAccess(inbox.business_id as string, "social_automation")
    ]);

    if (!channelAccess.allowed && !inboxAccess.allowed) {
      return new Response(JSON.stringify({ ok: true, ignored: "billing_locked" }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { data: conversation, error: conversationError } = await admin
      .from("chat_conversations")
      .insert({
        business_id: inbox.business_id,
        site_id: null,
        user_name: parsed.name ?? null,
        user_email: parsed.email ?? null,
        is_lead: true
      })
      .select("id")
      .single();

    if (conversationError || !conversation?.id) {
      throw conversationError ?? new Error("Failed to create conversation for webhook message");
    }

    const conversationId = conversation.id as string;
    const canRunAutomation = automationAccess.allowed;
    const orchestratorResult = canRunAutomation
      ? await runChatbotOrchestrator(admin, {
          businessId: inbox.business_id,
          conversationId,
          message: parsed.text,
          customerSignals: {
            name: parsed.name,
            email: parsed.email,
            phone: parsed.from,
            channel,
            externalId: parsed.from
          }
        })
      : { customer: null, assistantMessage: null, actions: [] as string[] };

    const customerId = orchestratorResult.customer?.id ?? null;

    const { error: insertError } = await admin.from("channel_messages").insert({
      business_id: inbox.business_id,
      inbox_id: inbox.id,
      external_message_id: parsed.externalMessageId,
      customer_id: customerId,
      direction: "in",
      body: parsed.text,
      raw: payload
    });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    await admin.from("analytics_events").insert({
      business_id: inbox.business_id,
      customer_id: customerId,
      conversation_id: conversationId,
      type: "message_received",
      metadata: {
        source: channel,
        external_message_id: parsed.externalMessageId,
        inbox_id: inbox.id,
        conversation_id: conversationId
      },
      timestamp: new Date().toISOString()
    });

    const autoReplyEnabled = canRunAutomation && (inbox.settings?.auto_reply ?? true) !== false;

    if (autoReplyEnabled && orchestratorResult.assistantMessage) {
      await admin.from("channel_messages").insert({
        business_id: inbox.business_id,
        inbox_id: inbox.id,
        customer_id: customerId,
        direction: "out",
        body: orchestratorResult.assistantMessage,
        raw: {
          generated_by: "orchestrator"
        }
      });

      await admin.from("outbox_messages").insert({
        business_id: inbox.business_id,
        customer_id: customerId,
        channel,
        template_key: "webhook_auto_reply",
        payload: {
          inbox_id: inbox.id,
          to: parsed.from,
          message: orchestratorResult.assistantMessage
        },
        send_at: new Date().toISOString(),
        status: "pending"
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        actions: orchestratorResult.actions
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    log("error", "Failed to handle inbound channel webhook", { error, channel });
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
