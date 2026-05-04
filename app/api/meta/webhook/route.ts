import { NextRequest, NextResponse } from "next/server";
import { generateBusinessChatbotReply } from "@/lib/chatbot/business-chat-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppTextMessage } from "@/lib/meta/whatsapp";
import { log } from "@/lib/utils/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

type MetaWebhookEntry = {
  id?: string;
  changes?: MetaWebhookChange[];
};

type MetaWebhookChange = {
  field?: string;
  value?: MetaWebhookValue;
};

type MetaWebhookValue = {
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  messages?: MetaWebhookMessage[];
  statuses?: unknown[];
};

type MetaWebhookMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: {
    body?: string;
  };
};

type ParsedWhatsAppTextMessage = {
  phoneNumberId: string;
  senderWhatsAppId: string;
  messageId: string;
  text: string;
};

type ExtractedWebhookData = {
  messages: ParsedWhatsAppTextMessage[];
  duplicateMessageIds: string[];
  incompleteMessageCount: number;
  nonTextMessageCount: number;
  statusCount: number;
};

const MAX_LOG_DEPTH = 4;
const MAX_LOG_ARRAY_ITEMS = 10;
const MAX_LOG_OBJECT_KEYS = 25;
const MAX_LOG_STRING_LENGTH = 500;
const MAX_TEXT_PREVIEW_LENGTH = 160;
const FALLBACK_REPLY_TEXT = "Thanks — the restaurant will get back to you shortly.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const truncateString = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...[truncated]` : value;

const sanitizeForLog = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") {
    return truncateString(value, MAX_LOG_STRING_LENGTH);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_LOG_DEPTH) return `[array(${value.length}) truncated]`;

    const sanitized = value
      .slice(0, MAX_LOG_ARRAY_ITEMS)
      .map((item) => sanitizeForLog(item, depth + 1));

    if (value.length > MAX_LOG_ARRAY_ITEMS) {
      sanitized.push(`... ${value.length - MAX_LOG_ARRAY_ITEMS} more items`);
    }

    return sanitized;
  }

  if (isRecord(value)) {
    if (depth >= MAX_LOG_DEPTH) return "[object truncated]";

    const entries = Object.entries(value);
    const limitedEntries = entries.slice(0, MAX_LOG_OBJECT_KEYS);
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of limitedEntries) {
      sanitizedObject[key] = sanitizeForLog(nestedValue, depth + 1);
    }

    if (entries.length > MAX_LOG_OBJECT_KEYS) {
      sanitizedObject.__truncatedKeys = entries.length - MAX_LOG_OBJECT_KEYS;
    }

    return sanitizedObject;
  }

  return String(value);
};

const sanitizeErrorForLog = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncateString(error.message, MAX_LOG_STRING_LENGTH)
    };
  }

  return sanitizeForLog(error);
};

const findCreatedReservationId = (actions: Array<{ type?: string; payload?: Record<string, unknown> }>) => {
  for (const action of actions) {
    if (action.type !== "create_reservation") continue;
    if (typeof action.payload?.reservationId === "string" && action.payload.reservationId.trim()) {
      return action.payload.reservationId.trim();
    }
  }
  return null;
};

const formatCustomerDisplayName = (senderWhatsAppId: string) => {
  const digits = senderWhatsAppId.replace(/\D/g, "");
  return digits ? `+${digits}` : senderWhatsAppId;
};

const sanitizeMessagePayloadForStorage = (message: ParsedWhatsAppTextMessage) => ({
  phoneNumberId: message.phoneNumberId,
  senderWhatsAppId: message.senderWhatsAppId,
  messageId: message.messageId,
  textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
});

