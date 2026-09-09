/**
 * Stage 3F — provision one internal rollout business.
 *   npx tsx scripts/harness/stage3f-provision.ts <2|3|4|5>
 *
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 *
 * Stage 3F asks for four more businesses to widen onto. Production has none that
 * qualify: two businesses belong to the operator (one is the canary, the other is
 * siroundchat.com itself, which the brief excludes as customer-critical) and the
 * other sixteen belong to third parties or to nobody. The brief's fallback —
 * create clearly labelled internal businesses — was then blocked twice, and both
 * blocks were escalated to the operator and explicitly authorised:
 *
 *   1. inserting a business fires `businesses_default_subscription_trg`, which
 *      writes a `subscriptions` row (local_basic / website / active / 30 days).
 *      No payment, no invoice, no external call — an internal entitlement record,
 *      which is the thing a rollout business needs anyway.
 *
 *   2. `getTenantFromSession` resolves exactly ONE business per user, so every
 *      owner-facing flow — dashboard, generation, editing, publishing — can only
 *      ever reach one business per account. Four businesses therefore require
 *      four accounts. Creating them was authorised explicitly.
 *
 * These are internal test businesses, named so nobody could mistake them for a
 * customer, owned by accounts on a domain nobody receives mail at, carrying only
 * invented data. Every id is deterministic (`3f00000N-…`) so the reversal is
 * exact rather than best-effort: see `stage3f-reverse.sql`.
 *
 * The four exist to stress different things, because five copies of the same
 * business would prove only that the same path works five times:
 *
 *   #2 Solo Studio     one worker, one service, plain Mon–Fri, worker inherits hours
 *   #3 Two Chairs      two workers, two services, worker-specific eligibility
 *   #4 Late & Closed   own schedule narrower than business hours, a break,
 *                      a mid-week day off, and a dated closure
 *   #5 Atelier Nord    different industry, different copy, gallery-led composition
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

type Worker = {
  id: string;
  name: string;
  /** Own schedule; omit to inherit the location's hours. */
  schedule?: Array<{ weekday: number; start: string; end: string }>;
  breaks?: Array<{ weekday: number; start: string; end: string; label: string }>;
  /** Service ids this worker may perform. Omit for "all of them". */
  services?: string[];
};

type Plan = {
  n: number;
  businessId: string;
  siteId: string;
  locationId: string;
  email: string;
  name: string;
  industry: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  /** [weekday, open, close] — weekday 0 = Sunday. */
  hours: Array<[number, string, string]>;
  closures?: Array<{ start: string; end: string; label: string }>;
  services: Array<{ id: string; name: string; description: string; minutes: number; cents: number }>;
  workers: Worker[];
  settings: { slotInterval: number; leadTime: number; maxDaysAhead: number };
  stress: string;
};

const id = (n: number, k: number) => `3f00000${n}-0000-4000-8000-${String(k).padStart(12, "0")}`;

