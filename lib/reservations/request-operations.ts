import "server-only";

import { sendReservationSmsAlert } from "@/lib/server/twilio";
import { log } from "@/lib/utils/log";
import type { ActionType } from "@/lib/config/industry-presets";

export class RequestOperationError extends Error {
  status: number;
  code: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "RequestOperationError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "request_operation_failed";
  }
}

type CreateGenericRequestParams = {
  adminClient: any;
  businessId: string;
  actionType: ActionType;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  collectedFields?: Record<string, unknown> | null;
  conversationId?: string | null;
  sourceConversationId?: string | null;
  source?: "website" | "whatsapp" | "manual";
  sendSmsAlert?: boolean;
};

const cleanNullableText = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function createGenericRequestRecord({
  adminClient,
  businessId,
  actionType,
  customerName,
  customerPhone,
  customerEmail,
  notes,
  collectedFields,
  conversationId = null,
  sourceConversationId = null,
  source = "website",
  sendSmsAlert = true,
}: CreateGenericRequestParams) {
  const safeName = customerName.trim() || "Customer";
  const cleanPhone = cleanNullableText(customerPhone);
  const cleanEmail = cleanNullableText(customerEmail);
  const cleanNotes = cleanNullableText(notes);
  const now = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    business_id: businessId,
    action_type: actionType,
    conversation_id: conversationId,
    source_conversation_id: sourceConversationId,
    customer_name: safeName,
    customer_phone: cleanPhone,
    customer_email: cleanEmail,
    notes: cleanNotes,
    special_request: cleanNotes,
    collected_fields: collectedFields ?? null,
    // Use now as placeholder; actual preferred time is captured in notes/collected_fields
    start_at: now,
    end_at: now,
    datetime: now,
    party_size: null,
    restaurant_id: null,
    status: "pending",
    created_by: source === "manual" ? "dashboard" : "chatbot",
    source,
  };

  const { data: created, error: createError } = await adminClient
    .from("reservations")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError || !created) {
    throw new RequestOperationError(createError?.message ?? "Failed to create request record.", {
      status: 500,
      code: "request_insert_failed",
    });
  }

  if (sendSmsAlert && cleanPhone) {
    try {
      await sendReservationSmsAlert({
        adminClient,
        businessId,
        reservationId: created.id as string,
        name: safeName,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: "",
        guests: 0,
        phone: cleanPhone,
      });
    } catch {
      log("warn", "Action request SMS alert threw unexpectedly", {
        businessId,
        requestId: created.id as string,
      });
    }
  }

  return { request: created };
}
