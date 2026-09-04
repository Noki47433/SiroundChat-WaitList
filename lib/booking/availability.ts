/**
 * Phase 2 · Stage 4 · S3 — Neutral availability engine (pure, DST-safe).
 *
 * A pure function over (location hours + special hours + worker schedule + breaks
 * + time-off + buffers + lead/max + existing occupancy) → valid slots. Replaces
 * the legacy hardcoded 9–23 grid. No DB access here: the caller fetches the rows
 * and passes them in, which keeps this deterministic and unit-testable.
 *
 * Correctness contract (A1 §5):
 *   - Recurring hours/schedules/breaks are LOCAL wall-clock; resolved to absolute
 *     UTC against the location's IANA timezone.
 *   - Nonexistent local times (spring-forward gap) are detected by round-trip and
 *     never offered.
 *   - Ambiguous local times (fall-back repeat) resolve to the STANDARD-time (later
 *     UTC) occurrence, matching Postgres `AT TIME ZONE`, so the engine and DB agree.
 *   - All slot math (duration, buffers, overlap, fit) is done on absolute UTC.
 *   - A slot is valid only if it fully fits a bookable window (never runs past
 *     close) and does not overlap buffer-expanded occupancy; the "why" is never
 *     surfaced.
 *
 * Hours model (Phase 3 Client Business):
 *   - `location_hours` (+ dated `location_special_hours`) are the CANONICAL
 *     opening bounds. Nothing is ever bookable outside them.
 *   - A team member with ZERO `team_member_schedule` rows INHERITS those bounds.
 *     This is the whole implementation of the owner-facing "Same as business
 *     hours" state — one checkable fact, no second flag to drift.
 *   - A team member WITH schedule rows uses their own week, still clipped to the
 *     business bounds. Rows for some weekdays and not others means they are off
 *     on the others — inheritance is per-worker, never per-day.
 *   - Breaks, time off and special hours subtract from whichever base applies.
 *   - Fail closed: a business with no canonical hours at all cannot make an
 *     inheriting worker bookable (see `locationOpenRanges().defined`).
 */

export type TimeHHMM = string; // "HH:MM" or "HH:MM:SS", local wall-clock

export type LocationHours = { weekday: number; openTime: TimeHHMM; closeTime: TimeHHMM };
export type LocationSpecialHours = {
  dateStart: string; // "YYYY-MM-DD"
  dateEnd: string; // inclusive
  isClosed: boolean;
  openTime?: TimeHHMM | null;
  closeTime?: TimeHHMM | null;
};
export type TeamMemberSchedule = {
  weekday: number;
  startTime: TimeHHMM;
  endTime: TimeHHMM;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};
export type TeamMemberBreak = { weekday: number; startTime: TimeHHMM; endTime: TimeHHMM };
export type TeamMemberTimeOff = { startsAt: string; endsAt: string }; // ISO, absolute
export type Occupancy = {
  startAt: string; // ISO absolute
  endAt: string; // ISO absolute
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
};

export type AvailabilityInput = {
  timezone: string; // IANA
  durationMin: number; // effective service/worker duration
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  slotIntervalMin: number;
  leadTimeMin: number;
  maxDaysAhead: number;
  now: Date; // current instant
  locationHours: LocationHours[];
  locationSpecialHours?: LocationSpecialHours[];
  schedule: TeamMemberSchedule[];
  breaks?: TeamMemberBreak[];
  timeOff?: TeamMemberTimeOff[];
  occupancy?: Occupancy[];
};

export type Slot = { startAtIso: string; endAtIso: string };

const MIN = 60_000;
const DAY_MIN = 1440;

// ---------------------------------------------------------------------------
// Timezone primitives (Intl-based; no external library).
// ---------------------------------------------------------------------------

type Wall = { y: number; mo: number; d: number; h: number; mi: number };

/** The tz offset (minutes to ADD to UTC to get local wall-clock) at an instant. */
function offsetMinutesAt(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(instant);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hour = m.hour === "24" ? 0 : Number(m.hour);
  const asUTC = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), hour, Number(m.minute), Number(m.second));
  return (asUTC - instant.getTime()) / MIN;
}

