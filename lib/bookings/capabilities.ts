/**
 * Phase 3 — Unified Bookings workspace: capability detection.
 *
 * ONE Bookings product for every business. What the workspace can do inside it
 * is decided by the business's REAL Phase-2 booking cutover state — never by
 * brittle per-row checks like `if (row.team_member_id) neutral`.
 *
 * The single source of truth is `getBookingState()` (RPC `neutral_booking_state`,
 * fail-safe `legacy`) from `@/lib/booking/migration-state`. We derive the whole
 * capability set from that one state so legacy businesses render a clean
 * chronological experience today, and the same workspace progressively unlocks
 * worker lanes / structured services / availability-aware creation / approvals
 * the moment a business is cut over to the neutral write path.
 *
 * Backend support, verified against the real routes (do not enable what the
 * backend can't do):
 *   - Worker lanes / structured service / worker assignment / worker pricing:
 *       NEUTRAL only — legacy `reservation_compat` drops team_member_id/service_id.
 *   - Availability-aware create + Any-available:
 *       NEUTRAL only — `/api/booking/{availability,any-available,create}`
 *       (create/any-available are 409-gated on write-target === "booking").
 *   - Approvals + soft holds:
 *       NEUTRAL only — `booking_settings.approval_mode` + `hold`/`pending`→approve.
 *       Legacy manual create writes `confirmed`; legacy has no hold/approval.
 *   - Reschedule (time change):
 *       LEGACY has a safe in-place path (`PATCH /api/reservations/[id]/update`
 *       with start_at/duration_min). NEUTRAL has NO atomic reschedule operation,
 *       so it is DISABLED (`reschedule: false`) — we never cancel-then-create,
 *       which could destroy a valid booking if the replacement fails. Enabling
 *       neutral reschedule is a documented backend prerequisite. See
 *       `rescheduleStrategy`.
 *   - Complete / no-show / cancel / confirm: BOTH (different endpoints).
 *   - Seated: restaurant-legacy only (a restaurant concept we never bring into
 *       the neutral workspace).
 */

import {
  getBookingState,
  writeTargetForState,
  type BookingMigrationState
} from "@/lib/booking/migration-state";

/** The single Bookings product presents one of two capability tiers. */
export type BookingsMode = "legacy" | "neutral";

/**
 * How a reschedule is actually performed for this business, if at all.
 *
 * There is deliberately NO cancel-then-create strategy. Rescheduling a neutral
 * booking by canceling the old one and creating a new one is unsafe: if the
 * replacement fails (race, availability change, overlap constraint, network),
 * the customer is left with their original appointment destroyed and no
 * replacement. Neutral reschedule stays `"none"` until an atomic server-side
 * move operation exists.
 */
export type RescheduleStrategy =
  | "reservation_update" // legacy: PATCH /api/reservations/[id]/update (in place, supported)
  | "none"; // neutral: no atomic reschedule op yet -> capability disabled

export interface BookingsCapabilities {
  /** Raw per-business cutover state (audit / debugging / copy). */
  state: BookingMigrationState;
  /** Derived tier the UI branches on. */
  mode: BookingsMode;
  /** Where the workspace reads operational rows from. */
  readSource: "reservation_compat" | "booking";

  // ---- display enrichment (neutral-only) ----
  /** Multi-worker lane layout in Day view. Legacy falls back to chronological. */
  workerLanes: boolean;
  /** Structured service name + duration on rows/detail. */
  structuredServices: boolean;
  /** Assigned team member shown on rows/detail. */
  workerAssignment: boolean;
  /** Worker-specific price / duration surfaced. */
  workerPricing: boolean;

  // ---- creation ----
  /** Live availability-validated slot picking on create. */
  availabilityAwareCreate: boolean;
  /** "Any available" auto-assignment. */
  anyAvailable: boolean;
  /** Legacy manual create endpoint requires a party_size (default 1 off-restaurant). */
  requiresPartySize: boolean;

