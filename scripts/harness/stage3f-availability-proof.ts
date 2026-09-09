/**
 * Stage 3F — prove a business's availability against the canonical engine,
 * BEFORE its website is ever served.
 *   npx tsx scripts/harness/stage3f-availability-proof.ts <2|3|4|5>
 *
 * The order matters. If a website is enabled first and the times look wrong, you
 * cannot tell whether the renderer, the route or the business data is at fault.
 * Proving the engine first means anything the website gets wrong afterwards is
 * the website's fault, which is the only way the widening evidence means anything.
 *
 * Five things per business, the last one specific to what that business exists to
 * stress:
 *
 *   1. eligible workers      the canonical list, per service
 *   2. an open day           real slots, all inside the bookable window
 *   3. a closed day          no slots, and no error either
 *   4. the closing rule      nothing is offered that would run past close
 *   5. the stress case       eligibility, or a schedule override, or a closure
 */
import { listEligibleWorkers, resolveWorkerDaySlots } from "@/lib/booking/availability-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const admin = getSupabaseAdminClient() as any;

let passed = 0;
let failed = 0;
const ok = async (name: string, fn: () => Promise<string>) => {
  try {
    console.log(`  PASS ${name}\n         ${await fn()}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL ${name}\n         ${String((error as Error)?.message ?? error)}`);
    failed += 1;
  }
};

const N = Number(process.argv[2]);
const bid = `3f00000${N}-0000-4000-8000-000000000001`;

/** Local date `offset` days out, in the location's timezone. */
const dayISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

const hhmm = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false }).format(
    new Date(iso)
  );

