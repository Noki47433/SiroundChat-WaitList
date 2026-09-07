/**
 * Phase 2 · Stage 4 · S10 — booking event emission (provider-neutral outbox).
 * Emitting is best-effort and post-commit: a failure here NEVER fails the booking.
 * The payload is provider-neutral booking facts and NEVER contains a raw token.
 */
type Admin = any;

export type BookingEventType =
  | "booking_created" | "booking_pending" | "booking_confirmed"
  | "booking_canceled" | "booking_rescheduled" | "booking_completed" | "booking_no_show";

export function statusToEventType(status: string): BookingEventType {
  switch (status) {
    case "pending": return "booking_pending";
    case "confirmed": return "booking_confirmed";
    case "hold": return "booking_created";
    default: return "booking_created";
  }
}

export async function emitBookingEvent(
  admin: Admin,
  input: { businessId: string; bookingId: string; type: BookingEventType; payload?: Record<string, unknown> }
): Promise<void> {
  try {
    const payload = { ...(input.payload ?? {}) };
    delete (payload as any).manageToken; // defensive: never persist a raw token
    delete (payload as any).manage_token;
    await admin.from("booking_event").insert({
      business_id: input.businessId,
      booking_id: input.bookingId,
      type: input.type,
      payload
    });
  } catch {
    // Notification emission must never break booking; swallow.
  }
}
