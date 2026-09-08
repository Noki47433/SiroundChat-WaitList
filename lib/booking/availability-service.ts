/**
 * Phase 2 · Stage 4 · S3/S6 — Availability data layer.
 *
 * Bridges the pure availability engine (`availability.ts`) to the database: it
 * fetches the neutral config/occupancy rows for a (business, location, worker,
 * service, date) and returns engine-ready inputs / resolved slots. Kept separate
 * from the pure engine so the engine stays unit-testable and this stays a thin,
 * side-effecting adapter.
 *
 * DORMANT: only invoked by the neutral booking/any-available paths, which are
 * gated to neutral_active businesses (none yet). Requires a service-role client.
 */
import {
  resolveDayAvailability,
  type AvailabilityInput,
  type Slot,
  type LocationHours,
  type LocationSpecialHours,
  type TeamMemberSchedule,
  type TeamMemberBreak,
  type TeamMemberTimeOff,
  type Occupancy
} from "./availability";

type Admin = any;

const OCCUPYING = ["hold", "pending", "confirmed", "completed"];

/**
 * Raised when a read this engine depends on did not answer.
 *
 * Stage 3D shipped the first half of this idea: an occupancy read that fails must
 * not degrade to "the day is wide open". Stage 3E finishes it. The distinction
 * that matters is not "did this come back empty" — a business with no booking
 * settings legitimately has none — it is "did the database actually answer".
 * Empty is data. An error is not, and an error must never be laundered into a
 * plausible-looking answer, because the resulting availability is indistinguishable
 * from the truth and only the business finds out, one empty chair at a time.
 */
export class AvailabilityReadError extends Error {
  constructor(readonly table: string, readonly code: string) {
    // Table and PostgREST code only: never a query, a row or a customer detail.
    super(`availability_read_failed:${table}:${code}`);
    this.name = "AvailabilityReadError";
  }
}

/** Throws on a failed read; an empty result is returned untouched, as data. */
const answered = (table: string, result: { data: any; error: any }): any => {
  if (result.error) {
    throw new AvailabilityReadError(table, String(result.error.code ?? "unknown"));
  }
  return result.data;
};

export type EligibleWorker = { id: string; displayName: string };

/** Active, bookable team members eligible for a service at a location. */
export async function listEligibleWorkers(
  admin: Admin,
  businessId: string,
  locationId: string,
  serviceId: string
): Promise<EligibleWorker[]> {
  const { data: elig } = await admin
    .from("team_member_service")
    .select("team_member_id")
    .eq("business_id", businessId)
    .eq("service_id", serviceId)
    .eq("is_active", true);
  const ids = (elig ?? []).map((r: any) => r.team_member_id);
  if (ids.length === 0) return [];

  const { data: workers } = await admin
    .from("team_member")
    .select("id, display_name, is_active, is_bookable, primary_location_id")
    .eq("business_id", businessId)
    .in("id", ids);

  return (workers ?? [])
    .filter(
      (w: any) =>
        w.is_active &&
        w.is_bookable &&
        (w.primary_location_id == null || w.primary_location_id === locationId)
    )
    .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))) // deterministic base order
    .map((w: any) => ({ id: w.id, displayName: w.display_name }));
}

/** Effective duration + buffers for a (worker, service) pair. */
async function effectiveServiceParams(
  admin: Admin,
  businessId: string,
  teamMemberId: string,
  serviceId: string
): Promise<{ durationMin: number; bufferBeforeMin: number; bufferAfterMin: number } | null> {
  const svc = answered(
    "service",
    await admin
      .from("service")
      .select("base_duration_min, buffer_before_min, buffer_after_min")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle()
  );
  if (!svc) return null;
  const elig = answered(
    "team_member_service",
    await admin
      .from("team_member_service")
      .select("duration_min_override, is_active")
      .eq("business_id", businessId)
      .eq("team_member_id", teamMemberId)
      .eq("service_id", serviceId)
      .maybeSingle()
  );
  if (!elig || !elig.is_active) return null;
  return {
    durationMin: elig.duration_min_override ?? svc.base_duration_min,
    bufferBeforeMin: svc.buffer_before_min ?? 0,
    bufferAfterMin: svc.buffer_after_min ?? 0
  };
}

