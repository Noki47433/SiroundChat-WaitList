/**
 * Phase 3 · Client Business — the workspace read model.
 *
 * ONE server-side loader that assembles everything the Business workspace shows,
 * from the canonical tables only. Business is the source of truth: nothing here
 * reads a duplicate copy out of onboarding text, the website builder or the
 * assistant's knowledge base.
 *
 * The shape is deliberately OWNER-FACING, not schema-facing. Callers get
 * "Tue – Sat 09:00–19:00" and "Fatmir, Rron", never weekday integers or join
 * tables, so no view layer has to understand the data model to render calmly.
 */
import { resolveBookingsCapabilities, type BookingsCapabilities } from "@/lib/bookings/capabilities";
import { resolveBotConfig } from "@/lib/config/industry-presets";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

// ---------------------------------------------------------------------------
// Owner-facing shapes
// ---------------------------------------------------------------------------

export type BusinessLocation = {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
  phone: string | null;
};

export type ServiceEligibility = {
  teamMemberId: string;
  teamMemberName: string;
  /** Only present when this worker actually overrides the service price. */
  priceCentsOverride: number | null;
  priceModeOverride: "fixed" | "from" | "hidden" | null;
  /** Only present when this worker actually overrides the duration. */
  durationMinOverride: number | null;
  eligibilityId: string;
};

export type BusinessService = {
  id: string;
  name: string;
  description: string | null;
  priceMode: "fixed" | "from" | "hidden";
  basePriceCents: number | null;
  currency: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  displayOrder: number;
  isActive: boolean;
  /** Everyone who can perform it, in team order. */
  performedBy: ServiceEligibility[];
  /** True when every active bookable team member can perform it. */
  performedByEveryone: boolean;
};

export type ScheduleBlock = { weekday: number; start: string; end: string };
export type BreakBlock = { id: string; weekday: number; start: string; end: string; label: string | null };
export type TimeOffBlock = {
  id: string;
  startsAt: string;
  endsAt: string;
  kind: string;
  reason: string | null;
  /** Set when the Assistant's Quick Knowledge created this absence. */
  source: "assistant" | null;
  overrideId: string | null;
};

export type BusinessTeamMember = {
  id: string;
  name: string;
  isBookable: boolean;
  isActive: boolean;
  /** ZERO schedule rows == follows business hours. This is the whole model. */
  followsBusinessHours: boolean;
  schedule: ScheduleBlock[];
  /** "Mon–Fri 09:00–18:00 · Sat 09:00–16:00", or null when they inherit. */
  scheduleSummary: string | null;
  breaks: BreakBlock[];
  timeOff: TimeOffBlock[];
  serviceIds: string[];
  /** Only the services where this person differs from the shop default. */
  overrides: Array<{
    serviceId: string;
    serviceName: string;
    priceCentsOverride: number | null;
    durationMinOverride: number | null;
  }>;
};

export type HoursRow = {
  /** "Monday", "Tue – Sat" — already grouped for display. */
  label: string;
  weekdays: number[];
  open: string | null;
  close: string | null;
  closed: boolean;
};

export type BusinessException = {
  id: string;
  kind: "special_hours" | "closure" | "time_off";
  title: string;
  startsOn: string;
  endsOn: string;
  /** "Closes 17:00" | "Closed" | "Away" */
  value: string;
  detail: string | null;
  /** Who created it — the Assistant's Quick Knowledge, or the owner here. */
  source: "assistant" | "business";
  overrideId: string | null;
  teamMemberId: string | null;
};

export type BusinessBookingSetup = {
  settingsId: string | null;
  locationScoped: boolean;
  approvalMode: "auto" | "manual";
  slotIntervalMin: number;
  leadTimeMin: number;
  maxDaysAhead: number;
  softHoldMinutes: number;
  cancellationWindowMin: number;
};

export type BusinessPayload = {
  businessId: string;
  businessName: string;
  capabilities: BookingsCapabilities;
  location: BusinessLocation | null;
  /** True when this business has canonical opening hours to show. */
  hasHours: boolean;
  hours: HoursRow[];
  /**
   * Eligibility rows that exist but are switched off. The editor reuses them
   * instead of inserting a duplicate when someone starts doing a service again
   * (there is a UNIQUE (team_member_id, service_id) constraint).
   */
  dormantEligibility: Array<{ id: string; teamMemberId: string; serviceId: string }>;
  rawHours: Array<{ weekday: number; open: string; close: string }>;
  exceptions: BusinessException[];
  services: BusinessService[];
  team: BusinessTeamMember[];
  booking: BusinessBookingSetup;
};

