import { NextRequest, NextResponse } from "next/server";
import { generateBusinessChatbotReply } from "@/lib/chatbot/business-chat-engine";
import { InstagramSendError, sendInstagramTextMessage } from "@/lib/meta/instagram";
import { sendWhatsAppTextMessage, WhatsAppSendError } from "@/lib/meta/whatsapp";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
  messaging?: MetaInstagramMessagingEvent[];
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

type MetaInstagramMessagingEvent = {
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
  delivery?: unknown;
  read?: unknown;
};

type ChannelType = "whatsapp" | "instagram";

type ParsedMetaTextMessage =
  | {
      channelType: "whatsapp";
      phoneNumberId: string;
      externalCustomerId: string;
      messageId: string;
      text: string;
    }
  | {
      channelType: "instagram";
      instagramBusinessAccountId: string | null;
      instagramPageId: string | null;
      externalCustomerId: string;
      messageId: string;
      text: string;
    };

type ExtractedWebhookData = {
  messages: ParsedMetaTextMessage[];
  duplicateMessageIds: string[];
  incompleteMessageCount: number;
  nonTextMessageCount: number;
  statusCount: number;
  echoCount: number;
  deliveryOrReadCount: number;
};

type ConnectedChannelRow = {
  id: string;
  business_id: string;
  channel_type: ChannelType;
  status: "connected" | "disabled" | "needs_reauth";
  auto_reply_enabled: boolean;
  display_phone_number: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  instagram_business_account_id: string | null;
  instagram_page_id: string | null;
};

type ConversationSnapshot = {
  id: string;
  status: "bot" | "human" | "closed" | string;
  reservation_draft: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  linked_reservation_id: string | null;
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
  if (error instanceof WhatsAppSendError || error instanceof InstagramSendError) {
    return {
      name: error.name,
      message: truncateString(error.message, MAX_LOG_STRING_LENGTH),
      status: error.status ?? null,
      metaErrorCode: error.metaErrorCode ?? null,
      metaErrorMessage: error.metaErrorMessage
        ? truncateString(error.metaErrorMessage, MAX_LOG_STRING_LENGTH)
        : null,
      metaErrorType: error.metaErrorType ?? null,
      metaErrorSubcode: error.metaErrorSubcode ?? null,
      fbtraceId: error.fbtraceId ?? null,
      accessTokenMissing: error.accessTokenMissing
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncateString(error.message, MAX_LOG_STRING_LENGTH)
    };
  }

  return {
    name: "UnknownError",
    message: truncateString(String(sanitizeForLog(error)), MAX_LOG_STRING_LENGTH)
  };
};

const formatCustomerDisplayName = (channelType: ChannelType, externalCustomerId: string) => {
  if (channelType === "whatsapp") {
    const digits = externalCustomerId.replace(/\D/g, "");
    return digits ? `+${digits}` : externalCustomerId;
  }

  return externalCustomerId;
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

const sanitizeMessagePayloadForStorage = (message: ParsedMetaTextMessage) => {
  if (message.channelType === "instagram") {
    return {
      channelType: "instagram",
      instagramBusinessAccountId: message.instagramBusinessAccountId,
      instagramPageId: message.instagramPageId,
      senderInstagramId: message.externalCustomerId,
      messageId: message.messageId,
      textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
    };
  }

  return {
    channelType: "whatsapp",
    phoneNumberId: message.phoneNumberId,
    senderWhatsAppId: message.externalCustomerId,
    messageId: message.messageId,
    textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
  };
};

const extractTextMessages = (payload: MetaWebhookPayload): ExtractedWebhookData => {
  const messages: ParsedMetaTextMessage[] = [];
  const duplicateMessageIds: string[] = [];
  const seenMessageIds = new Set<string>();

  let incompleteMessageCount = 0;
  let nonTextMessageCount = 0;
  let statusCount = 0;
  let echoCount = 0;
  let deliveryOrReadCount = 0;

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
          channelType: "whatsapp",
          phoneNumberId,
          externalCustomerId: senderWhatsAppId,
          messageId,
          text
        });
      }
    }

    const instagramPageId = typeof entry.id === "string" ? entry.id : null;

    for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) {
      if (event.delivery || event.read) {
        deliveryOrReadCount += 1;
        continue;
      }

      const message = event.message;
      const messageId = typeof message?.mid === "string" ? message.mid : null;
      const text = typeof message?.text === "string" ? message.text : null;
      const senderId = typeof event.sender?.id === "string" ? event.sender.id : null;
      const recipientId = typeof event.recipient?.id === "string" ? event.recipient.id : null;
      const isEcho = message?.is_echo === true;

      if (isEcho) {
        echoCount += 1;
        continue;
      }

      if (!message || typeof message.text !== "string") {
        nonTextMessageCount += 1;
        continue;
      }

      if (!messageId) {
        incompleteMessageCount += 1;
        continue;
      }

      if (seenMessageIds.has(messageId)) {
        duplicateMessageIds.push(messageId);
        continue;
      }

      seenMessageIds.add(messageId);

      if (!senderId || !text) {
        incompleteMessageCount += 1;
        continue;
      }

      messages.push({
        channelType: "instagram",
        instagramBusinessAccountId: recipientId,
        instagramPageId,
        externalCustomerId: senderId,
        messageId,
        text
      });
    }
  }

  return {
    messages,
    duplicateMessageIds,
    incompleteMessageCount,
    nonTextMessageCount,
    statusCount,
    echoCount,
    deliveryOrReadCount
  };
};

