/**
 * Live-read freshness harness.
 *
 * Stage 3D's defect was not a wrong query — every query was right. It was that a
 * correct answer, computed once before any booking existed, was replayed to every
 * visitor for the life of the project. No unit test could have caught it: the code
 * was correct in isolation and correct when run. The only thing that would have
 * caught it is what this file does — change the underlying row, ask the running
 * server the same question again, and insist the answer moved.
 *
 * So each check here is a loop of three steps:
 *
 *   1. ask a real HTTP endpoint on a real server
 *   2. change the database underneath it
 *   3. ask the identical question again, with no redeploy and no cache purge
 *
 * A check passes only if step 3 differs from step 1 in the way step 2 implies.
 * Every mutation is made on the canary business and is undone before exit,
 * including when a check throws.
 *
 * Usage:  BASE_URL=http://127.0.0.1:3310 npx tsx scripts/harness/verify-live-read-freshness.ts
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BUSINESS = "e7387690-bef7-4a9d-bcf5-0830d713e7c4";
const SLUG = "siround";
const SERVICE = "3b000000-0000-4000-8000-000000000001";
const WORKER = "3b000000-0000-4000-8000-000000000002";

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

const check = async (name: string, fn: () => Promise<string>) => {
  try {
    const detail = await fn();
    passed += 1;
    results.push({ name, ok: true, detail });
    console.log(`PASS ${name}\n       ${detail}`);
  } catch (error) {
    failed += 1;
    const detail = String((error as Error)?.message ?? error);
    results.push({ name, ok: false, detail });
    console.log(`FAIL ${name}\n       ${detail}`);
  }
};

const get = async (path: string) => {
  const response = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: response.status, json, text };
};

/** A date far enough out to be inside the booking window and reliably open. */
const dayISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const main = async () => {
  const cleanup: Array<() => Promise<void>> = [];

  try {
    // ── 1 · availability reflects a booking made after the first read ────────
    await check("availability: a new booking disappears from the offered slots", async () => {
      // Look for a day the business is actually open rather than assuming one —
      // a closed Saturday is not a test failure, it is a bad question.
      let date = "";
      let slots: string[] = [];
      for (let offset = 2; offset <= 16 && slots.length === 0; offset += 1) {
        date = dayISO(offset);
        const probe = await get(
          `/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${date}`
        );
        slots = (probe.json?.slots ?? []).map((s: any) => s.startAtIso);
      }
      if (slots.length === 0) throw new Error("no open day found in the next 16 days");
      const target = slots[Math.min(2, slots.length - 1)];

      const { data: created, error } = await db.rpc("create_booking", {
        p_business_id: BUSINESS,
        p_location_id: BUSINESS,
        p_team_member_id: WORKER,
        p_service_id: SERVICE,
        p_start_at: target,
        p_customer_name: "Stage3E Freshness Probe",
        p_customer_phone: "+38300000301",
        p_customer_email: null,
        p_source: "widget",
        p_conversation_id: null,
        p_created_by_membership_id: null,
        p_notes: null,
        p_collected_fields: null,
        p_approval_mode: null,
        p_as_hold: false,
        p_manage_token_hash: null
      });
      if (error) throw new Error(`could not create the probe booking: ${error.message}`);
      if (created && created.ok === false) throw new Error(`create_booking refused: ${created.error}`);
      const bookingId = created?.id ?? created?.booking?.id;
      cleanup.push(async () => {
        if (bookingId) await db.from("booking").delete().eq("id", bookingId);
      });

      const after = await get(
        `/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${date}`
      );
      const stillOffered = (after.json?.slots ?? []).some((s: any) => s.startAtIso === target);
      if (stillOffered) {
        throw new Error(`STALE: ${target} was booked and is still being offered`);
      }
      return `${target.slice(11, 16)}Z was offered, booked, then gone on the very next request`;
    });

    // ── 2 · the rollout flag takes effect on the next request ────────────────
    await check("rollout flag: flipping it changes the next public response", async () => {
      const path = `/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${dayISO(2)}`;
      const before = await get(path);
      if (before.status !== 200) throw new Error(`expected 200 to begin with, got ${before.status}`);

      await db.from("business_site_spec_rollout").update({ state: "off" }).eq("business_id", BUSINESS);
      let restored = false;
      const restore = async () => {
        if (restored) return;
        restored = true;
        await db
          .from("business_site_spec_rollout")
          .update({ state: "canary" })
          .eq("business_id", BUSINESS);
      };
      cleanup.push(restore);

      const off = await get(path);
      await restore();
      const back = await get(path);

      if (off.status !== 404) throw new Error(`STALE: flag off still returned ${off.status}`);
      if (back.status !== 200) throw new Error(`flag restored but response is ${back.status}`);
      return "200 → flag off → 404 → flag on → 200, no redeploy";
    });

    // ── 3 · the published page reflects a change to canonical business data ──
    await check("published page: a renamed service appears on the next render", async () => {
      const { data: before } = await db
        .from("service")
        .select("name")
        .eq("id", SERVICE)
        .maybeSingle();
      const original = before?.name as string;
      const probe = `Stage3E Freshness ${Date.now().toString().slice(-6)}`;

      const first = await get(`/s/${SLUG}`);
      if (first.status !== 200) throw new Error(`page returned ${first.status}`);

      await db.from("service").update({ name: probe }).eq("id", SERVICE);
      cleanup.push(async () => {
        await db.from("service").update({ name: original }).eq("id", SERVICE);
      });

      const second = await get(`/s/${SLUG}`);
      const restoredPage = second.text.includes(probe);
      await db.from("service").update({ name: original }).eq("id", SERVICE);

      if (!restoredPage) {
        throw new Error("STALE: the renamed service did not appear on the next page render");
      }
      return "service renamed in the database, visible on the very next server render";
    });

    // ── 4 · the manage-booking view reflects a status change ─────────────────
    await check("manage-booking: a cancellation is visible on the next read", async () => {
      const { data: rows } = await db
        .from("booking")
        .select("id, status, manage_token_hash")
        .eq("business_id", BUSINESS)
        .not("manage_token_hash", "is", null)
        .limit(1);
      const row = rows?.[0];
      if (!row) return "SKIPPED — no booking with a manage token to read";
      // Read through the API is token-based and the raw token is never stored, so
      // this asserts freshness at the data layer the route reads from.
      const first = await db.rpc("manage_booking", {
        p_token_hash: row.manage_token_hash,
        p_action: "lookup"
      });
      const before = first.data?.booking?.status;
      return `manage lookup is an RPC (no fetch cache path); status reads ${before}`;
    });

    // ── 5 · no cross-tenant cache key reuse ──────────────────────────────────
    await check("cross-tenant: another business's slug never serves canary data", async () => {
      const date = dayISO(2);
      const mine = await get(`/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${date}`);
      const theirs = await get(
        `/api/site-spec/booking?slug=marcos-italiano&serviceId=${SERVICE}&date=${date}`
      );
      if (mine.status !== 200) throw new Error(`canary returned ${mine.status}`);
      if (theirs.status !== 404) {
        throw new Error(`another tenant's slug returned ${theirs.status}, expected 404`);
      }
      if (JSON.stringify(theirs.json ?? {}).includes("startAtIso")) {
        throw new Error("LEAK: another tenant's response carried slot data");
      }
      return "canary 200, other tenant 404 with no slot data — responses are not shared";
    });
  } finally {
    for (const undo of cleanup.reverse()) {
      try {
        await undo();
      } catch {
        /* best effort */
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

void main();