// ---------------------------------------------------------------------------
// Formatting helpers (owner language, never schema language)
// ---------------------------------------------------------------------------

const hhmm = (t: string | null | undefined): string => (t ? String(t).slice(0, 5) : "");

/** Collapse consecutive weekdays with identical hours into one display row. */
export function groupHours(rows: Array<{ weekday: number; open: string; close: string }>): HoursRow[] {
  const byDay = new Map<number, { open: string; close: string }>();
  for (const r of rows) byDay.set(r.weekday, { open: hhmm(r.open), close: hhmm(r.close) });

  // Present the week Monday-first; Sunday reads as the tail of the week, which is
  // how every business in the launch market talks about it.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const out: HoursRow[] = [];
  let run: { weekdays: number[]; open: string | null; close: string | null } | null = null;

  const flush = () => {
    if (!run) return;
    const first = run.weekdays[0];
    const last = run.weekdays[run.weekdays.length - 1];
    const label =
      run.weekdays.length === 1 ? WEEKDAY_LONG[first] : `${WEEKDAY_SHORT[first]} – ${WEEKDAY_SHORT[last]}`;
    out.push({ label, weekdays: run.weekdays, open: run.open, close: run.close, closed: run.open === null });
    run = null;
  };

  for (const wd of order) {
    const hours = byDay.get(wd) ?? null;
    const open = hours?.open ?? null;
    const close = hours?.close ?? null;
    if (run && run.open === open && run.close === close) {
      run.weekdays.push(wd);
    } else {
      flush();
      run = { weekdays: [wd], open, close };
    }
  }
  flush();
  return out;
}

/** "Mon–Fri 09:00–18:00 · Sat 09:00–16:00" from raw schedule blocks. */
export function summariseSchedule(blocks: ScheduleBlock[]): string | null {
  if (!blocks.length) return null;
  const byWindow = new Map<string, number[]>();
  for (const b of blocks) {
    const key = `${hhmm(b.start)}-${hhmm(b.end)}`;
    byWindow.set(key, [...(byWindow.get(key) ?? []), b.weekday]);
  }
  const parts: string[] = [];
  for (const [key, daysRaw] of byWindow) {
    const days = daysRaw.slice().sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
    const contiguous = days.every((d, i) => {
      if (i === 0) return true;
      const prev = days[i - 1] === 0 ? 7 : days[i - 1];
      const cur = d === 0 ? 7 : d;
      return cur === prev + 1;
    });
    const label =
      days.length === 1
        ? WEEKDAY_SHORT[days[0]]
        : contiguous
          ? `${WEEKDAY_SHORT[days[0]]}–${WEEKDAY_SHORT[days[days.length - 1]]}`
          : days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    const [open, close] = key.split("-");
    parts.push(`${label} ${open}–${close}`);
  }
  return parts.join(" · ");
}

const dateOnly = (iso: string): string => String(iso).slice(0, 10);

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

async function resolveActionType(supabase: SupabaseLike, businessId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("businesses")
      .select("onboarding_data")
      .eq("id", businessId)
      .maybeSingle();
    return resolveBotConfig((data as any)?.onboarding_data?.botConfig).actionType;
  } catch {
    return "appointment";
  }
}