/** Assemble the engine input for a worker/service/date, or null if not resolvable. */
export async function buildAvailabilityInput(
  admin: Admin,
  params: { businessId: string; locationId: string; teamMemberId: string; serviceId: string; dateISO: string; now: Date }
): Promise<AvailabilityInput | null> {
  const { businessId, locationId, teamMemberId, serviceId, dateISO, now } = params;

  const eff = await effectiveServiceParams(admin, businessId, teamMemberId, serviceId);
  if (!eff) return null;

  const loc = answered(
    "location",
    await admin
      .from("location")
      .select("timezone")
      .eq("id", locationId)
      .eq("business_id", businessId)
      .maybeSingle()
  );
  if (!loc) return null;

  // A failed settings read used to fall through to the built-in defaults, which
  // are more permissive than most real configurations: a business that requires a
  // day's notice would start offering "in an hour". Empty still means defaults.
  const settings = answered(
    "booking_settings",
    await admin
      .from("booking_settings")
      .select("slot_interval_min, lead_time_min, max_days_ahead, location_id")
      .eq("business_id", businessId)
      .order("location_id", { nullsFirst: false })
  );
  const chosen =
    (settings ?? []).find((s: any) => s.location_id === locationId) ?? (settings ?? [])[0] ?? null;

  // Opening hours are the one bound that widens when it goes missing: with no
  // hours the location's day degrades to "whole day", so a worker who keeps their
  // own schedule stops being clipped to business hours. A genuinely unconfigured
  // business still gets that transitional behaviour; a failed read does not.
  const [lhResult, lshResult, schResult, brkResult, toffResult] = await Promise.all([
    admin.from("location_hours").select("weekday, open_time, close_time").eq("location_id", locationId),
    admin
      .from("location_special_hours")
      .select("date_start, date_end, is_closed, open_time, close_time")
      .eq("location_id", locationId),
    admin
      .from("team_member_schedule")
      .select("weekday, start_time, end_time, effective_from, effective_to")
      .eq("team_member_id", teamMemberId),
    admin.from("team_member_break").select("weekday, start_time, end_time").eq("team_member_id", teamMemberId),
    admin.from("team_member_time_off").select("starts_at, ends_at").eq("team_member_id", teamMemberId)
  ]);
  const lh = answered("location_hours", lhResult);
  const lsh = answered("location_special_hours", lshResult);
  const sch = answered("team_member_schedule", schResult);
  const brk = answered("team_member_break", brkResult);
  const toff = answered("team_member_time_off", toffResult);

  // occupancy for this worker on the date (padded a day either side for buffers/tz)
  const dayStart = new Date(`${dateISO}T00:00:00Z`).getTime();
  const from = new Date(dayStart - 24 * 3600_000).toISOString();
  const to = new Date(dayStart + 48 * 3600_000).toISOString();
  // An occupancy read that fails must NOT degrade to "the day is wide open".
  // Every other input to this engine fails in the safe direction — a missing
  // schedule offers nothing — but a missing occupancy list offers times that are
  // already taken, which is the one failure a visitor cannot detect and the
  // business absorbs. So this read is the one that is allowed to throw.
  const occ = answered(
    "booking",
    await admin
      .from("booking")
      .select("start_at, end_at, status")
      .eq("team_member_id", teamMemberId)
      .in("status", OCCUPYING)
      .gte("start_at", from)
      .lte("start_at", to)
  );


  // Map snake_case DB columns to the pure engine's camelCase shape.
  return {
    timezone: loc.timezone,
    durationMin: eff.durationMin,
    bufferBeforeMin: eff.bufferBeforeMin,
    bufferAfterMin: eff.bufferAfterMin,
    slotIntervalMin: chosen?.slot_interval_min ?? 15,
    leadTimeMin: chosen?.lead_time_min ?? 60,
    maxDaysAhead: chosen?.max_days_ahead ?? 30,
    now,
    locationHours: (lh ?? []).map((r: any) => ({
      weekday: r.weekday, openTime: r.open_time, closeTime: r.close_time
    })) as LocationHours[],
    locationSpecialHours: (lsh ?? []).map((r: any) => ({
      dateStart: r.date_start, dateEnd: r.date_end, isClosed: r.is_closed,
      openTime: r.open_time, closeTime: r.close_time
    })) as LocationSpecialHours[],
    schedule: (sch ?? []).map((r: any) => ({
      weekday: r.weekday, startTime: r.start_time, endTime: r.end_time,
      effectiveFrom: r.effective_from, effectiveTo: r.effective_to
    })) as TeamMemberSchedule[],
    breaks: (brk ?? []).map((r: any) => ({
      weekday: r.weekday, startTime: r.start_time, endTime: r.end_time
    })) as TeamMemberBreak[],
    timeOff: (toff ?? []).map((r: any) => ({ startsAt: r.starts_at, endsAt: r.ends_at })) as TeamMemberTimeOff[],
    occupancy: (occ ?? []).map((o: any) => ({ startAt: o.start_at, endAt: o.end_at })) as Occupancy[]
  };
}

/** Resolve a worker's valid slots for a date. */
export async function resolveWorkerDaySlots(
  admin: Admin,
  params: { businessId: string; locationId: string; teamMemberId: string; serviceId: string; dateISO: string; now: Date }
): Promise<Slot[]> {
  const input = await buildAvailabilityInput(admin, params);
  if (!input) return [];
  return resolveDayAvailability(input, params.dateISO);
}
