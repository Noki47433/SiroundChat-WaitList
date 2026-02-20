import { log } from "@/lib/utils/log";

export type ProviderSendInput = {
  channel: "whatsapp" | "instagram";
  inbox: {
    id: string;
    external_account_id: string;
    access_token_encrypted: string | null;
  };
  to: string;
  body: string;
};

export type ProviderSendResult = {
  success: boolean;
  queued: boolean;
  externalMessageId?: string;
  error?: string;
};

const hasProviderKeys = (channel: "whatsapp" | "instagram") => {
  if (channel === "whatsapp") {
    return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
  }
  return Boolean(process.env.INSTAGRAM_API_URL && process.env.INSTAGRAM_API_TOKEN);
};

export async function sendChannelMessage(input: ProviderSendInput): Promise<ProviderSendResult> {
  if (!hasProviderKeys(input.channel)) {
    return {
      success: false,
      queued: true,
      error: `${input.channel} provider is not configured`
    };
  }

  try {
    const endpoint =
      input.channel === "whatsapp"
        ? process.env.WHATSAPP_API_URL ?? ""
        : process.env.INSTAGRAM_API_URL ?? "";
    const token =
      input.channel === "whatsapp"
        ? process.env.WHATSAPP_API_TOKEN ?? ""
        : process.env.INSTAGRAM_API_TOKEN ?? "";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: input.to,
        account_id: input.inbox.external_account_id,
        text: input.body
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "provider request failed");
      return {
        success: false,
        queued: false,
        error: errorText
      };
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      success: true,
      queued: false,
      externalMessageId: typeof payload.id === "string" ? payload.id : undefined
    };
  } catch (error) {
    log("error", "sendChannelMessage failed", { error, channel: input.channel, inboxId: input.inbox.id });
    return {
      success: false,
      queued: false,
      error: error instanceof Error ? error.message : "provider request failed"
    };
  }
}
