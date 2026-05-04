import "server-only";

const META_GRAPH_API_VERSION = "v25.0";

type SendWhatsAppTextMessageParams = {
  phoneNumberId: string;
  recipientWaId: string;
  text: string;
};

type MetaApiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
  messages?: Array<{ id?: string }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class WhatsAppSendError extends Error {
  status: number;
  metaType?: string;
  metaCode?: number;

  constructor(message: string, options?: { status?: number; metaType?: string; metaCode?: number }) {
    super(message);
    this.name = "WhatsAppSendError";
    this.status = options?.status ?? 500;
    this.metaType = options?.metaType;
    this.metaCode = options?.metaCode;
  }
}

const formatMetaApiError = (status: number, payload: unknown) => {
  const baseMessage = `Meta WhatsApp API request failed with status ${status}`;
  if (!isRecord(payload)) return baseMessage;

  const error = isRecord(payload.error) ? payload.error : null;
  const message = typeof error?.message === "string" ? error.message : null;
  const type = typeof error?.type === "string" ? error.type : null;
  const code = typeof error?.code === "number" ? error.code : null;

  const details = [message, type ? `type=${type}` : null, code !== null ? `code=${code}` : null].filter(Boolean);

  return details.length ? `${baseMessage}: ${details.join(", ")}` : baseMessage;
};

const readMetaMessageId = (payload: unknown) => {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return null;
  const first = payload.messages[0];
  if (!isRecord(first)) return null;
  return typeof first.id === "string" && first.id.trim() ? first.id.trim() : null;
};

export async function sendWhatsAppTextMessage({
  phoneNumberId,
  recipientWaId,
  text
}: SendWhatsAppTextMessageParams): Promise<string | null> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new WhatsAppSendError("META_ACCESS_TOKEN is not configured", { status: 500 });
  }

  if (!phoneNumberId.trim()) {
    throw new WhatsAppSendError("Missing WhatsApp phone number id", { status: 400 });
  }

  if (!recipientWaId.trim()) {
    throw new WhatsAppSendError("Missing WhatsApp recipient id", { status: 400 });
  }

  if (!text.trim()) {
    throw new WhatsAppSendError("Missing WhatsApp message text", { status: 400 });
  }

  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipientWaId,
      type: "text",
      text: {
        preview_url: false,
        body: text
      }
    })
  });

  const payload = (await response.json().catch(() => null)) as MetaApiErrorPayload | null;

  if (response.ok) {
    return readMetaMessageId(payload);
  }

  const errorRecord = payload && isRecord(payload.error) ? payload.error : null;
  throw new WhatsAppSendError(formatMetaApiError(response.status, payload), {
    status: response.status,
    metaType: typeof errorRecord?.type === "string" ? errorRecord.type : undefined,
    metaCode: typeof errorRecord?.code === "number" ? errorRecord.code : undefined
  });
}
