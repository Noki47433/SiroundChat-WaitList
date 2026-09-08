/**
 * Stage 3E — failed reads must never be mistaken for permissive answers.
 *   npx tsx tests/site-spec-failclosed.test.ts
 *
 * Stage 3D's production defect had a shape worth naming, because it will happen
 * again in some other file: the query was right, the code was right, and the
 * answer was wrong, because a read that did not answer was treated as a read that
 * answered "nothing". Nothing is a legitimate answer almost everywhere — and in
 * exactly a few places it is the most permissive answer there is:
 *
 *     no bookings          → every hour is free
 *     no opening hours     → the day has no bounds
 *     no booking settings  → use the built-in, more permissive defaults
 *     no admin row         → (this one is safe: not an admin)
 *
 * These tests hold a fake database that fails on demand, one table at a time, and
 * insist that each failure produces an error rather than an invented answer. They
 * also insist the opposite: a genuinely empty table still behaves exactly as it
 * did, because a business with no booking settings is not a broken business.
 */
import assert from "node:assert/strict";

import {
  AvailabilityReadError,
  buildAvailabilityInput,
  resolveWorkerDaySlots
} from "@/lib/booking/availability-service";
import { resolveDayAvailability } from "@/lib/booking/availability";

let passed = 0;
let failed = 0;
let queue: Promise<void> = Promise.resolve();
const ok = (name: string, fn: () => Promise<void> | void) => {
  queue = queue.then(async () => {
    try {
      await fn();
      console.log("PASS " + name);
      passed++;
    } catch (error) {
      console.error("FAIL " + name + "\n     " + (error as Error).message);
      failed++;
    }
  });
};

const BUSINESS = "11111111-1111-4111-8111-111111111111";
const LOCATION = "22222222-2222-4222-8222-222222222222";
const WORKER = "33333333-3333-4333-8333-333333333333";
const SERVICE = "44444444-4444-4444-8444-444444444444";
const DATE = "2026-10-14"; // a Wednesday

/** Rows a healthy, ordinary business has. */
const HEALTHY: Record<string, any[]> = {
  service: [{ base_duration_min: 30, buffer_before_min: 0, buffer_after_min: 0 }],
  team_member_service: [{ duration_min_override: null, is_active: true }],
  location: [{ timezone: "Europe/Belgrade" }],
  booking_settings: [
    { slot_interval_min: 30, lead_time_min: 1440, max_days_ahead: 14, location_id: LOCATION }
  ],
  location_hours: [
    { weekday: 3, open_time: "09:00", close_time: "17:00" }
  ],
  location_special_hours: [],
  // A worker who keeps their own, much broader schedule. This is the case where
  // losing the business hours actually widens what the public is offered.
  team_member_schedule: [{ weekday: 3, start_time: "00:00", end_time: "23:59", effective_from: null, effective_to: null }],
  team_member_break: [],
  team_member_time_off: [],
  booking: []
};

/**
 * The smallest thing that behaves like the Supabase client for these reads: a
 * chainable builder that ignores every filter and resolves to the rows for its
 * table — unless that table is in `failing`, in which case it resolves the way
 * PostgREST does when something goes wrong: `data: null`, and an error.
 */
const fakeAdmin = (rows: Record<string, any[]>, failing: Set<string> = new Set()) => {
  const build = (table: string) => {
    const settle = (single: boolean) => {
      if (failing.has(table)) {
        return Promise.resolve({ data: null, error: { code: "57014", message: "canceling statement" } });
      }
      const data = rows[table] ?? [];
      return Promise.resolve({ data: single ? (data[0] ?? null) : data, error: null });
    };
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      lte: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => settle(true),
      single: () => settle(true),
      then: (resolve: any, reject: any) => settle(false).then(resolve, reject)
    };
    return chain;
  };
  return { from: (table: string) => build(table) } as any;
};

