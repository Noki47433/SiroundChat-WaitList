import "server-only";

import { sendReservationSmsAlert } from "@/lib/server/twilio";
import { log } from "@/lib/utils/log";
import {
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap,
  getDateLabel,
  getOrCreateReservationSettings,
  getTimeLabel,
  loadCapacityRelevantReservations,
  validateLeadAndMaxDays
} from "@/lib/reservations/service";

export class ReservationOperationError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, options?: { status?: number; code?: string; details?: Record<string, unknown> }) {
    super(message);
    this.name = "ReservationOperationError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "reservation_operation_failed";
    this.details = options?.details;
  }
}

export type ReservationCreateSource = "website" | "whatsapp" | "instagram" | "manual";
export type ReservationCreateBy = "dashboard" | "chatbot" | "widget" | "phone";
export type ReservationCreateStatus = "pending" | "confirmed";

type CreateReservationRecordParams = {
  adminClient: any;
  restaurantId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  partySize: number;
  startAtISO: string;
  notes?: string | null;
  source?: ReservationCreateSource;
  createdBy?: ReservationCreateBy;
  status?: ReservationCreateStatus;
  conversationId?: string | null;
  sourceConversationId?: string | null;
  sendSmsAlert?: boolean;
  enforceLeadAndMaxDays?: boolean;
};

const cleanNullableText = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function createReservationRecord({
  adminClient,
  restaurantId,
  customerName,
  customerPhone,
  customerEmail,
  partySize,
  startAtISO,
  notes,
  source = "website",
  createdBy = "chatbot",
  status = "confirmed",
  conversationId = null,
  sourceConversationId = null,
  sendSmsAlert = true,
  enforceLeadAndMaxDays = true
}: CreateReservationRecordParams) {
  const safeName = customerName.trim();
  if (!safeName) {
    throw new ReservationOperationError("Customer name is required.", {
      status: 400,
      code: "missing_customer_name"
    });
  }

  const startAt = new Date(startAtISO);
  if (Number.isNaN(startAt.getTime())) {
    throw new ReservationOperationError("Invalid reservation time.", {
      status: 400,
      code: "invalid_start_time"
    });
  }

  const restaurant = await ensureRestaurantBootstrap(adminClient, restaurantId);
  if (!restaurant) {
    throw new ReservationOperationError("Restaurant not found.", {
      status: 404,
      code: "restaurant_not_found"
    });
  }

  const settings = await getOrCreateReservationSettings(adminClient, restaurantId);
  const endAt = new Date(startAt.getTime() + settings.default_duration_min * 60_000);

  if (enforceLeadAndMaxDays) {
    const leadMaxValidation = validateLeadAndMaxDays(startAt, settings);
    if (!leadMaxValidation.ok) {
      throw new ReservationOperationError(leadMaxValidation.message, {
        status: 400,
        code: leadMaxValidation.code
      });
    }
  }

  const overlaps = await loadCapacityRelevantReservations(adminClient, {
    restaurantId,
    intervalStart: startAt,
    intervalEnd: endAt,
    settings
  });
  const usedCapacity = computeUsedCapacityForInterval(overlaps, startAt, endAt, settings);

  if (usedCapacity + partySize > restaurant.total_capacity) {
    throw new ReservationOperationError("Not enough capacity at that time.", {
      status: 409,
      code: "capacity_conflict",
      details: {
        remainingCapacity: Math.max(restaurant.total_capacity - usedCapacity, 0)
      }
    });
  }

  const cleanPhone = cleanNullableText(customerPhone);
  const cleanEmail = cleanNullableText(customerEmail);
  const cleanNotes = cleanNullableText(notes);

  const insertPayload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    business_id: restaurantId,
    action_type: "restaurant_reservation",
    conversation_id: conversationId,
    source_conversation_id: sourceConversationId,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    datetime: startAt.toISOString(),
    party_size: partySize,
    customer_name: safeName,
    customer_phone: cleanPhone,
    customer_email: cleanEmail,
    notes: cleanNotes,
    special_request: cleanNotes,
    status,
    created_by: createdBy,
    source
  };

  const { data: created, error: createError } = await adminClient
    .from("reservations")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError || !created) {
    throw new ReservationOperationError(createError?.message ?? "Failed to create reservation.", {
      status: 500,
      code: "reservation_insert_failed"
    });
  }

  if (sendSmsAlert) {
    try {
      await sendReservationSmsAlert({
        adminClient,
        businessId: restaurantId,
        reservationId: created.id as string,
        name: safeName,
        date: getDateLabel(startAt.toISOString(), restaurant.timezone ?? "Europe/Belgrade"),
        time: getTimeLabel(startAt.toISOString(), restaurant.timezone ?? "Europe/Belgrade"),
        guests: partySize,
        phone: cleanPhone
      });
    } catch {
      log("warn", "Reservation SMS alert threw unexpectedly", {
        businessId: restaurantId,
        reservationId: created.id as string
      });
    }
  }

  return {
    reservation: created,
    restaurant,
    settings
  };
}
