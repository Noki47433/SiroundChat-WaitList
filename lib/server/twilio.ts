import "server-only";

import { logActivity } from "@/lib/activity/log";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/log";

export type SendReservationSmsAlertResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export type SendReservationSmsAlertInput = {
  businessId: string;
  reservationId?: string | null;
  name: string;
  date: string;
  time: string;
  guests: number;
  phone: string | null;
  adminClient?: any;
};

type BusinessSmsAlertSettingsRow = {
  sms_alert_phone: string | null;
  sms_alerts_enabled: boolean | null;
};

type TwilioEnv = {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  messagingServiceSid: string;
  fallbackOwnerPhone: string;
};

const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

let twilioClientPromise: Promise<any> | null = null;

const readTwilioEnv = (): TwilioEnv => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
  authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
  phoneNumber: process.env.TWILIO_PHONE_NUMBER?.trim() ?? "",
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "",
  fallbackOwnerPhone: process.env.RESTAURANT_OWNER_PHONE?.trim() ?? ""
});

const maskPhoneNumber = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "missing";
  return `***${digits.slice(-4)}`;
};

const normalizeUnicodeToAscii = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”„‟]/g, "\"")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-");

const sanitizePlainAscii = (value: string, disallowedPattern: RegExp, fallback: string) => {
  const ascii = normalizeUnicodeToAscii(value).replace(/[^\x20-\x7E]/g, "");
  const cleaned = ascii.replace(disallowedPattern, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
};

const sanitizeReservationName = (value: string) => sanitizePlainAscii(value, /[^A-Za-z0-9 .,'()-]/g, "Guest");

const sanitizeReservationDate = (value: string) => sanitizePlainAscii(value, /[^0-9-]/g, "0000-00-00");

const sanitizeReservationTime = (value: string) => sanitizePlainAscii(value, /[^0-9:]/g, "00:00");

const sanitizeReservationPhone = (value: string | null | undefined) =>
  sanitizePlainAscii(value ?? "-", /[^0-9 +().-]/g, "-");

const buildReservationSmsBody = (input: Omit<SendReservationSmsAlertInput, "businessId" | "reservationId" | "adminClient">) => {
  const safeGuests = Number.isFinite(input.guests) && input.guests > 0 ? Math.floor(input.guests) : 1;

  return [
    "New reservation:",
    sanitizeReservationName(input.name),
    `${sanitizeReservationDate(input.date)} ${sanitizeReservationTime(input.time)}`,
    `Guests: ${safeGuests}`,
    `Phone: ${sanitizeReservationPhone(input.phone)}`
  ].join("\n");
};

const isValidE164PhoneNumber = (value: string | null | undefined) =>
  typeof value === "string" && E164_PHONE_REGEX.test(value.trim());

const getTwilioClient = async (env: Pick<TwilioEnv, "accountSid" | "authToken">) => {
  if (!twilioClientPromise) {
    twilioClientPromise = import("twilio").then(({ default: twilio }) => twilio(env.accountSid, env.authToken));
  }

  return twilioClientPromise;
};

const loadBusinessSmsAlertSettings = async (adminClient: any, businessId: string) => {
  const { data, error } = await adminClient
    .from("businesses")
    .select("sms_alert_phone,sms_alerts_enabled")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    return { data: null, error: "business_settings_lookup_failed" as const };
  }

  return {
    data: (data ?? null) as BusinessSmsAlertSettingsRow | null,
    error: null
  };
};

const resolveRecipientPhone = (settings: BusinessSmsAlertSettingsRow, env: TwilioEnv) => {
  if (settings.sms_alerts_enabled !== true) {
    return {
      ok: false as const,
      skipped: true as const,
      error: "sms_alerts_disabled"
    };
  }

  const configuredPhone = settings.sms_alert_phone?.trim() ?? "";
  if (configuredPhone) {
    if (!isValidE164PhoneNumber(configuredPhone)) {
      return {
        ok: false as const,
        skipped: true as const,
        error: "invalid_sms_alert_phone",
        recipientPreview: maskPhoneNumber(configuredPhone)
      };
    }

    return {
      ok: true as const,
      phone: configuredPhone,
      source: "business" as const
    };
  }

  if (process.env.NODE_ENV !== "production" && env.fallbackOwnerPhone) {
    if (!isValidE164PhoneNumber(env.fallbackOwnerPhone)) {
      return {
        ok: false as const,
        skipped: true as const,
        error: "invalid_testing_fallback_phone",
        recipientPreview: maskPhoneNumber(env.fallbackOwnerPhone)
      };
    }

    return {
      ok: true as const,
      phone: env.fallbackOwnerPhone,
      source: "development_fallback" as const
    };
  }

  return {
    ok: false as const,
    skipped: true as const,
    error: "missing_sms_alert_phone"
  };
};

const resolveSender = (env: TwilioEnv) => {
  if (env.messagingServiceSid) {
    return {
      ok: true as const,
      payload: { messagingServiceSid: env.messagingServiceSid }
    };
  }

  if (!env.phoneNumber) {
    return {
      ok: false as const,
      skipped: true as const,
      error: "missing_twilio_sender"
    };
  }

  if (!isValidE164PhoneNumber(env.phoneNumber)) {
    return {
      ok: false as const,
      skipped: true as const,
      error: "invalid_twilio_phone_number"
    };
  }

  return {
    ok: true as const,
    payload: { from: env.phoneNumber }
  };
};

const toSafeTwilioError = (error: unknown) => {
  if (error && typeof error === "object") {
    const code = "code" in error ? error.code : null;
    if (typeof code === "number" || typeof code === "string") {
      return `twilio_${String(code)}`;
    }

    const status = "status" in error ? error.status : null;
    if (typeof status === "number" || typeof status === "string") {
      return `twilio_http_${String(status)}`;
    }
  }

  return "twilio_request_failed";
};

const logSkippedReservationSms = (
  input: Pick<SendReservationSmsAlertInput, "businessId" | "reservationId">,
  error: string,
  extra?: Record<string, unknown>
) => {
  if (error === "sms_alerts_disabled") {
    return;
  }

  log("warn", "Reservation SMS alert skipped", {
    businessId: input.businessId,
    reservationId: input.reservationId ?? null,
    reason: error,
    ...(extra ?? {})
  });
};

export async function sendReservationSmsAlert(
  input: SendReservationSmsAlertInput
): Promise<SendReservationSmsAlertResult> {
  try {
    const adminClient = input.adminClient ?? getSupabaseAdminClientIfAvailable();
    if (!adminClient) {
      logSkippedReservationSms(input, "admin_client_unavailable");
      return { ok: false, skipped: true, error: "admin_client_unavailable" };
    }

    const settingsResult = await loadBusinessSmsAlertSettings(adminClient, input.businessId);
    if (settingsResult.error || !settingsResult.data) {
      const error = settingsResult.error ?? "business_not_found";
      log("warn", "Reservation SMS alert failed", {
        businessId: input.businessId,
        reservationId: input.reservationId ?? null,
        reason: error
      });
      await logActivity({
        businessId: input.businessId,
        actorType: "system",
        eventType: "reservation_sms_alert_failed",
        summary: "Reservation SMS alert failed.",
        meta: {
          reservationId: input.reservationId ?? null,
          reason: error
        }
      });
      return { ok: false, error };
    }

    const env = readTwilioEnv();
    const recipient = resolveRecipientPhone(settingsResult.data, env);
    if (!recipient.ok) {
      logSkippedReservationSms(input, recipient.error, {
        recipientPreview: "recipientPreview" in recipient ? recipient.recipientPreview : undefined
      });
      return { ok: false, skipped: true, error: recipient.error };
    }

    if (!env.accountSid || !env.authToken) {
      logSkippedReservationSms(input, "missing_twilio_credentials", {
        recipientPreview: maskPhoneNumber(recipient.phone)
      });
      return { ok: false, skipped: true, error: "missing_twilio_credentials" };
    }

    const sender = resolveSender(env);
    if (!sender.ok) {
      logSkippedReservationSms(input, sender.error, {
        recipientPreview: maskPhoneNumber(recipient.phone)
      });
      return { ok: false, skipped: true, error: sender.error };
    }

    const body = buildReservationSmsBody(input);
    const client = await getTwilioClient(env);

    await client.messages.create({
      to: recipient.phone,
      body,
      ...sender.payload
    });

    await logActivity({
      businessId: input.businessId,
      actorType: "system",
      eventType: "reservation_sms_alert_sent",
      summary: "Reservation SMS alert sent.",
      meta: {
        reservationId: input.reservationId ?? null,
        recipientPreview: maskPhoneNumber(recipient.phone),
        recipientSource: recipient.source
      }
    });

    return { ok: true };
  } catch (error) {
    const safeError = toSafeTwilioError(error);
    log("warn", "Reservation SMS alert failed", {
      businessId: input.businessId,
      reservationId: input.reservationId ?? null,
      reason: safeError
    });
    await logActivity({
      businessId: input.businessId,
      actorType: "system",
      eventType: "reservation_sms_alert_failed",
      summary: "Reservation SMS alert failed.",
      meta: {
        reservationId: input.reservationId ?? null,
        reason: safeError
      }
    });
    return { ok: false, error: safeError };
  }
}
