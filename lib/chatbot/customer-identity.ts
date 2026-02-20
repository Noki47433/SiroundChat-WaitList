import { extractLeadInfo } from "@/lib/notifications/detectors";
import { log } from "@/lib/utils/log";

export type CustomerIdentitySignals = {
  businessId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  channel?: string | null;
  externalId?: string | null;
  conversationId?: string | null;
  messageText?: string | null;
};

export type CustomerRecord = {
  id: string;
  business_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  external_ids?: Record<string, unknown>;
  tags?: string[];
  preferences?: Record<string, unknown>;
};

const normalizeEmail = (value?: string | null) => {
  const v = (value ?? "").trim().toLowerCase();
  return v || null;
};

const normalizePhone = (value?: string | null) => {
  const v = (value ?? "").trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 ? v : null;
};

export async function resolveCustomerIdentity(admin: any, signals: CustomerIdentitySignals): Promise<CustomerRecord | null> {
  const extracted = signals.messageText ? extractLeadInfo(signals.messageText) : { name: null, email: null, phone: null };
  const email = normalizeEmail(signals.email ?? extracted.email);
  const phone = normalizePhone(signals.phone ?? extracted.phone);
  const name = (signals.name ?? extracted.name ?? "").trim() || null;

  try {
    let existing: CustomerRecord | null = null;

    if (signals.channel && signals.externalId) {
      const { data } = await admin
        .from("customers")
        .select("id,business_id,name,email,phone,external_ids,tags,preferences")
        .eq("business_id", signals.businessId)
        .contains("external_ids", { [signals.channel]: signals.externalId })
        .maybeSingle();

      if (data?.id) {
        existing = data as CustomerRecord;
      }
    }

    if (!existing && email) {
      const { data } = await admin
        .from("customers")
        .select("id,business_id,name,email,phone,external_ids,tags,preferences")
        .eq("business_id", signals.businessId)
        .ilike("email", email)
        .maybeSingle();

      if (data?.id) {
        existing = data as CustomerRecord;
      }
    }

    if (!existing && phone) {
      const { data } = await admin
        .from("customers")
        .select("id,business_id,name,email,phone,external_ids,tags,preferences")
        .eq("business_id", signals.businessId)
        .eq("phone", phone)
        .maybeSingle();

      if (data?.id) {
        existing = data as CustomerRecord;
      }
    }

    if (!existing) {
      const { data, error } = await admin.rpc("ensure_customer_for_business", {
        p_business_id: signals.businessId,
        p_name: name,
        p_email: email,
        p_phone: phone,
        p_source_channel: signals.channel ?? null
      });

      if (error) {
        log("error", "Failed to create customer via ensure_customer_for_business", { error });
        return null;
      }

      existing = data as CustomerRecord;
    } else {
      const externalIds = { ...(existing.external_ids ?? {}) };
      if (signals.channel && signals.externalId) {
        externalIds[signals.channel] = signals.externalId;
      }

      const updatePayload: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!existing.name && name) updatePayload.name = name;
      if (!existing.email && email) updatePayload.email = email;
      if (!existing.phone && phone) updatePayload.phone = phone;
      if (Object.keys(externalIds).length) {
        updatePayload.external_ids = externalIds;
      }

      const { data: updated } = await admin
        .from("customers")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id,business_id,name,email,phone,external_ids,tags,preferences")
        .maybeSingle();

      existing = (updated as CustomerRecord | null) ?? existing;
    }

    if (!existing?.id) return null;

    await admin.from("customer_events").insert({
      business_id: signals.businessId,
      customer_id: existing.id,
      type: "message_received",
      payload: {
        conversation_id: signals.conversationId ?? null,
        channel: signals.channel ?? "web_chat",
        text_preview: (signals.messageText ?? "").slice(0, 200)
      }
    });

    return existing;
  } catch (error) {
    log("error", "resolveCustomerIdentity failed", { error });
    return null;
  }
}