const extractTextMessages = (payload: MetaWebhookPayload): ExtractedWebhookData => {
  const messages: ParsedWhatsAppTextMessage[] = [];
  const duplicateMessageIds: string[] = [];
  const seenMessageIds = new Set<string>();

  let incompleteMessageCount = 0;
  let nonTextMessageCount = 0;
  let statusCount = 0;

  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (!value) continue;

      const phoneNumberId =
        typeof value.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : null;

      if (Array.isArray(value.statuses)) {
        statusCount += value.statuses.length;
      }

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const messageId = typeof message?.id === "string" ? message.id : null;

        if (!messageId) {
          incompleteMessageCount += 1;
          continue;
        }

        if (seenMessageIds.has(messageId)) {
          duplicateMessageIds.push(messageId);
          continue;
        }

        seenMessageIds.add(messageId);

        // TODO: Check a persistent store keyed by messageId before any downstream
        // processing so Meta webhook retries remain idempotent across requests.
        if (message.type !== "text") {
          nonTextMessageCount += 1;
          continue;
        }

        const senderWhatsAppId = typeof message.from === "string" ? message.from : null;
        const text = typeof message.text?.body === "string" ? message.text.body : null;

        if (!phoneNumberId || !senderWhatsAppId || !text) {
          incompleteMessageCount += 1;
          continue;
        }

        messages.push({
          phoneNumberId,
          senderWhatsAppId,
          messageId,
          text
        });
      }
    }
  }

  return {
    messages,
    duplicateMessageIds,
    incompleteMessageCount,
    nonTextMessageCount,
    statusCount
  };
};

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const verifyToken = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expectedToken = process.env.META_VERIFY_TOKEN;

  if (!expectedToken) {
    log("warn", "META_VERIFY_TOKEN is not configured for Meta webhook verification");
    return new Response("Forbidden", { status: 403 });
  }

  if (mode === "subscribe" && challenge !== null && verifyToken === expectedToken) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  log("warn", "Rejected Meta webhook verification request", {
    mode,
    hasChallenge: challenge !== null,
    tokenMatched: verifyToken === expectedToken
  });

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as unknown;

  if (!isRecord(payload)) {
    log("warn", "Received invalid Meta webhook payload", {
      payloadType: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  log("info", "Received Meta webhook payload", {
    payload: sanitizeForLog(payload)
  });

  const extracted = extractTextMessages(payload as MetaWebhookPayload);
  const admin = getSupabaseAdminClient() as any;
  const origin = new URL(request.url).origin;

  log("info", "Parsed Meta webhook event", {
    textMessageCount: extracted.messages.length,
    nonTextMessageCount: extracted.nonTextMessageCount,
    statusCount: extracted.statusCount,
    incompleteMessageCount: extracted.incompleteMessageCount,
    duplicateMessageIds: extracted.duplicateMessageIds,
    messages: extracted.messages.map((message) => ({
      phoneNumberId: message.phoneNumberId,
      senderWhatsAppId: message.senderWhatsAppId,
      messageId: message.messageId,
      textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
    }))
  });

  for (const message of extracted.messages) {
    try {
      const { data: existingInbound } = await admin
        .from("messages")
        .select("id")
        .eq("provider_message_id", message.messageId)
        .limit(1)
        .maybeSingle();

      if (existingInbound?.id) {
        log("info", "Skipping duplicate WhatsApp message", {
          messageId: message.messageId,
          phoneNumberId: message.phoneNumberId
        });
        continue;
      }

      const { data: channel, error: channelError } = await admin
        .from("business_channels")
        .select("id,business_id,channel_type,status,auto_reply_enabled,display_phone_number,whatsapp_phone_number_id,whatsapp_business_account_id")
        .eq("whatsapp_phone_number_id", message.phoneNumberId)
        .eq("channel_type", "whatsapp")
        .eq("status", "connected")
        .maybeSingle();

      if (channelError) {
        log("error", "Failed WhatsApp channel lookup", {
          phoneNumberId: message.phoneNumberId,
          error: sanitizeErrorForLog(channelError)
        });
        continue;
      }

      if (!channel?.id || !channel.business_id) {
        log("warn", "No connected WhatsApp channel found for phone number id", {
          phoneNumberId: message.phoneNumberId
        });
        continue;
      }

      log("info", "Resolved WhatsApp business channel", {
        channelId: channel.id,
        businessId: channel.business_id,
        phoneNumberId: message.phoneNumberId
      });

      const { data: existingConversation, error: conversationLookupError } = await admin
        .from("conversations")
        .select("id,status,reservation_draft,metadata,linked_reservation_id")
        .eq("business_id", channel.business_id)
        .eq("channel_type", "whatsapp")
        .eq("external_customer_id", message.senderWhatsAppId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversationLookupError) {
        log("error", "Failed to load WhatsApp conversation", {
          businessId: channel.business_id,
          senderWhatsAppId: message.senderWhatsAppId,
          error: sanitizeErrorForLog(conversationLookupError)
        });
        continue;
      }

      let conversation = existingConversation;
      const nowIso = new Date().toISOString();
      const baseMetadata = {
        whatsapp_phone_number_id: channel.whatsapp_phone_number_id,
        whatsapp_business_account_id: channel.whatsapp_business_account_id,
        display_phone_number: channel.display_phone_number
      };

      if (!conversation?.id) {
        const { data: createdConversation, error: createConversationError } = await admin
          .from("conversations")
          .insert({
            business_id: channel.business_id,
            channel: "whatsapp",
            channel_type: "whatsapp",
            visitor_id: message.senderWhatsAppId,
            external_customer_id: message.senderWhatsAppId,
            customer_display_name: formatCustomerDisplayName(message.senderWhatsAppId),
            status: "bot",
            metadata: baseMetadata,
            last_message_preview: message.text,
            last_message_at: nowIso
          })
          .select("id,status,reservation_draft,metadata,linked_reservation_id")
          .single();

        if (createConversationError || !createdConversation?.id) {
          log("error", "Failed to create WhatsApp conversation", {
            businessId: channel.business_id,
            senderWhatsAppId: message.senderWhatsAppId,
            error: sanitizeErrorForLog(createConversationError)
          });
          continue;
        }

        conversation = createdConversation;
        log("info", "Created WhatsApp conversation", {
          conversationId: conversation.id,
          businessId: channel.business_id
        });
      } else {
        log("info", "Found existing WhatsApp conversation", {
          conversationId: conversation.id,
          status: conversation.status
        });
      }

      // Closed threads reopen into bot mode for the MVP so the assistant can continue once a new
      // inbound message arrives, unless the channel itself has auto-reply disabled.
      const nextConversationStatus =
        conversation?.status === "closed" && channel.auto_reply_enabled ? "bot" : conversation?.status ?? "bot";

      const { error: inboundInsertError } = await admin
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          business_id: channel.business_id,
          sender: "visitor",
          direction: "inbound",
          content: message.text,
          body: message.text,
          provider_message_id: message.messageId,
          raw_payload: sanitizeMessagePayloadForStorage(message)
        });

      if (inboundInsertError) {
        log("error", "Failed to save inbound WhatsApp message", {
          conversationId: conversation.id,
          messageId: message.messageId,
          error: sanitizeErrorForLog(inboundInsertError)
        });
        continue;
      }

      log("info", "Saved inbound WhatsApp message", {
        conversationId: conversation.id,
        messageId: message.messageId
      });

      const mergedMetadata = {
        ...(isRecord(conversation.metadata) ? conversation.metadata : {}),
        ...baseMetadata,
        last_inbound_message_id: message.messageId
      };

      await admin
        .from("conversations")
        .update({
          status: nextConversationStatus,
          customer_display_name: formatCustomerDisplayName(message.senderWhatsAppId),
          metadata: mergedMetadata,
          last_message_preview: message.text,
          last_message_at: nowIso
        })
        .eq("id", conversation.id);

      if (!channel.auto_reply_enabled) {
        log("info", "WhatsApp auto-reply disabled for channel", {
          conversationId: conversation.id,
          channelId: channel.id
        });
        continue;
      }

      if (nextConversationStatus === "human") {
        log("info", "Conversation is in human takeover mode; skipping bot reply", {
          conversationId: conversation.id
        });
        continue;
      }

      const { data: historyRows, error: historyError } = await admin
        .from("messages")
        .select("direction,body,content,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (historyError) {
        log("warn", "Failed to load WhatsApp message history", {
          conversationId: conversation.id,
          error: sanitizeErrorForLog(historyError)
        });
      }

      const messageHistory = (historyRows ?? [])
        .slice()
        .reverse()
        .map((row: { direction?: string | null; body?: string | null; content?: string | null }) => ({
          role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
          content: typeof row.body === "string" && row.body.trim() ? row.body : row.content ?? ""
        }))
        .filter((row: { content: string }) => row.content.trim().length > 0);

      log("info", "Calling shared business chat engine for WhatsApp conversation", {
        conversationId: conversation.id,
        historyCount: messageHistory.length
      });

      const engineResult = await generateBusinessChatbotReply({
        businessId: channel.business_id,
        channel: "whatsapp",
        conversationId: conversation.id,
        customerMessage: message.text,
        customerExternalId: message.senderWhatsAppId,
        messageHistory,
        metadata: {
          origin,
          conversationStatus: nextConversationStatus,
          phoneNumberId: message.phoneNumberId,
          providerMessageId: message.messageId,
          customerPhone: message.senderWhatsAppId,
          customerName: formatCustomerDisplayName(message.senderWhatsAppId),
          reservationDraft: {
            ...(isRecord(conversation.reservation_draft) ? conversation.reservation_draft : {}),
            phone:
              (isRecord(conversation.reservation_draft) && typeof conversation.reservation_draft.phone === "string"
                ? conversation.reservation_draft.phone
                : null) ?? message.senderWhatsAppId
          }
        }
      });

      const replyText = engineResult.replyText?.trim() || FALLBACK_REPLY_TEXT;
      let outboundProviderMessageId: string | null = null;
      let sendFailed = false;
      let sendFailureMeta: Record<string, unknown> | null = null;

      try {
        outboundProviderMessageId = await sendWhatsAppTextMessage({
          phoneNumberId: message.phoneNumberId,
          recipientWaId: message.senderWhatsAppId,
          text: replyText
        });
        log("info", "Sent WhatsApp reply", {
          conversationId: conversation.id,
          outboundProviderMessageId
        });
      } catch (error) {
        sendFailed = true;
        sendFailureMeta = { delivery_error: sanitizeErrorForLog(error) };
        log("error", "Failed to send WhatsApp reply", {
          conversationId: conversation.id,
          messageId: message.messageId,
          error: sanitizeErrorForLog(error)
        });
      }

      const { error: outboundInsertError } = await admin
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          business_id: channel.business_id,
          sender: "ai",
          direction: "outbound",
          content: replyText,
          body: replyText,
          provider_message_id: outboundProviderMessageId,
          raw_payload: {
            ...baseMetadata,
            ...(sendFailureMeta ?? {})
          }
        });

      if (outboundInsertError) {
        log("error", "Failed to save outbound WhatsApp message", {
          conversationId: conversation.id,
          error: sanitizeErrorForLog(outboundInsertError)
        });
      } else {
        log("info", "Saved outbound WhatsApp message", {
          conversationId: conversation.id,
          outboundProviderMessageId
        });
      }

      const linkedReservationId =
        engineResult.statePatch.linkedReservationId ??
        findCreatedReservationId(engineResult.actions as Array<{ type?: string; payload?: Record<string, unknown> }>) ??
        conversation.linked_reservation_id ??
        null;

      await admin
        .from("conversations")
        .update({
          status: nextConversationStatus,
          intent: engineResult.statePatch.intent,
          reservation_draft: engineResult.statePatch.reservationDraft,
          linked_reservation_id: linkedReservationId,
          metadata: {
            ...mergedMetadata,
            last_outbound_message_id: outboundProviderMessageId,
            last_delivery_failed: sendFailed
          },
          last_message_preview: replyText,
          last_message_at: new Date().toISOString()
        })
        .eq("id", conversation.id);

      if (linkedReservationId) {
        log("info", "Linked WhatsApp conversation to reservation", {
          conversationId: conversation.id,
          reservationId: linkedReservationId
        });
      }
    } catch (error) {
      log("error", "Unhandled WhatsApp webhook processing error", {
        messageId: message.messageId,
        error: sanitizeErrorForLog(error)
      });
    }
  }

  return NextResponse.json({ ok: true });
}
