/**
 * Phase 2 · Stage 4 · S2 — Neutral booking write command.
 *
 * Thin, typed wrapper over the `create_booking` SECURITY DEFINER RPC. The RPC is
 * the authority on snapshots, status, liveness, eligibility and the exclusion
 * race; this module only marshals arguments and shapes the result.
 *
 * DORMANT: only reachable for businesses whose booking state is neutral_active /
 * neutral_only (write target `booking`). No such business exists yet, so this is
 * never called in production.
 */

export type BookingSource = "dashboard" | "chatbot" | "widget" | "phone" | "walk_in";

export type CreateBookingInput = {
  businessId: string;
  locationId: string;
  teamMemberId: string;
  serviceId: string;
  startAtIso: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  source?: BookingSource;
  conversationId?: string | null;
  createdByMembershipId?: string | null;
  notes?: string | null;
  collectedFields?: Record<string, unknown> | null;
  approvalMode?: "auto" | "manual" | null;
  asHold?: boolean;
  manageTokenHash?: string | null;
};

export type CreateBookingSuccess = {
  ok: true;
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  serviceName: string;
  priceMode: string;
  priceCents: number | null;
  currency: string;
  holdExpiresAt: string | null;
};

export type CreateBookingResult = CreateBookingSuccess | { ok: false; error: "slot_unavailable" };

export class BookingCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingCommandError";
  }
}

/** Pure mapping from the typed input to the RPC's named parameters. Exported for tests. */
export function toCreateBookingArgs(input: CreateBookingInput): Record<string, unknown> {
  return {
    p_business_id: input.businessId,
    p_location_id: input.locationId,
    p_team_member_id: input.teamMemberId,
    p_service_id: input.serviceId,
    p_start_at: input.startAtIso,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone ?? null,
    p_customer_email: input.customerEmail ?? null,
    p_source: input.source ?? "dashboard",
    p_conversation_id: input.conversationId ?? null,
    p_created_by_membership_id: input.createdByMembershipId ?? null,
    p_notes: input.notes ?? null,
    p_collected_fields: input.collectedFields ?? null,
    p_approval_mode: input.approvalMode ?? null,
    p_as_hold: input.asHold ?? false,
    p_manage_token_hash: input.manageTokenHash ?? null
  };
}

/** Parse the RPC's jsonb result into the typed union. Exported for tests. */
export function parseCreateBookingResult(data: unknown): CreateBookingResult {
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok !== true) {
    return { ok: false, error: "slot_unavailable" };
  }
  return {
    ok: true,
    id: String(row.id),
    status: String(row.status),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    durationMin: Number(row.duration_min),
    serviceName: String(row.service_name),
    priceMode: String(row.price_mode),
    priceCents: row.price_cents == null ? null : Number(row.price_cents),
    currency: String(row.currency),
    holdExpiresAt: row.hold_expires_at == null ? null : String(row.hold_expires_at)
  };
}

import { listEligibleWorkers, buildAvailabilityInput } from "./availability-service";
import { resolveDayAvailability } from "./availability";
import { emitBookingEvent, statusToEventType } from "@/lib/notifications/events";

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Execute the neutral booking write. `client` MUST be a service-role client, and
 * the caller MUST have already authorized `input.businessId` (session/conversation
 * derived) — the RPC does not re-check tenant ownership.
 */
export async function createBooking(
  client: RpcClient,
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const { data, error } = await client.rpc("create_booking", toCreateBookingArgs(input));
  if (error) {
    const message = (error as { message?: string })?.message ?? "create_booking failed";
    throw new BookingCommandError(message);
  }
  const result = parseCreateBookingResult(data);
  // S10: emit a provider-neutral event AFTER the booking is committed. Best-effort
  // (emitBookingEvent swallows errors) so notification never blocks booking.
  if (result.ok) {
    await emitBookingEvent(client as any, {
      businessId: input.businessId,
      bookingId: result.id,
      type: statusToEventType(result.status),
      payload: { status: result.status, startAt: result.startAt, serviceName: result.serviceName }
    });
  }
  return result;
}

export type AnyAvailableInput = Omit<CreateBookingInput, "teamMemberId"> & {
  dateISO: string; // local date of the requested slot, "YYYY-MM-DD"
  now?: Date;
};

export type AnyAvailableResult =
  | (CreateBookingSuccess & { assignedTeamMemberId: string })
  | { ok: false; error: "no_worker_available" };

/**
 * "Any available" (A1 §4): choose an eligible worker who is genuinely free for the
 * requested slot per the availability engine, assign deterministically
 * (least-loaded that day, id tiebreak), and claim atomically. If the winner loses
 * the exclusion race, fall through to the next candidate. Requires a service-role
 * client + a pre-authorized businessId.
 */
export async function createBookingAnyAvailable(
  admin: RpcClient & Record<string, any>,
  input: AnyAvailableInput
): Promise<AnyAvailableResult> {
  const now = input.now ?? new Date();
  const requestedInstant = new Date(input.startAtIso).getTime();

  const workers = await listEligibleWorkers(admin, input.businessId, input.locationId, input.serviceId);

  // Keep only workers whose schedule/hours actually offer the requested slot.
  const candidates: Array<{ id: string; load: number }> = [];
  for (const w of workers) {
    const ai = await buildAvailabilityInput(admin, {
      businessId: input.businessId,
      locationId: input.locationId,
      teamMemberId: w.id,
      serviceId: input.serviceId,
      dateISO: input.dateISO,
      now
    });
    if (!ai) continue;
    const slots = resolveDayAvailability(ai, input.dateISO);
    if (slots.some((s) => new Date(s.startAtIso).getTime() === requestedInstant)) {
      candidates.push({ id: w.id, load: ai.occupancy?.length ?? 0 });
    }
  }
  return assignAnyAvailable(candidates, (teamMemberId) =>
    createBooking(admin, { ...input, teamMemberId })
  );
}

/**
 * Pure assignment core: least-loaded-that-day selection with a deterministic id
 * tiebreak, then claim with fall-through on the exclusion race. Extracted so the
 * selection/retry behavior is unit-testable without a database.
 */
export async function assignAnyAvailable(
  candidates: Array<{ id: string; load: number }>,
  create: (teamMemberId: string) => Promise<CreateBookingResult>
): Promise<AnyAvailableResult> {
  if (candidates.length === 0) return { ok: false, error: "no_worker_available" };
  const ordered = [...candidates].sort((a, b) => a.load - b.load || a.id.localeCompare(b.id));
  for (const cand of ordered) {
    const result = await create(cand.id);
    if (result.ok) return { ...result, assignedTeamMemberId: cand.id };
    // slot_unavailable => this worker was just taken; try the next candidate.
  }
  return { ok: false, error: "no_worker_available" };
}
