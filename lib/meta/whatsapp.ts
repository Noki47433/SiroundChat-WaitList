import "server-only";

const META_GRAPH_API_VERSION = "v25.0";

type SendWhatsAppTextMessageParams = {
  phoneNumberId: string;
  recipientWaId: string;
  text: string;
};

type MetaApiErrorPayload = {
  error?: {
    type?: string;
    code?: number;
    message?: string;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type WhatsAppSendErrorOptions = {
  message: string;
  status?: number;
  metaErrorType?: string;
  metaErrorCode?: number;
  metaErrorMessage?: string;
  metaErrorSubcode?: number;
  fbtraceId?: string;
  accessTokenMissing?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNonEmptyString = (value: string) => value.trim();

export class WhatsAppSendError extends Error {
  readonly status?: number;
  readonly metaErrorType?: string;
  readonly metaErrorCode?: number;
  readonly metaErrorMessage?: string;
  readonly metaErrorSubcode?: number;
  readonly fbtraceId?: string;
  readonly accessTokenMissing: boolean;

  constructor({
    message,
    status,
    metaErrorType,
    metaErrorCode,
    metaErrorMessage,
    metaErrorSubcode,
    fbtraceId,
    accessTokenMissing = false
  }: WhatsAppSendErrorOptions) {
    super(message);
    this.name = "WhatsAppSendError";
    this.status = status;
    this.metaErrorType = metaErrorType;
    this.metaErrorCode = metaErrorCode;
    this.metaErrorMessage = metaErrorMessage;
    this.metaErrorSubcode = metaErrorSubcode;
    this.fbtraceId = fbtraceId;
    this.accessTokenMissing = accessTokenMissing;
  }
}

const parseMetaErrorPayload = (payload: unknown) => {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return {
    type: typeof payload.error.type === "string" ? payload.error.type : undefined,
    code: typeof payload.error.code === "number" ? payload.error.code : undefined,
    message: typeof payload.error.message === "string" ? payload.error.message : undefined,
    errorSubcode: typeof payload.error.error_subcode === "number" ? payload.error.error_subcode : undefined,
    fbtraceId: typeof payload.error.fbtrace_id === "string" ? payload.error.fbtrace_id : undefined
  };
};

export async function sendWhatsAppTextMessage({
  phoneNumberId,
  recipientWaId,
  text
}: SendWhatsAppTextMessageParams): Promise<void> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accessTokenMissing = !accessToken;
  const normalizedPhoneNumberId = toNonEmptyString(phoneNumberId);
  const normalizedRecipientWaId = toNonEmptyString(recipientWaId);
  const normalizedText = toNonEmptyString(text);

  if (accessTokenMissing) {
    throw new WhatsAppSendError({
      message: "META_ACCESS_TOKEN is not configured",
      accessTokenMissing: true
    });
  }

  if (!normalizedPhoneNumberId) {
    throw new WhatsAppSendError({
      message: "phoneNumberId is required",
      accessTokenMissing
    });
  }

  if (!normalizedRecipientWaId) {
    throw new WhatsAppSendError({
      message: "recipientWaId is required",
      accessTokenMissing
    });
  }

  if (!normalizedText) {
    throw new WhatsAppSendError({
      message: "text is required",
      accessTokenMissing
    });
  }

  let response: Response;

  try {
    response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(normalizedPhoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedRecipientWaId,
          type: "text",
          text: {
            preview_url: false,
            body: normalizedText
          }
        })
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new WhatsAppSendError({
      message: `Failed to call Meta WhatsApp API: ${message}`,
      accessTokenMissing
    });
  }

  if (response.ok) {
    return;
  }

  const errorPayload = (await response.json().catch(() => null)) as MetaApiErrorPayload | null;
  const parsedError = parseMetaErrorPayload(errorPayload);

  throw new WhatsAppSendError({
    message: parsedError?.message
      ? `Meta WhatsApp API request failed with status ${response.status}: ${parsedError.message}`
      : `Meta WhatsApp API request failed with status ${response.status}`,
    status: response.status,
    metaErrorType: parsedError?.type,
    metaErrorCode: parsedError?.code,
    metaErrorMessage: parsedError?.message,
    metaErrorSubcode: parsedError?.errorSubcode,
    fbtraceId: parsedError?.fbtraceId,
    accessTokenMissing
  });
}
