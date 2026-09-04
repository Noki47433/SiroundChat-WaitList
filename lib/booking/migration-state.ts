/**
 * Phase 2 · Stage 4 · S1 — Per-business booking cutover-state resolver.
 *
 * Server-authoritative. The DB (business_booking_migration + neutral_booking_state())
 * is the source of truth; this module is a thin, typed accessor plus the pure
 * write-target and transition-legality logic that later substages consume.
 *
 * INERT in S1: nothing in the app calls the DB-touching functions yet. Booking
 * read/write paths start consulting this in S2/S5/S8 — always behind the flag,
 * which defaults to `legacy` for every business.
 */

export const BOOKING_MIGRATION_STATES = [
  "legacy",
  "neutral_configuring",
  "neutral_ready",
  "neutral_active",
  "neutral_only"
] as const;

export type BookingMigrationState = (typeof BOOKING_MIGRATION_STATES)[number];

/** Where a business's NEW bookings are authoritatively written in a given state. */
export type BookingWriteTarget = "reservations" | "booking";

export function isBookingMigrationState(value: unknown): value is BookingMigrationState {
  return typeof value === "string" && (BOOKING_MIGRATION_STATES as readonly string[]).includes(value);
}

/**
 * The single authoritative write path per business (A3 §4). Never dual-write:
 * only one of these is the write target for any business at any moment.
 */
export function writeTargetForState(state: BookingMigrationState): BookingWriteTarget {
  return state === "neutral_active" || state === "neutral_only" ? "booking" : "reservations";
}

/**
 * Legal transitions of the per-business ratchet (mirrors the DB guard trigger in
 * 20260809120000_phase2_s1_booking_migration_state.sql). Kept in sync so callers
 * can validate before hitting the DB and surface friendly errors; the DB remains
 * the enforcing authority. `neutral_only` is terminal in the routine machine —
 * leaving it is a gated Stage-5 operation, not represented here.
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingMigrationState, readonly BookingMigrationState[]> = {
  legacy: ["neutral_configuring"],
  neutral_configuring: ["neutral_ready", "legacy"],
  neutral_ready: ["neutral_active", "neutral_configuring", "legacy"],
  neutral_active: ["neutral_only", "neutral_ready", "legacy"],
  neutral_only: []
} as const;

export function isLegalBookingTransition(
  from: BookingMigrationState,
  to: BookingMigrationState
): boolean {
  if (from === to) return true; // no-op (e.g. notes edit)
  return ALLOWED_BOOKING_TRANSITIONS[from].includes(to);
}

/**
 * Minimal shape of a Supabase-like client this module needs. Accepting the client
 * as a parameter keeps the resolver environment-agnostic (route client, server
 * component client, or service-role client) and trivially unit-testable.
 */
type RpcCapableClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Resolve a business's booking cutover state. Fails safe to `legacy` on any
 * error or unrecognized value — an unreachable DB or malformed state must never
 * silently flip a business onto the neutral write path.
 */
export async function getBookingState(
  client: RpcCapableClient,
  businessId: string
): Promise<BookingMigrationState> {
  try {
    const { data, error } = await client.rpc("neutral_booking_state", {
      target_business_id: businessId
    });
    if (error) return "legacy";
    return isBookingMigrationState(data) ? data : "legacy";
  } catch {
    return "legacy";
  }
}

/** Convenience: resolve the authoritative write target for a business. */
export async function resolveWriteTarget(
  client: RpcCapableClient,
  businessId: string
): Promise<BookingWriteTarget> {
  return writeTargetForState(await getBookingState(client, businessId));
}