const input = (admin: any) =>
  buildAvailabilityInput(admin, {
    businessId: BUSINESS,
    locationId: LOCATION,
    teamMemberId: WORKER,
    serviceId: SERVICE,
    dateISO: DATE,
    now: new Date("2026-10-01T09:00:00Z")
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1 · the healthy baseline — so the failure tests mean something
// ─────────────────────────────────────────────────────────────────────────────

ok("a healthy business produces slots inside its opening hours only", async () => {
  const built = await input(fakeAdmin(HEALTHY));
  assert.notEqual(built, null);
  const slots = resolveDayAvailability(built!, DATE);
  assert.ok(slots.length > 0, "expected some availability");
  // 09:00–17:00 Belgrade on that date is 07:00–15:00Z.
  for (const slot of slots) {
    const hour = new Date(slot.startAtIso).getUTCHours();
    assert.ok(hour >= 7 && hour < 15, `slot at ${slot.startAtIso} is outside business hours`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · a failed read may never invent availability
// ─────────────────────────────────────────────────────────────────────────────

const mustThrowFor = (table: string, why: string) =>
  ok(`a failed ${table} read throws rather than ${why}`, async () => {
    await assert.rejects(
      () => input(fakeAdmin(HEALTHY, new Set([table]))),
      (error: unknown) => {
        assert.ok(error instanceof AvailabilityReadError, `expected AvailabilityReadError, got ${error}`);
        assert.equal((error as AvailabilityReadError).table, table);
        // The message carries the table and the PostgREST code and nothing else:
        // no query, no row, no customer detail.
        assert.match((error as Error).message, /^availability_read_failed:[a-z_]+:[0-9A-Za-z]+$/);
        return true;
      }
    );
  });

mustThrowFor("booking", "reporting an empty diary and offering booked times");
mustThrowFor("location_hours", "dropping the opening-hours bound and offering the whole day");
mustThrowFor("booking_settings", "falling back to more permissive built-in defaults");
mustThrowFor("service", "guessing a duration");
mustThrowFor("team_member_service", "treating an unreadable eligibility as eligible");
mustThrowFor("location", "proceeding without a timezone");
mustThrowFor("team_member_schedule", "treating an unreadable schedule as inherited");
mustThrowFor("team_member_break", "ignoring breaks it could not read");
mustThrowFor("team_member_time_off", "booking over time off it could not read");

ok("resolveWorkerDaySlots surfaces the failure instead of returning an empty day", async () => {
  // An empty list and a failure look identical to a caller that only sees slots,
  // and "no times today" is the friendlier-looking of the two. That is the trap.
  await assert.rejects(
    () =>
      resolveWorkerDaySlots(fakeAdmin(HEALTHY, new Set(["booking"])), {
        businessId: BUSINESS,
        locationId: LOCATION,
        teamMemberId: WORKER,
        serviceId: SERVICE,
        dateISO: DATE,
        now: new Date("2026-10-01T09:00:00Z")
      }),
    AvailabilityReadError
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · the specific fabrications the old code would have produced
// ─────────────────────────────────────────────────────────────────────────────

ok("losing the opening hours would have offered the whole day — proven, then prevented", async () => {
  // What the old swallow-the-error behaviour amounted to: hours simply absent.
  const asIfSwallowed = { ...HEALTHY, location_hours: [] };
  const built = await input(fakeAdmin(asIfSwallowed));
  const slots = resolveDayAvailability(built!, DATE);
  const outside = slots.filter((s) => {
    const hour = new Date(s.startAtIso).getUTCHours();
    return hour < 7 || hour >= 15;
  });
  assert.ok(
    outside.length > 0,
    "expected the unbounded day to leak slots outside business hours — otherwise this test proves nothing"
  );
  // And with the read failing rather than returning empty, that never happens.
  await assert.rejects(
    () => input(fakeAdmin(HEALTHY, new Set(["location_hours"]))),
    AvailabilityReadError
  );
});

ok("losing the booking settings would have shortened a day's notice to an hour", async () => {
  const asIfSwallowed = { ...HEALTHY, booking_settings: [] };
  const built = await input(fakeAdmin(asIfSwallowed));
  assert.equal(built!.leadTimeMin, 60, "the built-in default is one hour");
  assert.equal(HEALTHY.booking_settings[0].lead_time_min, 1440, "the business asked for a day");
  await assert.rejects(
    () => input(fakeAdmin(HEALTHY, new Set(["booking_settings"]))),
    AvailabilityReadError
  );
});

ok("losing the diary would have offered a time that is already taken", async () => {
  const booked = {
    ...HEALTHY,
    booking: [
      { start_at: "2026-10-14T09:00:00+00:00", end_at: "2026-10-14T09:30:00+00:00", status: "confirmed" }
    ]
  };
  const withDiary = await input(fakeAdmin(booked));
  const realSlots = resolveDayAvailability(withDiary!, DATE).map((s) => s.startAtIso);
  assert.ok(!realSlots.includes("2026-10-14T09:00:00.000Z"), "the booked slot must not be offered");

  const asIfSwallowed = await input(fakeAdmin({ ...booked, booking: [] }));
  const fabricated = resolveDayAvailability(asIfSwallowed!, DATE).map((s) => s.startAtIso);
  assert.ok(
    fabricated.includes("2026-10-14T09:00:00.000Z"),
    "an empty diary must offer the booked slot — otherwise this test proves nothing"
  );

  await assert.rejects(() => input(fakeAdmin(booked, new Set(["booking"]))), AvailabilityReadError);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · empty is still data — a failure test that forbids over-correction
// ─────────────────────────────────────────────────────────────────────────────

ok("a business with no booking settings still gets the defaults, not an error", async () => {
  const built = await input(fakeAdmin({ ...HEALTHY, booking_settings: [] }));
  assert.notEqual(built, null);
  assert.equal(built!.slotIntervalMin, 15);
  assert.equal(built!.maxDaysAhead, 30);
});

ok("a business with no special hours, breaks or time off is unaffected", async () => {
  const built = await input(
    fakeAdmin({ ...HEALTHY, location_special_hours: [], team_member_break: [], team_member_time_off: [] })
  );
  assert.notEqual(built, null);
  assert.deepEqual(built!.locationSpecialHours, []);
  assert.deepEqual(built!.breaks, []);
  assert.deepEqual(built!.timeOff, []);
});

ok("an empty diary is still an empty diary", async () => {
  const built = await input(fakeAdmin(HEALTHY));
  assert.deepEqual(built!.occupancy, []);
  assert.ok(resolveDayAvailability(built!, DATE).length > 0);
});

ok("a service that genuinely does not exist still resolves to no availability", async () => {
  const built = await input(fakeAdmin({ ...HEALTHY, service: [] }));
  assert.equal(built, null, "a missing service is data, and it means no availability");
});

ok("a worker who is genuinely not eligible still resolves to no availability", async () => {
  const built = await input(
    fakeAdmin({ ...HEALTHY, team_member_service: [{ duration_min_override: null, is_active: false }] })
  );
  assert.equal(built, null);
});

void queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
});
