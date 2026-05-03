import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppTextMessage, WhatsAppSendError } from "@/lib/meta/whatsapp";
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
  if (error instanceof WhatsAppSendError) {
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
      message: truncateString(error.message, MAX_LOG_STRING_LENGTH),
      status: null,
      metaErrorCode: null,
      metaErrorMessage: null,
      metaErrorType: null,
      metaErrorSubcode: null,
      fbtraceId: null,
      accessTokenMissing: !process.env.META_ACCESS_TOKEN
    };
  }

  return {
    name: "UnknownError",
    message: truncateString(String(sanitizeForLog(error)), MAX_LOG_STRING_LENGTH),
    status: null,
    metaErrorCode: null,
    metaErrorMessage: null,
    metaErrorType: null,
    metaErrorSubcode: null,
    fbtraceId: null,
    accessTokenMissing: !process.env.META_ACCESS_TOKEN
  };
};

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

  for (const { phoneNumberId, senderWhatsAppId, messageId } of extracted.messages) {
    log("info", "Attempting WhatsApp auto-reply", {
      phoneNumberId,
      recipientWaId: senderWhatsAppId,
      messageId
    });

    try {
      await sendWhatsAppTextMessage({
        phoneNumberId,
        recipientWaId: senderWhatsAppId,
        text: "SiroundChat received your message ✅"
      });

      log("info", "WhatsApp auto-reply sent", {
        phoneNumberId,
        recipientWaId: senderWhatsAppId,
        messageId
      });
    } catch (error) {
      log("error", "WhatsApp auto-reply failed", {
        phoneNumberId,
        recipientWaId: senderWhatsAppId,
        messageId,
        error: sanitizeErrorForLog(error)
      });
    }
  }

  return NextResponse.json({ ok: true });
}
