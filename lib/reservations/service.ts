import { getTimeZoneOffsetMs } from "@/lib/utils/timezone";

export const DEFAULT_RESERVATION_SETTINGS = {
  slot_interval_min: 15,
  default_duration_min: 90,
  lead_time_min: 60,
  max_days_ahead: 30,
  buffer_before_min: 0,
  buffer_after_min: 0,
  auto_archive_after_hours: 72,
  lane_count: 12
} as const;

export const CAPACITY_ACTIVE_STATUSES = ["pending", "confirmed", "seated", "completed"] as const;

export type ReservationSettingsRow = {
  restaurant_id: string;
  slot_interval_min: number;
  default_duration_min: number;
  lead_time_min: number;
  max_days_ahead: number;
  buffer_before_min: number;
  buffer_after_min: number;
  auto_archive_after_hours: number;
  lane_count: number;
  created_at: string;
  updated_at: string;
};

export type RestaurantRow = {
  id: string;
  timezone: string | null;
  total_capacity: number;
};

export type ReservationRowForCapacity = {
  id: string;
  start_at: string;
  end_at: string;
  party_size: number;
  status: string;
};

export type LaneAssignableReservation = {
  id: string;
  start_at: string;
  end_at: string;
};

const clampPositiveInt = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
};

const clampNonNegativeInt = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
};

export const normalizeReservationSettings = (
  restaurantId: string,
  raw: Partial<ReservationSettingsRow> | null | undefined
): ReservationSettingsRow => ({
  restaurant_id: restaurantId,
  slot_interval_min: clampPositiveInt(raw?.slot_interval_min, DEFAULT_RESERVATION_SETTINGS.slot_interval_min),
  default_duration_min: clampPositiveInt(raw?.default_duration_min, DEFAULT_RESERVATION_SETTINGS.default_duration_min),
  lead_time_min: clampNonNegativeInt(raw?.lead_time_min, DEFAULT_RESERVATION_SETTINGS.lead_time_min),
  max_days_ahead: clampPositiveInt(raw?.max_days_ahead, DEFAULT_RESERVATION_SETTINGS.max_days_ahead),
  buffer_before_min: clampNonNegativeInt(raw?.buffer_before_min, DEFAULT_RESERVATION_SETTINGS.buffer_before_min),
  buffer_after_min: clampNonNegativeInt(raw?.buffer_after_min, DEFAULT_RESERVATION_SETTINGS.buffer_after_min),
  auto_archive_after_hours: clampPositiveInt(
    raw?.auto_archive_after_hours,
    DEFAULT_RESERVATION_SETTINGS.auto_archive_after_hours
  ),
  lane_count: clampPositiveInt(raw?.lane_count, DEFAULT_RESERVATION_SETTINGS.lane_count),
  created_at: raw?.created_at ?? new Date().toISOString(),
  updated_at: raw?.updated_at ?? new Date().toISOString()
});

export const parseDateOnly = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
};

export const localDateTimeToUtcDate = (dateOnly: string, hour: number, minute: number, timeZone: string) => {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const utcGuess = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute, 0, 0);
  const guessDate = new Date(utcGuess);
  const offset = getTimeZoneOffsetMs(guessDate, timeZone || "UTC");
  return new Date(utcGuess - offset);
};

export const localDateTimeStringToUtcDate = (dateOnly: string, hhmm: string, timeZone: string) => {
  const timeMatch = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) return null;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return localDateTimeToUtcDate(dateOnly, hour, minute, timeZone);
};

export const getTimeLabel = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

export const getDateLabel = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
};

export const validateLeadAndMaxDays = (startAt: Date, settings: ReservationSettingsRow) => {
  const now = new Date();
  const leadLimit = new Date(now.getTime() + settings.lead_time_min * 60_000);
  if (startAt.getTime() < leadLimit.getTime()) {
    return {
      ok: false,
      code: "lead_time",
      message: `Start time must be at least ${settings.lead_time_min} minutes from now.`
    } as const;
  }

  const maxAheadLimit = new Date(now.getTime() + settings.max_days_ahead * 24 * 60 * 60 * 1000);
  if (startAt.getTime() > maxAheadLimit.getTime()) {
    return {
      ok: false,
      code: "max_days_ahead",
      message: `Start time cannot be more than ${settings.max_days_ahead} days ahead.`
    } as const;
  }

  return { ok: true as const };
};

export const assignLaneIndexes = <T extends LaneAssignableReservation>(reservations: T[], laneCount: number) => {
  const safeLaneCount = Math.max(1, laneCount);
  const sorted = [...reservations].sort((a, b) => {
    const aStart = new Date(a.start_at).getTime();
    const bStart = new Date(b.start_at).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return a.id.localeCompare(b.id);
  });

  const laneLastEnd = Array.from({ length: safeLaneCount }, () => Number.NEGATIVE_INFINITY);
  const laneById = new Map<string, number>();

  for (const reservation of sorted) {
    const startMs = new Date(reservation.start_at).getTime();
    const endMs = new Date(reservation.end_at).getTime();

    let assignedLane = safeLaneCount;
    for (let lane = 0; lane < safeLaneCount; lane += 1) {
      if (startMs >= laneLastEnd[lane]) {
        assignedLane = lane;
        laneLastEnd[lane] = endMs;
        break;
      }
    }

    laneById.set(reservation.id, assignedLane);
  }

  return laneById;
};