const PLANS: Plan[] = [
  {
    n: 2,
    businessId: id(2, 1),
    locationId: id(2, 2),
    siteId: id(2, 5),
    email: "stage3f-solo@rollout.invalid",
    name: "Stage 3F · Solo Studio",
    industry: "other",
    slug: "stage3f-solo-studio",
    description: "Internal Stage 3F rollout test business. Not a customer.",
    address: "Rr. Test 2, Prishtina",
    phone: "+38344000002",
    hours: [
      [1, "09:00", "17:00"],
      [2, "09:00", "17:00"],
      [3, "09:00", "17:00"],
      [4, "09:00", "17:00"],
      [5, "09:00", "17:00"]
    ],
    services: [
      { id: id(2, 3), name: "Consultation", description: "A single 45-minute session.", minutes: 45, cents: 3500 }
    ],
    // No schedule of her own: she inherits the business hours, which is the
    // simplest configuration the engine supports and the one most businesses
    // will actually have.
    workers: [{ id: id(2, 4), name: "Ardita" }],
    settings: { slotInterval: 30, leadTime: 120, maxDaysAhead: 30 },
    stress: "single worker, single service, worker inherits business hours"
  },
  {
    n: 3,
    businessId: id(3, 1),
    locationId: id(3, 2),
    siteId: id(3, 5),
    email: "stage3f-twochairs@rollout.invalid",
    name: "Stage 3F · Two Chairs",
    industry: "barbershop",
    slug: "stage3f-two-chairs",
    description: "Internal Stage 3F rollout test business. Not a customer.",
    address: "Rr. Test 3, Prishtina",
    phone: "+38344000003",
    hours: [
      [1, "10:00", "18:00"],
      [2, "10:00", "18:00"],
      [3, "10:00", "18:00"],
      [4, "10:00", "18:00"],
      [5, "10:00", "18:00"],
      [6, "10:00", "15:00"]
    ],
    services: [
      { id: id(3, 3), name: "Cut", description: "A 30-minute cut.", minutes: 30, cents: 1200 },
      { id: id(3, 6), name: "Cut and beard", description: "A 60-minute cut with beard work.", minutes: 60, cents: 2000 }
    ],
    // The point of this one: Blerim does both, Driton only cuts. "Anyone" must
    // resolve differently per service, and asking for Driton must never offer
    // the longer service.
    workers: [
      { id: id(3, 4), name: "Blerim" },
      { id: id(3, 7), name: "Driton", services: [id(3, 3)] }
    ],
    settings: { slotInterval: 15, leadTime: 60, maxDaysAhead: 21 },
    stress: "two workers, two services, worker-specific eligibility"
  },
  {
    n: 4,
    businessId: id(4, 1),
    locationId: id(4, 2),
    siteId: id(4, 5),
    email: "stage3f-hours@rollout.invalid",
    name: "Stage 3F · Late & Closed",
    industry: "beauty_salon",
    slug: "stage3f-late-and-closed",
    description: "Internal Stage 3F rollout test business. Not a customer.",
    address: "Rr. Test 4, Prishtina",
    phone: "+38344000004",
    hours: [
      [1, "08:00", "20:00"],
      [2, "08:00", "20:00"],
      [3, "08:00", "20:00"],
      [4, "08:00", "20:00"],
      [5, "08:00", "20:00"],
      [6, "09:00", "14:00"]
    ],
    // A dated closure a fortnight out, so a real day disappears entirely.
    closures: [
      {
        start: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        end: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        label: "Stage 3F closure test"
      }
    ],
    services: [
      { id: id(4, 3), name: "Treatment", description: "A 90-minute treatment.", minutes: 90, cents: 5500 }
    ],
    // Fatmire works 12:00–18:00, not the shop's 08:00–20:00, takes a Wednesday
    // lunch break, and does not work Thursdays at all — a weekday with no
    // schedule row is a day off, not an inheritance.
    workers: [
      {
        id: id(4, 4),
        name: "Fatmire",
        schedule: [
          { weekday: 1, start: "12:00", end: "18:00" },
          { weekday: 2, start: "12:00", end: "18:00" },
          { weekday: 3, start: "12:00", end: "18:00" },
          { weekday: 5, start: "12:00", end: "18:00" },
          { weekday: 6, start: "09:00", end: "14:00" }
        ],
        breaks: [{ weekday: 3, start: "14:00", end: "15:00", label: "Lunch" }]
      }
    ],
    settings: { slotInterval: 30, leadTime: 180, maxDaysAhead: 45 },
    stress: "own schedule narrower than business hours, a break, a day off, a dated closure"
  },
  {
    n: 5,
    businessId: id(5, 1),
    locationId: id(5, 2),
    siteId: id(5, 5),
    email: "stage3f-atelier@rollout.invalid",
    name: "Stage 3F · Atelier Nord",
    industry: "other",
    slug: "stage3f-atelier-nord",
    description: "Internal Stage 3F rollout test business. Not a customer.",
    address: "Rr. Test 5, Prishtina",
    phone: "+38344000005",
    hours: [
      [2, "11:00", "19:00"],
      [3, "11:00", "19:00"],
      [4, "11:00", "19:00"],
      [5, "11:00", "19:00"],
      [6, "11:00", "17:00"]
    ],
    services: [
      { id: id(5, 3), name: "Studio visit", description: "A 60-minute studio visit.", minutes: 60, cents: 4000 },
      { id: id(5, 6), name: "Portfolio review", description: "A 120-minute review.", minutes: 120, cents: 9000 }
    ],
    workers: [{ id: id(5, 4), name: "Lira" }],
    settings: { slotInterval: 60, leadTime: 1440, maxDaysAhead: 60 },
    stress: "content and visual diversity — different industry, copy and composition"
  }
];