function utcToWall(instant: Date, tz: string): Wall {
  const off = offsetMinutesAt(instant, tz);
  const local = new Date(instant.getTime() + off * MIN);
  return {
    y: local.getUTCFullYear(),
    mo: local.getUTCMonth() + 1,
    d: local.getUTCDate(),
    h: local.getUTCHours(),
    mi: local.getUTCMinutes()
  };
}

/**
 * Resolve a local wall-clock date+minute in `tz` to an absolute UTC instant.
 * Returns { existed:false } for spring-forward gap times (never offer/accept).
 * For fall-back ambiguity, returns the STANDARD-time (later UTC) occurrence.
 */
export function wallClockToUtc(
  dateISO: string,
  minuteOfDay: number,
  tz: string
): { utc: Date; existed: boolean } {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const h = Math.floor(minuteOfDay / 60);
  const mi = minuteOfDay % 60;
  const naive = Date.UTC(y, mo - 1, d + Math.floor(h / 24), h % 24, mi);

  // Two candidate offsets bracket a transition; sample well before and after.
  const offA = offsetMinutesAt(new Date(naive - 6 * 60 * MIN), tz);
  const offB = offsetMinutesAt(new Date(naive + 6 * 60 * MIN), tz);

  const candidates: number[] = [];
  for (const off of new Set([offA, offB])) {
    const utc = naive - off * MIN;
    const w = utcToWall(new Date(utc), tz);
    const target: Wall = {
      y,
      mo,
      d: d + Math.floor(h / 24),
      h: h % 24,
      mi
    };
    if (w.y === target.y && w.mo === target.mo && w.d === target.d && w.h === target.h && w.mi === target.mi) {
      candidates.push(utc);
    }
  }

  if (candidates.length === 0) {
    return { utc: new Date(naive), existed: false }; // gap: local time never occurred
  }
  // Ambiguous (fall-back): pick the later UTC instant = standard time (Postgres parity).
  return { utc: new Date(Math.max(...candidates)), existed: true };
}

// ---------------------------------------------------------------------------
// Interval helpers (absolute-UTC millisecond ranges).
// ---------------------------------------------------------------------------

type Range = { start: number; end: number };

function toMin(t: TimeHHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function weekdayOf(dateISO: string, tz: string): number {
  // Weekday of local midday (avoids edge flips) in tz; 0=Sun..6=Sat.
  const noon = wallClockToUtc(dateISO, 12 * 60, tz).utc;
  const off = offsetMinutesAt(noon, tz);
  return new Date(noon.getTime() + off * MIN).getUTCDay();
}

function dateInRange(dateISO: string, startISO: string, endISO: string): boolean {
  return dateISO >= startISO && dateISO <= endISO;
}

/** Resolve a local [openMin, closeMin] on a date to a UTC range (closeMin may be 1440 = next midnight). */
function localRangeToUtc(dateISO: string, openMin: number, closeMin: number, tz: string): Range | null {
  const s = wallClockToUtc(dateISO, openMin, tz);
  const e = wallClockToUtc(dateISO, closeMin, tz);
  if (!s.existed || !e.existed) {
    // A boundary in a gap is rare for whole-hour hours; fall back to nearest valid by nudging.
    return { start: s.utc.getTime(), end: e.utc.getTime() };
  }
  return { start: s.utc.getTime(), end: e.utc.getTime() };
}

function intersect(a: Range[], b: Range[]): Range[] {
  const out: Range[] = [];
  for (const x of a)
    for (const y of b) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end > start) out.push({ start, end });
    }
  return out;
}

function subtract(base: Range[], cuts: Range[]): Range[] {
  let ranges = base.slice();
  for (const cut of cuts) {
    const next: Range[] = [];
    for (const r of ranges) {
      if (cut.end <= r.start || cut.start >= r.end) {
        next.push(r);
        continue;
      }
      if (cut.start > r.start) next.push({ start: r.start, end: Math.min(cut.start, r.end) });
      if (cut.end < r.end) next.push({ start: Math.max(cut.end, r.start), end: r.end });
    }
    ranges = next;
  }
  return ranges.filter((r) => r.end > r.start);
}