const buildChannelMetadata = (channel: ConnectedChannelRow) => {
  if (channel.channel_type === "instagram") {
    return {
      instagram_business_account_id: channel.instagram_business_account_id,
      instagram_page_id: channel.instagram_page_id
    };
  }

  return {
    whatsapp_phone_number_id: channel.whatsapp_phone_number_id,
    whatsapp_business_account_id: channel.whatsapp_business_account_id,
    display_phone_number: channel.display_phone_number
  };
};

const loadRecentMessageHistory = async (admin: any, conversationId: string) => {
  const { data: historyRows, error } = await admin
    .from("messages")
    .select("direction,body,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    error,
    messageHistory: (historyRows ?? [])
      .slice()
      .reverse()
      .map((row: { direction?: string | null; body?: string | null; content?: string | null }) => ({
        role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: typeof row.body === "string" && row.body.trim() ? row.body : row.content ?? ""
      }))
      .filter((row: { content: string }) => row.content.trim().length > 0)
  };
};

const findConnectedChannel = async (admin: any, message: ParsedMetaTextMessage) => {
  if (message.channelType === "instagram") {
    let query = admin
      .from("business_channels")
      .select(
        "id,business_id,channel_type,status,auto_reply_enabled,display_phone_number,whatsapp_phone_number_id,whatsapp_business_account_id,instagram_business_account_id,instagram_page_id"
      )
      .eq("channel_type", "instagram")
      .eq("status", "connected");

    const filters: string[] = [];
    if (message.instagramBusinessAccountId?.trim()) {
      filters.push(`instagram_business_account_id.eq.${message.instagramBusinessAccountId.trim()}`);
    }
    if (message.instagramPageId?.trim()) {
      filters.push(`instagram_page_id.eq.${message.instagramPageId.trim()}`);
    }

    if (!filters.length) {
      return { data: null, error: null };
    }

    return query.or(filters.join(",")).maybeSingle();
  }

  return admin
    .from("business_channels")
    .select(
      "id,business_id,channel_type,status,auto_reply_enabled,display_phone_number,whatsapp_phone_number_id,whatsapp_business_account_id,instagram_business_account_id,instagram_page_id"
    )
    .eq("whatsapp_phone_number_id", message.phoneNumberId)
    .eq("channel_type", "whatsapp")
    .eq("status", "connected")
    .maybeSingle();
};

const sendChannelReply = async (message: ParsedMetaTextMessage, channel: ConnectedChannelRow, text: string) => {
  if (message.channelType === "instagram") {
    const result = await sendInstagramTextMessage({
      instagramAccountId: channel.instagram_business_account_id ?? message.instagramBusinessAccountId ?? "",
      recipientId: message.externalCustomerId,
      text
    });
    return result.messageId ?? null;
  }

  return sendWhatsAppTextMessage({
    phoneNumberId: channel.whatsapp_phone_number_id ?? message.phoneNumberId,
    recipientWaId: message.externalCustomerId,
    text
  });
};