const effectiveInterval = (startMs: number, endMs: number, settings: ReservationSettingsRow) => ({
  start: startMs - settings.buffer_before_min * 60_000,
  end: endMs + settings.buffer_after_min * 60_000
});

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart;

export const computeUsedCapacityForInterval = (
  rows: ReservationRowForCapacity[],
  intervalStart: Date,
  intervalEnd: Date,
  settings: ReservationSettingsRow,
  excludeReservationId?: string
) => {
  const requestedEffective = effectiveInterval(intervalStart.getTime(), intervalEnd.getTime(), settings);

  return rows.reduce((total, row) => {
    if (excludeReservationId && row.id === excludeReservationId) return total;
    if (!CAPACITY_ACTIVE_STATUSES.includes(row.status as (typeof CAPACITY_ACTIVE_STATUSES)[number])) return total;

    const existingStart = new Date(row.start_at).getTime();
    const existingEnd = new Date(row.end_at).getTime();
    if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return total;

    const existingEffective = effectiveInterval(existingStart, existingEnd, settings);
    if (overlaps(requestedEffective.start, requestedEffective.end, existingEffective.start, existingEffective.end)) {
      return total + Math.max(0, Number(row.party_size) || 0);
    }

    return total;
  }, 0);
};

export const generateSlotsForDate = (params: {
  date: string;
  timeZone: string;
  intervalMin: number;
  durationMin: number;
  startHour?: number;
  endHour?: number;
}) => {
  const {
    date,
    timeZone,
    intervalMin,
    durationMin,
    startHour = 9,
    endHour = 23 // TODO: hook to opening hours.
  } = params;

  const parsed = parseDateOnly(date);
  if (!parsed) return [] as Array<{ startAt: Date; endAt: Date }>;

  const slots: Array<{ startAt: Date; endAt: Date }> = [];
  const dayStartMin = startHour * 60;
  const dayEndMin = endHour * 60;

  for (let minuteOfDay = dayStartMin; minuteOfDay + durationMin <= dayEndMin; minuteOfDay += intervalMin) {
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const slotStart = localDateTimeToUtcDate(date, hour, minute, timeZone);
    if (!slotStart) continue;

    const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000);
    slots.push({ startAt: slotStart, endAt: slotEnd });
  }

  return slots;
};

export async function ensureRestaurantBootstrap(admin: any, restaurantId: string, userId?: string) {
  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id,timezone,owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (businessError || !business?.id) {
    return null;
  }

  const { data: existingRestaurant } = await admin
    .from("restaurants")
    .select("id,timezone,total_capacity")
    .eq("id", business.id)
    .maybeSingle();

  if (!existingRestaurant?.id) {
    await admin.from("restaurants").insert({
      id: business.id,
      timezone: business.timezone ?? "Europe/Belgrade",
      total_capacity: 40
    });
  } else if (!existingRestaurant.timezone && business.timezone) {
    await admin
      .from("restaurants")
      .update({ timezone: business.timezone })
      .eq("id", business.id);
  }

  if (userId && business.owner_id === userId) {
    await admin.from("restaurant_members").upsert(
      {
        restaurant_id: business.id,
        user_id: userId,
        role: "owner"
      },
      { onConflict: "restaurant_id,user_id" }
    );
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id,timezone,total_capacity")
    .eq("id", business.id)
    .maybeSingle();

  if (!restaurant?.id) return null;

  return {
    id: restaurant.id as string,
    timezone: (restaurant.timezone as string | null) ?? "Europe/Belgrade",
    total_capacity: clampPositiveInt(restaurant.total_capacity, 40)
  } as RestaurantRow;
}

export async function getOrCreateReservationSettings(client: any, restaurantId: string) {
  const { data: existing } = await client
    .from("reservation_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (existing) {
    return normalizeReservationSettings(restaurantId, existing as Partial<ReservationSettingsRow>);
  }

  const payload = {
    restaurant_id: restaurantId,
    ...DEFAULT_RESERVATION_SETTINGS
  };

  const { data: inserted, error: insertError } = await client
    .from("reservation_settings")
    .insert(payload)
    .select("*")
    .single();

  if (!insertError && inserted) {
    return normalizeReservationSettings(restaurantId, inserted as Partial<ReservationSettingsRow>);
  }

  const { data: retry } = await client
    .from("reservation_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return normalizeReservationSettings(restaurantId, (retry ?? payload) as Partial<ReservationSettingsRow>);
}

export async function loadCapacityRelevantReservations(
  client: any,
  args: {
    restaurantId: string;
    intervalStart: Date;
    intervalEnd: Date;
    settings: ReservationSettingsRow;
  }
) {
  const combinedBufferMin = args.settings.buffer_before_min + args.settings.buffer_after_min;
  const queryStart = new Date(args.intervalStart.getTime() - combinedBufferMin * 60_000).toISOString();
  const queryEnd = new Date(args.intervalEnd.getTime() + combinedBufferMin * 60_000).toISOString();

  const { data, error } = await client
    .from("reservations")
    .select("id,start_at,end_at,party_size,status")
    .eq("restaurant_id", args.restaurantId)
    .in("status", [...CAPACITY_ACTIVE_STATUSES])
    .lt("start_at", queryEnd)
    .gt("end_at", queryStart)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message ?? "Failed to load reservations for capacity check");
  }

  return (data ?? []) as ReservationRowForCapacity[];
}