const OWNER_TAG = "Stage 3F internal rollout business — created by the widening mission, not a customer.";

const provision = async (plan: Plan) => {
  console.log(`\n══ business #${plan.n} · ${plan.name} ══`);
  console.log(`   stress case: ${plan.stress}`);

  // ── the owner account ──────────────────────────────────────────────────────
  // A real user record, because every owner flow resolves one business per user.
  // No password is ever set: sessions come from admin-issued magic links, the
  // same mechanism the earlier stages used for the canary.
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = existing.data.users.find((u) => u.email === plan.email)?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: plan.email,
      email_confirm: true,
      user_metadata: { stage3f: true, note: OWNER_TAG }
    });
    if (error) throw new Error(`could not create the owner account: ${error.message}`);
    userId = data.user!.id;
    console.log(`   owner account created`);
  } else {
    console.log(`   owner account already existed`);
  }

  const rows: Array<[string, any]> = [];

  rows.push([
    "businesses",
    await admin.from("businesses").upsert(
      {
        id: plan.businessId,
        // owner_id is left NULL deliberately: it carries a UNIQUE constraint and
        // is legacy. Every authorisation path reads owner_user_id.
        owner_user_id: userId,
        business_name: plan.name,
        industry: plan.industry,
        plan: "trial",
        status: "active",
        access_approved: true,
        launch_access: true,
        onboarding_submitted: false,
        onboarding_data: {}
      },
      { onConflict: "id" }
    )
  ]);

  rows.push([
    "location",
    await admin.from("location").upsert(
      {
        id: plan.locationId,
        business_id: plan.businessId,
        name: plan.name,
        timezone: "Europe/Belgrade",
        address: plan.address,
        phone: plan.phone,
        is_primary: true,
        is_active: true
      },
      { onConflict: "id" }
    )
  ]);

  // Re-running must converge, not accumulate: clear the row-per-weekday tables
  // first so a second run produces the same schedule rather than a doubled one.
  await admin.from("location_hours").delete().eq("location_id", plan.locationId);
  await admin.from("location_special_hours").delete().eq("location_id", plan.locationId);
  for (const worker of plan.workers) {
    await admin.from("team_member_schedule").delete().eq("team_member_id", worker.id);
    await admin.from("team_member_break").delete().eq("team_member_id", worker.id);
  }

  rows.push([
    "location_hours",
    await admin.from("location_hours").insert(
      plan.hours.map(([weekday, open_time, close_time]) => ({
        location_id: plan.locationId,
        weekday,
        open_time,
        close_time
      }))
    )
  ]);

  if (plan.closures?.length) {
    rows.push([
      "location_special_hours",
      await admin.from("location_special_hours").insert(
        plan.closures.map((c) => ({
          location_id: plan.locationId,
          date_start: c.start,
          date_end: c.end,
          is_closed: true,
          label: c.label
        }))
      )
    ]);
  }

  rows.push([
    "service",
    await admin.from("service").upsert(
      plan.services.map((s, index) => ({
        id: s.id,
        business_id: plan.businessId,
        location_id: plan.locationId,
        name: s.name,
        description: s.description,
        price_mode: "fixed",
        base_price_cents: s.cents,
        currency: "EUR",
        base_duration_min: s.minutes,
        buffer_before_min: 0,
        buffer_after_min: 0,
        display_order: index + 1,
        is_active: true
      })),
      { onConflict: "id" }
    )
  ]);

  rows.push([
    "team_member",
    await admin.from("team_member").upsert(
      plan.workers.map((w) => ({
        id: w.id,
        business_id: plan.businessId,
        primary_location_id: plan.locationId,
        display_name: w.name,
        is_bookable: true,
        is_active: true
      })),
      { onConflict: "id" }
    )
  ]);

  for (const worker of plan.workers) {
    const eligible = worker.services ?? plan.services.map((s) => s.id);
    rows.push([
      `team_member_service:${worker.name}`,
      await admin.from("team_member_service").upsert(
        eligible.map((serviceId) => ({
          business_id: plan.businessId,
          team_member_id: worker.id,
          service_id: serviceId,
          is_active: true
        })),
        { onConflict: "team_member_id,service_id" }
      )
    ]);
    if (worker.schedule?.length) {
      rows.push([
        `team_member_schedule:${worker.name}`,
        await admin.from("team_member_schedule").insert(
          worker.schedule.map((s) => ({
            team_member_id: worker.id,
            weekday: s.weekday,
            start_time: s.start,
            end_time: s.end
          }))
        )
      ]);
    }
    if (worker.breaks?.length) {
      rows.push([
        `team_member_break:${worker.name}`,
        await admin.from("team_member_break").insert(
          worker.breaks.map((b) => ({
            team_member_id: worker.id,
            weekday: b.weekday,
            start_time: b.start,
            end_time: b.end,
            label: b.label
          }))
        )
      ]);
    }
  }

  // The unique constraint here is a named index rather than a table constraint,
  // which ON CONFLICT cannot target by column list. Delete-then-insert.
  await admin.from("booking_settings").delete().eq("business_id", plan.businessId);
  rows.push([
    "booking_settings",
    await admin.from("booking_settings").insert({
      business_id: plan.businessId,
      location_id: plan.locationId,
      slot_interval_min: plan.settings.slotInterval,
      lead_time_min: plan.settings.leadTime,
      max_days_ahead: plan.settings.maxDaysAhead,
      approval_mode: "auto",
      soft_hold_minutes: 10,
      cancellation_window_min: 120
    })
  ]);

  rows.push([
    "builder_sites",
    await admin.from("builder_sites").upsert(
      {
        id: plan.siteId,
        owner_user_id: userId,
        business_id: plan.businessId,
        status: "draft",
        industry: plan.industry,
        business_name: plan.name,
        description: plan.description,
        // `template_key` predates Site Spec and is constrained to the legacy
        // template ids. The canary uses service_v1; the Site Spec renderer keys
        // off the published version, not this column.
        template_key: "service_v1",
        slug: plan.slug,
        path: `/${plan.slug}`,
        include_reservation: true
      },
      { onConflict: "id" }
    )
  ]);

  for (const [label, result] of rows) {
    if ((result as any)?.error) {
      console.log(`   ✗ ${label}: ${(result as any).error.message}`);
    }
  }

  const { data: gate } = await admin.rpc("neutral_business_gate_satisfied", {
    target_business_id: plan.businessId
  });
  console.log(`   canonical booking gate satisfied: ${gate}`);
  if (!gate) throw new Error("the booking gate is not satisfied — refusing to continue");

  console.log(`   business ${plan.businessId}`);
  console.log(`   site     ${plan.siteId}`);
  console.log(`   owner    ${userId}  (${plan.email})`);
};

const which = Number(process.argv[2]);
const plan = PLANS.find((p) => p.n === which);
if (!plan) {
  console.error("usage: stage3f-provision.ts <2|3|4|5>");
  process.exit(1);
}
void provision(plan).catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