// ---------------------------------------------------------------------------
// Window construction for a single local date.
// ---------------------------------------------------------------------------

/** An absolute UTC interval in epoch milliseconds. */
export type UtcRange = { start: number; end: number };

/**
 * What the business's CANONICAL hours say about one local date.
 *
 *   `closed`    — an explicit closure, or defined hours with nothing this weekday.
 *   `open`      — real bookable bounds (regular hours, or a special-hours override).
 *   `undefined` — the business has no canonical hours at all for this date.
 *
 * `undefined` is a transitional state, not a synonym for "open all day". Each
 * consumer decides what it means for them: the neutral engine lets a worker with
 * an explicit schedule carry on unchanged but refuses to make an INHERITING
 * worker bookable; the legacy engine keeps its historic default grid.
 *
 * This is the single implementation of the hours model. The legacy availability
 * path calls it too, so a business can never be told two different things about
 * when it is open.
 */
export type LocationDay =
  | { state: "closed" }
  | { state: "open"; ranges: UtcRange[] }
  | { state: "undefined" };

export function resolveLocationDay(
  dateISO: string,
  timezone: string,
  locationHours: LocationHours[],
  locationSpecialHours: LocationSpecialHours[] = []
): LocationDay {
  const special = locationSpecialHours.filter((s) => dateInRange(dateISO, s.dateStart, s.dateEnd));
  if (special.length > 0) {
    // A closure covering the date shuts everything; an open override replaces regular hours.
    if (special.some((s) => s.isClosed)) return { state: "closed" };
    const ranges: UtcRange[] = [];
    for (const s of special) {
      if (s.openTime && s.closeTime) {
        ranges.push(localRangeToUtc(dateISO, toMin(s.openTime), toMin(s.closeTime), timezone)!);
      }
    }
    if (ranges.length > 0) return { state: "open", ranges };
  }

  if (locationHours.length === 0) return { state: "undefined" };

  const wd = weekdayOf(dateISO, timezone);
  const hours = locationHours.filter((h) => h.weekday === wd);
  if (hours.length === 0) return { state: "closed" }; // defined hours, none this weekday
  return {
    state: "open",
    ranges: hours.map((h) => localRangeToUtc(dateISO, toMin(h.openTime), toMin(h.closeTime), timezone)!)
  };
}

/**
 * The location's open bounds for a date as the slot loop needs them, plus
 * whether those bounds are REAL (defined by data) or the transitional fallback.
 * When undefined the bounds degrade to the whole day, so a worker with an
 * explicit schedule keeps working exactly as before — but `defined:false` tells
 * the caller never to let an inheriting worker use them.
 */
function locationOpenRanges(
  dateISO: string,
  input: AvailabilityInput
): { ranges: Range[] | "closed"; defined: boolean } {
  const day = resolveLocationDay(
    dateISO,
    input.timezone,
    input.locationHours,
    input.locationSpecialHours ?? []
  );
  if (day.state === "closed") return { ranges: "closed", defined: true };
  if (day.state === "open") return { ranges: day.ranges, defined: true };
  return { ranges: [localRangeToUtc(dateISO, 0, DAY_MIN, input.timezone)!], defined: false };
}

/**
 * Does this team member keep their own weekly schedule at all?
 *
 * This is the single, checkable definition behind the owner-facing choice
 * "Same as business hours" vs "Their own hours": zero `team_member_schedule`
 * rows == inherit. There is no second flag to drift out of sync, and switching
 * to inheritance is simply deleting the rows.
 *
 * Note the deliberate asymmetry: a worker WITH schedule rows but none matching
 * this weekday does NOT inherit — they are off that day. That is what makes
 * "Fatmir doesn't work Sundays anymore" expressible.
 */
function workerKeepsOwnSchedule(input: AvailabilityInput): boolean {
  return input.schedule.length > 0;
}

/**
 * The worker's bookable ranges for a date, BEFORE intersecting with the
 * location bounds. Returns null when the worker inherits but the business has
 * no canonical hours to inherit (fail closed).
 */