async function processInboundTextMessage(admin: any, origin: string, message: ParsedMetaTextMessage) {
  const channelLabel = message.channelType === "instagram" ? "Instagram" : "WhatsApp";
  const externalIdLabel = message.channelType === "instagram" ? "senderInstagramId" : "senderWhatsAppId";

  const { data: existingInbound } = await admin
    .from("messages")
    .select("id")
    .eq("provider_message_id", message.messageId)
    .limit(1)
    .maybeSingle();

  if (existingInbound?.id) {
    log("info", `Skipping duplicate ${channelLabel} message`, {
      messageId: message.messageId
    });
    return;
  }

  const { data: channel, error: channelError } = await findConnectedChannel(admin, message);

  if (channelError) {
    log("error", `Failed ${channelLabel} channel lookup`, {
      messageId: message.messageId,
      error: sanitizeErrorForLog(channelError)
    });
    return;
  }

  if (!channel?.id || !channel.business_id) {
    log("warn", `No connected ${channelLabel} channel found for inbound message`, {
      messageId: message.messageId,
      ...(message.channelType === "instagram"
        ? {
            instagramBusinessAccountId: message.instagramBusinessAccountId,
            instagramPageId: message.instagramPageId
          }
        : { phoneNumberId: message.phoneNumberId })
    });
    return;
  }

  log("info", `Resolved ${channelLabel} business channel`, {
    channelId: channel.id,
    businessId: channel.business_id
  });

  const { data: existingConversation, error: conversationLookupError } = await admin
    .from("conversations")
    .select("id,status,reservation_draft,metadata,linked_reservation_id")
    .eq("business_id", channel.business_id)
    .eq("channel_type", message.channelType)
    .eq("external_customer_id", message.externalCustomerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationLookupError) {
    log("error", `Failed to load ${channelLabel} conversation`, {
      businessId: channel.business_id,
      [externalIdLabel]: message.externalCustomerId,
      error: sanitizeErrorForLog(conversationLookupError)
    });
    return;
  }

  let conversation = existingConversation as ConversationSnapshot | null;
  const nowIso = new Date().toISOString();
  const baseMetadata = buildChannelMetadata(channel as ConnectedChannelRow);
  const customerDisplayName = formatCustomerDisplayName(message.channelType, message.externalCustomerId);

  if (!conversation?.id) {
    const { data: createdConversation, error: createConversationError } = await admin
      .from("conversations")
      .insert({
        business_id: channel.business_id,
        channel: message.channelType,
        channel_type: message.channelType,
        visitor_id: message.externalCustomerId,
        external_customer_id: message.externalCustomerId,
        customer_display_name: customerDisplayName,
        status: "bot",
        metadata: baseMetadata,
        last_message_preview: message.text,
        last_message_at: nowIso
      })
      .select("id,status,reservation_draft,metadata,linked_reservation_id")
      .single();

    if (createConversationError || !createdConversation?.id) {
      log("error", `Failed to create ${channelLabel} conversation`, {
        businessId: channel.business_id,
        [externalIdLabel]: message.externalCustomerId,
        error: sanitizeErrorForLog(createConversationError)
      });
      return;
    }

    conversation = createdConversation as ConversationSnapshot;
    log("info", `Created ${channelLabel} conversation`, {
      conversationId: conversation.id,
      businessId: channel.business_id
    });
  } else {
    log("info", `Found existing ${channelLabel} conversation`, {
      conversationId: conversation.id,
      status: conversation.status
    });
  }

  const nextConversationStatus =
    conversation.status === "closed" && channel.auto_reply_enabled ? "bot" : conversation.status ?? "bot";

  const { error: inboundInsertError } = await admin.from("messages").insert({
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
    log("error", `Failed to save inbound ${channelLabel} message`, {
      conversationId: conversation.id,
      messageId: message.messageId,
      error: sanitizeErrorForLog(inboundInsertError)
    });
    return;
  }

  log("info", `Saved inbound ${channelLabel} message`, {
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
      customer_display_name: customerDisplayName,
      metadata: mergedMetadata,
      last_message_preview: message.text,
      last_message_at: nowIso
    })
    .eq("id", conversation.id);

  if (!channel.auto_reply_enabled) {
    log("info", `${channelLabel} auto-reply disabled for channel`, {
      conversationId: conversation.id,
      channelId: channel.id
    });
    return;
  }

  if (nextConversationStatus === "human") {
    log("info", "Conversation is in human takeover mode; skipping bot reply", {
      conversationId: conversation.id,
      channelType: message.channelType
    });
    return;
  }

  const { messageHistory, error: historyError } = await loadRecentMessageHistory(admin, conversation.id);

  if (historyError) {
    log("warn", `Failed to load ${channelLabel} message history`, {
      conversationId: conversation.id,
      error: sanitizeErrorForLog(historyError)
    });
  }

  log("info", `Calling shared business chat engine for ${channelLabel} conversation`, {
    conversationId: conversation.id,
    historyCount: messageHistory.length
  });

  const engineReservationDraft = {
    ...(isRecord(conversation.reservation_draft) ? conversation.reservation_draft : {})
  };

  if (message.channelType === "whatsapp" && typeof engineReservationDraft.phone !== "string") {
    engineReservationDraft.phone = message.externalCustomerId;
  }

  const engineResult = await generateBusinessChatbotReply({
    businessId: channel.business_id,
    channel: message.channelType,
    conversationId: conversation.id,
    customerMessage: message.text,
    customerExternalId: message.externalCustomerId,
    messageHistory,
    metadata: {
      origin,
      conversationStatus: nextConversationStatus,
      providerMessageId: message.messageId,
      customerPhone: message.channelType === "whatsapp" ? message.externalCustomerId : undefined,
      customerName: customerDisplayName,
      phoneNumberId: message.channelType === "whatsapp" ? message.phoneNumberId : undefined,
      instagramBusinessAccountId:
        message.channelType === "instagram" ? message.instagramBusinessAccountId ?? channel.instagram_business_account_id : undefined,
      instagramPageId: message.channelType === "instagram" ? message.instagramPageId ?? channel.instagram_page_id : undefined,
      reservationDraft: engineReservationDraft
    }
  });

  const replyText = engineResult.replyText?.trim() || FALLBACK_REPLY_TEXT;
  let outboundProviderMessageId: string | null = null;
  let sendFailed = false;
  let sendFailureMeta: Record<string, unknown> | null = null;

  try {
    outboundProviderMessageId = await sendChannelReply(
      message,
      channel as ConnectedChannelRow,
      replyText
    );
    log("info", `Sent ${channelLabel} reply`, {
      conversationId: conversation.id,
      outboundProviderMessageId
    });
  } catch (error) {
    sendFailed = true;
    sendFailureMeta = { delivery_error: sanitizeErrorForLog(error) };
    log("error", `Failed to send ${channelLabel} reply`, {
      conversationId: conversation.id,
      messageId: message.messageId,
      error: sanitizeErrorForLog(error)
    });
  }

  const { error: outboundInsertError } = await admin.from("messages").insert({
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
    log("error", `Failed to save outbound ${channelLabel} message`, {
      conversationId: conversation.id,
      error: sanitizeErrorForLog(outboundInsertError)
    });
  } else {
    log("info", `Saved outbound ${channelLabel} message`, {
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
    log("info", `Linked ${channelLabel} conversation to reservation`, {
      conversationId: conversation.id,
      reservationId: linkedReservationId
    });
  }
}

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
    echoCount: extracted.echoCount,
    deliveryOrReadCount: extracted.deliveryOrReadCount,
    messages: extracted.messages.map((message) =>
      message.channelType === "instagram"
        ? {
            channelType: "instagram",
            instagramBusinessAccountId: message.instagramBusinessAccountId,
            instagramPageId: message.instagramPageId,
            senderInstagramId: message.externalCustomerId,
            messageId: message.messageId,
            textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
          }
        : {
            channelType: "whatsapp",
            phoneNumberId: message.phoneNumberId,
            senderWhatsAppId: message.externalCustomerId,
            messageId: message.messageId,
            textPreview: truncateString(message.text, MAX_TEXT_PREVIEW_LENGTH)
          }
    )
  });

  for (const message of extracted.messages) {
    try {
      await processInboundTextMessage(admin, origin, message);
    } catch (error) {
      log("error", `Unhandled ${message.channelType === "instagram" ? "Instagram" : "WhatsApp"} webhook processing error`, {
        messageId: message.messageId,
        error: sanitizeErrorForLog(error)
      });
    }
  }

  return NextResponse.json({ ok: true });
}
