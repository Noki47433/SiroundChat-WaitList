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
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

export async function sendWhatsAppTextMessage({
  phoneNumberId,
  recipientWaId,
  text
}: SendWhatsAppTextMessageParams): Promise<void> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN is not configured");
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

  if (response.ok) {
    return;
  }

  const errorPayload = (await response.json().catch(() => null)) as MetaApiErrorPayload | null;
  throw new Error(formatMetaApiError(response.status, errorPayload));
}