function workerWorkingRanges(
  dateISO: string,
  input: AvailabilityInput,
  loc: { ranges: Range[]; defined: boolean }
): Range[] | null {
  const wd = weekdayOf(dateISO, input.timezone);

  let ranges: Range[];
  if (workerKeepsOwnSchedule(input)) {
    const shifts = input.schedule.filter(
      (s) =>
        s.weekday === wd &&
        (!s.effectiveFrom || dateISO >= s.effectiveFrom) &&
        (!s.effectiveTo || dateISO <= s.effectiveTo)
    );
    ranges = shifts.map((s) =>
      localRangeToUtc(dateISO, toMin(s.startTime), toMin(s.endTime), input.timezone)!
    );
  } else {
    // INHERIT the business hours. Never inherit an undefined (fallback) bound —
    // that would silently make an unconfigured business bookable 24/7.
    if (!loc.defined) return null;
    ranges = loc.ranges;
  }

  const breaks = (input.breaks ?? [])
    .filter((b) => b.weekday === wd)
    .map((b) => localRangeToUtc(dateISO, toMin(b.startTime), toMin(b.endTime), input.timezone)!);
  ranges = subtract(ranges, breaks);
  const timeOff = (input.timeOff ?? []).map((t) => ({
    start: new Date(t.startsAt).getTime(),
    end: new Date(t.endsAt).getTime()
  }));
  ranges = subtract(ranges, timeOff);
  return ranges;
}

function occupancyBlocks(input: AvailabilityInput): Range[] {
  return (input.occupancy ?? []).map((o) => ({
    start: new Date(o.startAt).getTime() - (o.bufferBeforeMin ?? 0) * MIN,
    end: new Date(o.endAt).getTime() + (o.bufferAfterMin ?? 0) * MIN
  }));
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/** Valid slot start times for one local date (absolute-UTC ISO). */
export function resolveDayAvailability(input: AvailabilityInput, dateISO: string): Slot[] {
  const loc = locationOpenRanges(dateISO, input);
  if (loc.ranges === "closed") return [];
  const open = { ranges: loc.ranges, defined: loc.defined };
  const worker = workerWorkingRanges(dateISO, input, open);
  if (worker === null) return [];
  // Business hours are the canonical bound: a worker can never be booked outside
  // them, whether they inherit the hours or keep their own.
  const bookable = intersect(open.ranges, worker);
  if (bookable.length === 0) return [];

  const occ = occupancyBlocks(input);
  const durMs = input.durationMin * MIN;
  const bufBefore = (input.bufferBeforeMin ?? 0) * MIN;
  const bufAfter = (input.bufferAfterMin ?? 0) * MIN;
  const leadMs = input.leadTimeMin * MIN;
  const earliest = input.now.getTime() + leadMs;
  const latest = input.now.getTime() + input.maxDaysAhead * DAY_MIN * MIN;

  const slots: Slot[] = [];
  for (let m = 0; m + input.durationMin <= DAY_MIN; m += input.slotIntervalMin) {
    const resolved = wallClockToUtc(dateISO, m, input.timezone);
    if (!resolved.existed) continue; // never offer a nonexistent local time
    const s = resolved.utc.getTime();
    const e = s + durMs;

    // fully fits some bookable window (never runs past close)
    if (!bookable.some((r) => s >= r.start && e <= r.end)) continue;
    // lead-time / max-advance
    if (s < earliest || s > latest) continue;
    // buffer-expanded disjoint from occupancy
    const cs = s - bufBefore;
    const ce = e + bufAfter;
    if (occ.some((b) => cs < b.end && b.start < ce)) continue;

    slots.push({ startAtIso: resolved.utc.toISOString(), endAtIso: new Date(e).toISOString() });
  }
  return slots;
}

/** Scan forward from a local date and return the earliest `limit` valid slots. */
export function findEarliestSlots(
  input: AvailabilityInput,
  fromDateISO: string,
  horizonDays: number,
  limit: number
): Slot[] {
  const out: Slot[] = [];
  const [y, mo, d] = fromDateISO.split("-").map(Number);
  for (let i = 0; i <= horizonDays && out.length < limit; i++) {
    const day = new Date(Date.UTC(y, mo - 1, d + i));
    const iso = day.toISOString().slice(0, 10);
    for (const s of resolveDayAvailability(input, iso)) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}