  // ---- lifecycle ----
  /** Pending-approval queue + soft holds (neutral only). */
  approvalsAndHolds: boolean;
  /** Can a booking's time be changed at all. */
  reschedule: boolean;
  rescheduleStrategy: RescheduleStrategy;
  complete: boolean;
  noShow: boolean;
  cancel: boolean;
  /** Move a pending booking to confirmed (legacy: status set; neutral: approve). */
  confirm: boolean;
  /** Restaurant-only "seated" state; never surfaced in the neutral workspace. */
  seated: boolean;

  // ---- Phase 3 Client Business: which Business edits reach a live engine ----
  /**
   * Opening hours, special hours and closures. TRUE IN EVERY STATE since Phase 3:
   * the legacy availability path now reads the same `location_hours` /
   * `location_special_hours` rows the neutral engine does (see
   * `lib/booking/canonical-hours`), so an hours edit is always operational truth.
   */
  businessHoursAreLive: boolean;
  /**
   * Services, prices and durations reaching the BOOKING engine. Neutral only —
   * a legacy reservation has no service concept to carry them. They always reach
   * the assistant, which is why the UI says "your assistant uses this now"
   * rather than implying nothing happened.
   */
  businessServicesAreLive: boolean;
  /** Team assignment + per-worker overrides reaching bookings. Neutral only. */
  businessTeamIsLive: boolean;
}

export interface CapabilityOptions {
  /**
   * Whether this business is a restaurant (legacy only). Enables the `seated`
   * lifecycle. Resolve from the business action-type; defaults to false so
   * non-restaurant businesses never see restaurant concepts.
   */
  isRestaurant?: boolean;
}

/**
 * Pure mapping: cutover state -> capability set. No I/O, unit-testable.
 * Neutral tier == the business writes to the neutral `booking` table, i.e.
 * `writeTargetForState(state) === "booking"` (neutral_active / neutral_only).
 */
export function capabilitiesForState(
  state: BookingMigrationState,
  opts: CapabilityOptions = {}
): BookingsCapabilities {
  const neutral = writeTargetForState(state) === "booking";
  const isRestaurant = !!opts.isRestaurant && !neutral;

  return {
    state,
    mode: neutral ? "neutral" : "legacy",
    readSource: neutral ? "booking" : "reservation_compat",

    workerLanes: neutral,
    structuredServices: neutral,
    workerAssignment: neutral,
    workerPricing: neutral,

    availabilityAwareCreate: neutral,
    anyAvailable: neutral,
    requiresPartySize: !neutral,

    approvalsAndHolds: neutral,
    // SAFETY: legacy reschedules in place; neutral reschedule is intentionally
    // DISABLED until an atomic server-side move exists (never cancel-then-create).
    reschedule: !neutral,
    rescheduleStrategy: neutral ? "none" : "reservation_update",
    complete: true,
    noShow: true,
    cancel: true,
    confirm: true,
    seated: isRestaurant,

    // Phase 3 Business. Hours are canonical for BOTH engines; services and team
    // only reach bookings once a business writes to the neutral `booking` table.
    businessHoursAreLive: true,
    businessServicesAreLive: neutral,
    businessTeamIsLive: neutral
  };
}

/** Convenience: the tier alone (for cheap branch decisions). */
export function bookingsModeForState(state: BookingMigrationState): BookingsMode {
  return writeTargetForState(state) === "booking" ? "neutral" : "legacy";
}

type RpcCapableClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Resolve the live capability set for a business. Fails safe to the `legacy`
 * tier on any error (via `getBookingState`), so an unreachable DB can never
 * surface neutral-only affordances (worker lanes, holds) with no data behind
 * them.
 */
export async function resolveBookingsCapabilities(
  client: RpcCapableClient,
  businessId: string,
  opts: CapabilityOptions = {}
): Promise<BookingsCapabilities> {
  const state = await getBookingState(client, businessId);
  return capabilitiesForState(state, opts);
}