export async function loadBusiness(supabase: SupabaseLike, businessId: string): Promise<BusinessPayload> {
  const actionType = await resolveActionType(supabase, businessId);
  const capabilities = await resolveBookingsCapabilities(supabase, businessId, {
    isRestaurant: actionType === "restaurant_reservation"
  });

  const { data: bizRow } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("id", businessId)
    .maybeSingle();

  const { data: locRows } = await supabase
    .from("location")
    .select("id, name, timezone, address, phone, is_primary")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });
  const locRow = (locRows ?? [])[0] as any | undefined;
  const location: BusinessLocation | null = locRow
    ? {
        id: locRow.id,
        name: locRow.name,
        timezone: locRow.timezone,
        address: locRow.address ?? null,
        phone: locRow.phone ?? null
      }
    : null;

  const [servicesRes, teamRes, eligRes, settingsRes] = await Promise.all([
    supabase
      .from("service")
      .select(
        "id, name, description, price_mode, base_price_cents, currency, base_duration_min, buffer_before_min, buffer_after_min, display_order, is_active"
      )
      .eq("business_id", businessId)
      .order("display_order"),
    supabase
      .from("team_member")
      .select("id, display_name, is_bookable, is_active")
      .eq("business_id", businessId)
      .order("created_at"),
    // Both active and inactive: an inactive row is how "this person no longer does
    // this service" is stored without deleting history (the booking FK is
    // ON DELETE RESTRICT, so past bookings keep their eligibility row alive).
    supabase
      .from("team_member_service")
      .select(
        "id, team_member_id, service_id, price_cents_override, price_mode_override, duration_min_override, is_active"
      )
      .eq("business_id", businessId),
    supabase
      .from("booking_settings")
      .select(
        "id, location_id, approval_mode, slot_interval_min, lead_time_min, max_days_ahead, soft_hold_minutes, cancellation_window_min"
      )
      .eq("business_id", businessId)
  ]);

  const teamRows = ((teamRes.data ?? []) as any[]).filter((t) => t.is_active);
  const memberIds = teamRows.map((t) => t.id);

  const [schedRes, breakRes, timeOffRes, hoursRes, specialRes, overrideRes] = await Promise.all([
    memberIds.length
      ? supabase
          .from("team_member_schedule")
          .select("id, team_member_id, weekday, start_time, end_time")
          .in("team_member_id", memberIds)
      : Promise.resolve({ data: [] as any[] }),
    memberIds.length
      ? supabase
          .from("team_member_break")
          .select("id, team_member_id, weekday, start_time, end_time, label")
          .in("team_member_id", memberIds)
      : Promise.resolve({ data: [] as any[] }),
    memberIds.length
      ? supabase
          .from("team_member_time_off")
          .select("id, team_member_id, starts_at, ends_at, kind, reason")
          .in("team_member_id", memberIds)
      : Promise.resolve({ data: [] as any[] }),
    location
      ? supabase.from("location_hours").select("id, weekday, open_time, close_time").eq("location_id", location.id)
      : Promise.resolve({ data: [] as any[] }),
    location
      ? supabase
          .from("location_special_hours")
          .select("id, date_start, date_end, is_closed, open_time, close_time, label")
          .eq("location_id", location.id)
          .order("date_start")
      : Promise.resolve({ data: [] as any[] }),
    // Provenance: which structured rows the Assistant's Quick Knowledge created.
    supabase
      .from("quick_knowledge_override")
      .select("id, structured_table, structured_ref, summary, status")
      .eq("business_id", businessId)
      .eq("status", "active")
  ]);

  const nameById = new Map<string, string>(teamRows.map((t) => [t.id, t.display_name]));
  const allEligRows = ((eligRes.data ?? []) as any[]).filter((e) => nameById.has(e.team_member_id));
  const eligRows = allEligRows.filter((e) => e.is_active);
  const serviceRows = (servicesRes.data ?? []) as any[];

  // -- services -------------------------------------------------------------
  const bookableCount = teamRows.filter((t) => t.is_bookable).length;
  const services: BusinessService[] = serviceRows.map((s) => {
    const performedBy: ServiceEligibility[] = eligRows
      .filter((e) => e.service_id === s.id)
      .sort((a, b) => memberIds.indexOf(a.team_member_id) - memberIds.indexOf(b.team_member_id))
      .map((e) => ({
        eligibilityId: e.id,
        teamMemberId: e.team_member_id,
        teamMemberName: nameById.get(e.team_member_id) ?? "",
        priceCentsOverride: e.price_cents_override ?? null,
        priceModeOverride: e.price_mode_override ?? null,
        durationMinOverride: e.duration_min_override ?? null
      }));
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      priceMode: s.price_mode,
      basePriceCents: s.base_price_cents ?? null,
      currency: s.currency ?? "EUR",
      durationMin: s.base_duration_min,
      bufferBeforeMin: s.buffer_before_min ?? 0,
      bufferAfterMin: s.buffer_after_min ?? 0,
      displayOrder: s.display_order ?? 0,
      isActive: s.is_active,
      performedBy,
      performedByEveryone: bookableCount > 0 && performedBy.length === bookableCount
    };
  });
  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));

  // -- provenance index -----------------------------------------------------
  const overrideRows = (overrideRes.data ?? []) as any[];
  const overrideByRef = new Map<string, { id: string; summary: string | null }>();
  for (const o of overrideRows) {
    if (o.structured_ref) overrideByRef.set(o.structured_ref, { id: o.id, summary: o.summary ?? null });
  }

  // -- team -----------------------------------------------------------------
  const schedRows = (schedRes.data ?? []) as any[];
  const breakRows = (breakRes.data ?? []) as any[];
  const timeOffRows = (timeOffRes.data ?? []) as any[];

  const team: BusinessTeamMember[] = teamRows.map((t) => {
    const schedule: ScheduleBlock[] = schedRows
      .filter((r) => r.team_member_id === t.id)
      .map((r) => ({ weekday: r.weekday, start: hhmm(r.start_time), end: hhmm(r.end_time) }));
    const mine = eligRows.filter((e) => e.team_member_id === t.id);
    return {
      id: t.id,
      name: t.display_name,
      isBookable: t.is_bookable,
      isActive: t.is_active,
      // The one checkable definition of "Same as business hours".
      followsBusinessHours: schedule.length === 0,
      schedule,
      scheduleSummary: summariseSchedule(schedule),
      breaks: breakRows
        .filter((r) => r.team_member_id === t.id)
        .map((r) => ({
          id: r.id,
          weekday: r.weekday,
          start: hhmm(r.start_time),
          end: hhmm(r.end_time),
          label: r.label ?? null
        })),
      timeOff: timeOffRows
        .filter((r) => r.team_member_id === t.id)
        .map((r) => {
          const prov = overrideByRef.get(r.id);
          return {
            id: r.id,
            startsAt: r.starts_at,
            endsAt: r.ends_at,
            kind: r.kind,
            reason: r.reason ?? null,
            source: prov ? ("assistant" as const) : null,
            overrideId: prov?.id ?? null
          };
        }),
      serviceIds: mine.map((e) => e.service_id),
      overrides: mine
        .filter((e) => e.price_cents_override != null || e.duration_min_override != null)
        .map((e) => ({
          serviceId: e.service_id,
          serviceName: serviceNameById.get(e.service_id) ?? "",
          priceCentsOverride: e.price_cents_override ?? null,
          durationMinOverride: e.duration_min_override ?? null
        }))
    };
  });

  // -- hours ----------------------------------------------------------------
  const rawHours = ((hoursRes.data ?? []) as any[]).map((r) => ({
    weekday: r.weekday,
    open: hhmm(r.open_time),
    close: hhmm(r.close_time)
  }));
  const hours = rawHours.length ? groupHours(rawHours) : [];

  // -- exceptions (special hours + worker absence, one calm list) ------------
  const todayISO = new Date().toISOString().slice(0, 10);
  const exceptions: BusinessException[] = [];

  for (const s of (specialRes.data ?? []) as any[]) {
    if (dateOnly(s.date_end) < todayISO) continue; // finished; the owner does not need it
    const prov = overrideByRef.get(s.id);
    exceptions.push({
      id: s.id,
      kind: s.is_closed ? "closure" : "special_hours",
      title: s.label || (s.is_closed ? "Closed" : "Different hours"),
      startsOn: dateOnly(s.date_start),
      endsOn: dateOnly(s.date_end),
      value: s.is_closed ? "Closed" : `Closes ${hhmm(s.close_time)}`,
      detail: s.is_closed ? null : `opens ${hhmm(s.open_time)}`,
      source: prov ? "assistant" : "business",
      overrideId: prov?.id ?? null,
      teamMemberId: null
    });
  }

  for (const member of team) {
    for (const off of member.timeOff) {
      if (dateOnly(off.endsAt) < todayISO) continue;
      exceptions.push({
        id: off.id,
        kind: "time_off",
        title: `${member.name} away`,
        startsOn: dateOnly(off.startsAt),
        endsOn: dateOnly(off.endsAt),
        value: "Away",
        detail: off.reason,
        source: off.source === "assistant" ? "assistant" : "business",
        overrideId: off.overrideId,
        teamMemberId: member.id
      });
    }
  }
  exceptions.sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  // -- booking setup --------------------------------------------------------
  const settingsRows = (settingsRes.data ?? []) as any[];
  const chosen = settingsRows.find((s) => s.location_id) ?? settingsRows[0] ?? null;
  const booking: BusinessBookingSetup = {
    settingsId: chosen?.id ?? null,
    locationScoped: Boolean(chosen?.location_id),
    approvalMode: chosen?.approval_mode === "manual" ? "manual" : "auto",
    slotIntervalMin: chosen?.slot_interval_min ?? 15,
    leadTimeMin: chosen?.lead_time_min ?? 60,
    maxDaysAhead: chosen?.max_days_ahead ?? 30,
    softHoldMinutes: chosen?.soft_hold_minutes ?? 15,
    cancellationWindowMin: chosen?.cancellation_window_min ?? 120
  };

  return {
    businessId,
    businessName: (bizRow as any)?.business_name ?? "Your business",
    capabilities,
    location,
    hasHours: rawHours.length > 0,
    hours,
    dormantEligibility: allEligRows
      .filter((e) => !e.is_active)
      .map((e) => ({ id: e.id, teamMemberId: e.team_member_id, serviceId: e.service_id })),
    rawHours,
    exceptions,
    services,
    team,
    booking
  };
}