const main = async () => {
  const { data: business } = await admin.from("businesses").select("business_name").eq("id", bid).single();
  const { data: location } = await admin
    .from("location")
    .select("id, timezone")
    .eq("business_id", bid)
    .eq("is_active", true)
    .single();
  const { data: services } = await admin
    .from("service")
    .select("id, name, base_duration_min")
    .eq("business_id", bid)
    .order("display_order");
  const { data: hours } = await admin
    .from("location_hours")
    .select("weekday, open_time, close_time")
    .eq("location_id", location.id);
  const openWeekdays = new Set((hours ?? []).map((h: any) => h.weekday));
  const tz = location.timezone as string;

  console.log(`\n══ business #${N} · ${business.business_name} ══`);
  console.log(`   open weekdays: ${[...openWeekdays].sort().join(",")} · timezone ${tz}`);

  const firstOpen = (from = 2) => {
    for (let i = from; i <= 30; i += 1) if (openWeekdays.has(weekdayOf(dayISO(i)))) return dayISO(i);
    throw new Error("no open day within 30 days");
  };
  const firstClosed = () => {
    for (let i = 2; i <= 30; i += 1) if (!openWeekdays.has(weekdayOf(dayISO(i)))) return dayISO(i);
    return null;
  };

  // ── 1 · eligible workers, per service ─────────────────────────────────────
  const eligibility = new Map<string, Array<{ id: string; displayName: string }>>();
  await ok("the canonical engine names eligible workers per service", async () => {
    const lines: string[] = [];
    for (const service of services) {
      const workers = await listEligibleWorkers(admin, bid, location.id, service.id);
      eligibility.set(service.id, workers);
      if (workers.length === 0) throw new Error(`"${service.name}" has no eligible worker`);
      lines.push(`${service.name} → ${workers.map((w) => w.displayName).join(", ")}`);
    }
    return lines.join(" · ");
  });

  // ── 2 · an open day produces real slots, inside the window ────────────────
  const open = firstOpen();
  await ok(`an open day (${open}) produces slots inside the bookable window`, async () => {
    const service = services[0];
    const worker = eligibility.get(service.id)![0];
    const slots = await resolveWorkerDaySlots(admin, {
      businessId: bid,
      locationId: location.id,
      teamMemberId: worker.id,
      serviceId: service.id,
      dateISO: open,
      now: new Date()
    });
    if (slots.length === 0) throw new Error(`no slots on an open day for ${worker.displayName}`);
    return `${slots.length} slots, ${hhmm(slots[0].startAtIso, tz)}–${hhmm(slots[slots.length - 1].startAtIso, tz)} local`;
  });

  // ── 3 · a closed day produces nothing, and does not error ─────────────────
  const closed = firstClosed();
  await ok("a closed weekday offers nothing", async () => {
    if (!closed) return "SKIPPED — this business is open every weekday";
    const service = services[0];
    const worker = eligibility.get(service.id)![0];
    const slots = await resolveWorkerDaySlots(admin, {
      businessId: bid,
      locationId: location.id,
      teamMemberId: worker.id,
      serviceId: service.id,
      dateISO: closed,
      now: new Date()
    });
    if (slots.length > 0) throw new Error(`${slots.length} slots offered on a closed day (${closed})`);
    return `${closed} (weekday ${weekdayOf(closed)}) → no slots, no error`;
  });

  // ── 4 · nothing is offered that would run past closing ────────────────────
  await ok("no slot would run past closing time", async () => {
    const details: string[] = [];
    for (const service of services) {
      const worker = eligibility.get(service.id)![0];
      const slots = await resolveWorkerDaySlots(admin, {
        businessId: bid,
        locationId: location.id,
        teamMemberId: worker.id,
        serviceId: service.id,
        dateISO: open,
        now: new Date()
      });
      if (slots.length === 0) continue;
      const closeAt = (hours ?? []).find((h: any) => h.weekday === weekdayOf(open))?.close_time as string;
      const last = slots[slots.length - 1];
      const endsAt = hhmm(last.endAtIso, tz);
      if (endsAt > closeAt.slice(0, 5)) {
        throw new Error(`"${service.name}" last slot ends ${endsAt}, after close ${closeAt.slice(0, 5)}`);
      }
      details.push(`${service.name} (${service.base_duration_min}m) last ends ${endsAt} ≤ close ${closeAt.slice(0, 5)}`);
    }
    return details.join(" · ");
  });

  // ── 5 · the stress case this business exists for ──────────────────────────
  if (N === 3) {
    await ok("worker-specific eligibility narrows the longer service to one worker", async () => {
      const cut = services.find((s: any) => s.name === "Cut");
      const both = services.find((s: any) => s.name === "Cut and beard");
      const cutWorkers = eligibility.get(cut.id)!.map((w) => w.displayName).sort();
      const bothWorkers = eligibility.get(both.id)!.map((w) => w.displayName).sort();
      if (cutWorkers.length !== 2) throw new Error(`expected both workers to cut, got ${cutWorkers.join(",")}`);
      if (bothWorkers.length !== 1 || bothWorkers[0] !== "Blerim") {
        throw new Error(`expected only Blerim for the longer service, got ${bothWorkers.join(",")}`);
      }
      return `Cut → ${cutWorkers.join(", ")} · Cut and beard → ${bothWorkers.join(", ")}`;
    });
  }

  if (N === 4) {
    await ok("a worker's own schedule beats the shop's wider hours", async () => {
      const service = services[0];
      const worker = eligibility.get(service.id)![0];
      const slots = await resolveWorkerDaySlots(admin, {
        businessId: bid,
        locationId: location.id,
        teamMemberId: worker.id,
        serviceId: service.id,
        dateISO: open,
        now: new Date()
      });
      if (slots.length === 0) throw new Error("no slots to judge");
      const first = hhmm(slots[0].startAtIso, tz);
      // The shop opens 08:00; Fatmire starts at 12:00. Nothing before 12:00.
      if (first < "12:00") throw new Error(`offered ${first}, before the worker's own start of 12:00`);
      return `shop opens 08:00, worker starts 12:00 — first offer ${first}`;
    });

    await ok("a day the worker does not work offers nothing", async () => {
      // Thursday (4): the shop is open, the worker has no schedule row.
      let thursday: string | null = null;
      for (let i = 2; i <= 30; i += 1) if (weekdayOf(dayISO(i)) === 4) { thursday = dayISO(i); break; }
      const service = services[0];
      const worker = eligibility.get(service.id)![0];
      const slots = await resolveWorkerDaySlots(admin, {
        businessId: bid,
        locationId: location.id,
        teamMemberId: worker.id,
        serviceId: service.id,
        dateISO: thursday!,
        now: new Date()
      });
      if (slots.length > 0) throw new Error(`${slots.length} slots on the worker's day off (${thursday})`);
      return `${thursday} — shop open, worker off, nothing offered`;
    });

    await ok("a dated closure removes the whole day", async () => {
      const { data: closure } = await admin
        .from("location_special_hours")
        .select("date_start")
        .eq("location_id", location.id)
        .eq("is_closed", true)
        .limit(1)
        .maybeSingle();
      if (!closure) throw new Error("no closure configured");
      const service = services[0];
      const worker = eligibility.get(service.id)![0];
      const slots = await resolveWorkerDaySlots(admin, {
        businessId: bid,
        locationId: location.id,
        teamMemberId: worker.id,
        serviceId: service.id,
        dateISO: closure.date_start,
        now: new Date()
      });
      if (slots.length > 0) throw new Error(`${slots.length} slots offered on a closed date`);
      return `${closure.date_start} closed → nothing offered`;
    });

    await ok("a break is carved out of the middle of the day", async () => {
      // Wednesday (3): Fatmire works 12:00–18:00 with 14:00–15:00 off.
      let wednesday: string | null = null;
      for (let i = 2; i <= 30; i += 1) if (weekdayOf(dayISO(i)) === 3) { wednesday = dayISO(i); break; }
      const service = services[0];
      const worker = eligibility.get(service.id)![0];
      const slots = await resolveWorkerDaySlots(admin, {
        businessId: bid,
        locationId: location.id,
        teamMemberId: worker.id,
        serviceId: service.id,
        dateISO: wednesday!,
        now: new Date()
      });
      const times = slots.map((s) => hhmm(s.startAtIso, tz));
      // A 90-minute treatment starting 13:00–15:00 would run through the break.
      const through = times.filter((t) => t >= "13:00" && t < "15:00");
      if (through.length > 0) throw new Error(`offered ${through.join(",")}, which runs through the break`);
      return `${wednesday} offers ${times.join(", ") || "nothing"} — nothing crosses 14:00–15:00`;
    });
  }

  if (N === 5) {
    await ok("a long service is offered less often than a short one", async () => {
      const short = services.find((s: any) => s.base_duration_min === 60);
      const long = services.find((s: any) => s.base_duration_min === 120);
      const worker = eligibility.get(short.id)![0];
      const forService = async (serviceId: string) =>
        (
          await resolveWorkerDaySlots(admin, {
            businessId: bid,
            locationId: location.id,
            teamMemberId: worker.id,
            serviceId,
            dateISO: open,
            now: new Date()
          })
        ).length;
      const a = await forService(short.id);
      const b = await forService(long.id);
      if (!(a > b)) throw new Error(`60m offered ${a} slots, 120m offered ${b} — expected fewer for the longer`);
      return `60-minute service ${a} slots · 120-minute service ${b} slots`;
    });
  }

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

void main();
