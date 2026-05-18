import "server-only";

const META_GRAPH_API_VERSION = "v25.0";

type SendInstagramTextMessageParams = {
  instagramAccountId: string;
  recipientId: string;
  text: string;
};

type InstagramSendErrorOptions = {
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

export class InstagramSendError extends Error {
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
  }: InstagramSendErrorOptions) {
    super(message);
    this.name = "InstagramSendError";
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

const readMetaMessageId = (payload: unknown) => {
  if (!isRecord(payload)) return null;

  if (typeof payload.message_id === "string" && payload.message_id.trim()) {
    return payload.message_id.trim();
  }

  if (Array.isArray(payload.messages)) {
    const first = payload.messages[0];
    if (isRecord(first) && typeof first.id === "string" && first.id.trim()) {
      return first.id.trim();
    }
  }

  return null;
};

export async function sendInstagramTextMessage({
  instagramAccountId,
  recipientId,
  text
}: SendInstagramTextMessageParams): Promise<{ messageId?: string }> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const accessTokenMissing = !accessToken;
  const normalizedInstagramAccountId = toNonEmptyString(instagramAccountId);
  const normalizedRecipientId = toNonEmptyString(recipientId);
  const normalizedText = toNonEmptyString(text);

  if (accessTokenMissing) {
    throw new InstagramSendError({
      message: "Meta page access token is not configured",
      status: 500,
      accessTokenMissing: true
    });
  }

  if (!normalizedInstagramAccountId) {
    throw new InstagramSendError({
      message: "Missing Instagram business account id",
      status: 400,
      accessTokenMissing
    });
  }

  if (!normalizedRecipientId) {
    throw new InstagramSendError({
      message: "Missing Instagram recipient id",
      status: 400,
      accessTokenMissing
    });
  }

  if (!normalizedText) {
    throw new InstagramSendError({
      message: "Missing Instagram message text",
      status: 400,
      accessTokenMissing
    });
  }

  let response: Response;

  try {
    response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(normalizedInstagramAccountId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          recipient: {
            id: normalizedRecipientId
          },
          messaging_type: "RESPONSE",
          message: {
            text: normalizedText
          }
        })
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new InstagramSendError({
      message: `Failed to call Meta Instagram API: ${message}`,
      accessTokenMissing
    });
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.ok) {
    const messageId = readMetaMessageId(payload);
    return messageId ? { messageId } : {};
  }

  const parsedError = parseMetaErrorPayload(payload);

  throw new InstagramSendError({
    message: parsedError?.message
      ? `Meta Instagram API request failed with status ${response.status}: ${parsedError.message}`
      : `Meta Instagram API request failed with status ${response.status}`,
    status: response.status,
    metaErrorType: parsedError?.type,
    metaErrorCode: parsedError?.code,
    metaErrorMessage: parsedError?.message,
    metaErrorSubcode: parsedError?.errorSubcode,
    fbtraceId: parsedError?.fbtraceId,
    accessTokenMissing
  });
}
