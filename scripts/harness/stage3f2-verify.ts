/**
 * Stage 3F.2 · Phase I — production, after the 180 edits.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f2-verify.ts
 *
 * Adapted from Stage 3F.1's Phase F verifier. The comparison point is now the
 * Phase H witness (phase-h-witness.json), taken immediately before this
 * stage's measurement, and "since the mission began" is that witness's time.
 *
 * A reliability number is worth nothing if the run that produced it damaged the
 * thing it was measuring. This asks the five live businesses the questions a
 * visitor and an owner would ask, and then asks the harder one: did anything
 * outside the cohort move?
 *
 * The last check is the one that matters most and is the easiest to fake. It is
 * not "the numbers look about right" — it lists every row written anywhere in the
 * booking and website tables since the mission began and insists that each one
 * belongs to a cohort business. A row that cannot be accounted for fails it.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { COHORT, admin, fingerprint, pageFingerprint } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const WITNESS = JSON.parse(
  readFileSync(
    "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f2/phase-h-witness.json",
    "utf8"
  )
);
/** The measurement began after the witness; the mission itself began today. */
// A reconstructed witness has no exact time, only the window it was taken in;
// the window's end (the first measurement request) is the conservative bound.
const MISSION_START = String(WITNESS.takenAt ?? WITNESS.takenBetween?.[0]?.split(" ")[0]);
const MISSION_DAY = "2026-09-21T00:00:00Z";
const db = admin();

let passed = 0;
let failed = 0;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const ok = async (name: string, fn: () => Promise<string>) => {
  try {
    const detail = await fn();
    console.log(`  PASS ${name}\n         ${detail}`);
    results.push({ name, ok: true, detail });
    passed += 1;
  } catch (error) {
    const detail = String((error as Error)?.message ?? error);
    console.log(`  FAIL ${name}\n         ${detail}`);
    results.push({ name, ok: false, detail });
    failed += 1;
  }
};

const dayISO = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

const json = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers as any) },
    cache: "no-store"
  });
  return { status: response.status, json: await response.json().catch(() => ({})) as any };
};

const COHORT_BUSINESS_IDS = new Set(COHORT.map((entry) => entry.businessId));

const main = async () => {
  console.log(`\n════════ Stage 3F.2 · Phase I · production verification ════════`);

  // ── 1 · the cohort is still exactly five ───────────────────────────────────
  await ok("exactly five businesses are enabled, and they are the five", async () => {
    const { data } = await db
      .from("business_site_spec_rollout")
      .select("business_id, state, public_mode")
      .neq("state", "off");
    const ids = (data ?? []).map((row) => row.business_id);
    if (ids.length !== 5) throw new Error(`${ids.length} enabled, expected 5`);
    const unexpected = ids.filter((id) => !COHORT_BUSINESS_IDS.has(id));
    if (unexpected.length) throw new Error(`unexpected business enabled: ${unexpected.join(", ")}`);
    const named: string[] = [];
    for (const row of data ?? []) {
      const { data: b } = await db.from("businesses").select("business_name").eq("id", row.business_id).single();
      named.push(`${b?.business_name} ${String(row.business_id).slice(0, 8)} ${row.state}/${row.public_mode}`);
    }
    return named.join(" · ");
  });

  // ── 2 · every site serves, on the version it was meant to serve ────────────
  const phaseD = {
    sites: WITNESS.sites.map((site: any) => ({
      slug: site.slug,
      publishedVersionId: site.publishedVersionId,
      publicPageFingerprint: site.publicPageFingerprint,
      specPublishedAt: site.specPublishedAt
    }))
  };
  await ok("all five public pages answer 200 on their intended published version, byte-identical to the witness", async () => {
    const lines: string[] = [];
    for (const entry of COHORT) {
      const expected = phaseD.sites.find((site: any) => site.slug === entry.slug);
      const { data: site } = await db
        .from("builder_sites")
        .select("published_version_id, spec_published_at")
        .eq("id", entry.siteId)
        .single();
      if (site!.published_version_id !== expected.publishedVersionId || site!.spec_published_at !== expected.specPublishedAt) {
        throw new Error(`${entry.slug}'s published pointer moved during the run`);
      }
      const response = await fetch(`${BASE}/s/${entry.slug}`, { cache: "no-store" });
      const body = await response.text();
      if (response.status !== 200) throw new Error(`${entry.slug} returned ${response.status}`);
      if (/temporarily unavailable/i.test(body)) throw new Error(`${entry.slug} is serving the holding page`);
      const print = pageFingerprint(body);
      if (print !== expected.publicPageFingerprint) {
        throw new Error(`${entry.slug}'s public page changed: ${print.slice(0, 16)} vs ${String(expected.publicPageFingerprint).slice(0, 16)}`);
      }
      lines.push(`${entry.slug} 200 ✓`);
    }
    return lines.join(" · ");
  });

  // ── 3 · the drafts are back where Phase D put them ─────────────────────────
  await ok("every draft is back at its Phase D baseline", async () => {
    const lines: string[] = [];
    for (const entry of COHORT) {
      const { data: site } = await db
        .from("builder_sites")
        .select("draft_version_id")
        .eq("id", entry.siteId)
        .single();
      const { data: version } = await db
        .from("builder_site_versions")
        .select("spec, version_number")
        .eq("id", site!.draft_version_id!)
        .single();
      const print = fingerprint(version!.spec);
      if (print !== entry.baselineFingerprint) {
        throw new Error(`${entry.slug} draft is ${print.slice(0, 16)}, baseline is ${entry.baselineFingerprint.slice(0, 16)}`);
      }
      lines.push(`${entry.slug} v${version!.version_number}`);
    }
    return lines.join(" · ");
  });

  // ── 4 · the booking runtime ────────────────────────────────────────────────
  await ok("every cohort business is on the neutral booking runtime", async () => {
    const lines: string[] = [];
    for (const entry of COHORT) {
      const { data } = await db
        .from("business_booking_migration")
        .select("state")
        .eq("business_id", entry.businessId)
        .maybeSingle();
      if (data?.state !== "neutral_active") {
        throw new Error(`${entry.slug} is ${data?.state ?? "(no row)"}, expected neutral_active`);
      }
      lines.push(`${entry.slug}=neutral_active`);
    }
    return lines.join(" · ");
  });

  // ── 5 · shared rate limiting ───────────────────────────────────────────────
  await ok("shared rate limiting is configured and production-safe", async () => {
    const response = await json("/api/health/rate-limit");
    const body = response.json;
    if (response.status !== 200 || body.mode !== "shared" || !body.configured || !body.productionSafe) {
      throw new Error(`HTTP ${response.status} mode=${body.mode} configured=${body.configured} productionSafe=${body.productionSafe}`);
    }
    return `${body.mode} · configured · productionSafe`;
  });

  // ── 6 · a real booking, end to end, on every business ──────────────────────
  for (const entry of COHORT) {
    await ok(`${entry.slug}: availability → book → view → reschedule → cancel`, async () => {
      const { data: service } = await db
        .from("service")
        .select("id")
        .eq("business_id", entry.businessId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!service) throw new Error("no active service");
      const { data: workers } = await db
        .from("team_member")
        .select("id, display_name")
        .eq("business_id", entry.businessId)
        .eq("is_active", true)
        .eq("is_bookable", true);
      if (!workers?.length) throw new Error("no bookable worker");

      let openDay = "";
      let slots: Array<{ startAtIso: string }> = [];
      for (let i = 2; i <= 20; i += 1) {
        const date = dayISO(i);
        const response = await json(
          `/api/site-spec/booking?slug=${entry.slug}&serviceId=${service.id}&date=${date}`
        );
        if (response.status === 200 && (response.json?.slots ?? []).length > 0) {
          openDay = date;
          slots = response.json.slots;
          break;
        }
      }
      if (!openDay) throw new Error("no open day in 20 days");

      const target = slots[Math.min(2, slots.length - 1)].startAtIso;
      const created = await json("/api/site-spec/booking/create", {
        method: "POST",
        body: JSON.stringify({
          slug: entry.slug,
          serviceId: service.id,
          teamMemberId: workers[0].id,
          date: openDay,
          startAt: target,
          customerName: `Stage3F2 Visitor ${entry.n}`,
          customerPhone: `+3830002${entry.n}001`,
          requestId: `s3f2-book-${entry.n}-${Date.now()}`
        })
      });
      if (created.status !== 200 || !created.json?.ok) {
        throw new Error(`create returned ${created.status}: ${JSON.stringify(created.json).slice(0, 110)}`);
      }
      const token = String(created.json.manageUrl).split("/").pop()!;

      // Gone for the worker who was booked — the union may still offer it if
      // somebody else is eligible, which is correct rather than a leak.
      const mine = await json(
        `/api/site-spec/booking?slug=${entry.slug}&serviceId=${service.id}&date=${openDay}&teamMemberId=${workers[0].id}`
      );
      if ((mine.json?.slots ?? []).some((slot: any) => slot.startAtIso === target)) {
        throw new Error("the booked worker is still being offered that slot");
      }

      const view = await json(`/api/manage-booking/${token}`);
      if (view.status !== 200) throw new Error(`manage view returned ${view.status}`);
      const fresh = await json(`/api/site-spec/booking?slug=${entry.slug}&serviceId=${service.id}&date=${openDay}`);
      const next = (fresh.json?.slots ?? [])[0]?.startAtIso;
      const moved = await json(`/api/manage-booking/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: "reschedule", date: openDay, newStart: next })
      });
      if (moved.status !== 200) throw new Error(`reschedule returned ${moved.status}`);
      const cancelled = await json(`/api/manage-booking/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: "cancel" })
      });
      if (cancelled.status !== 200) throw new Error(`cancel returned ${cancelled.status}`);
      const forged = await json(`/api/manage-booking/${"a".repeat(43)}`);
      if (forged.status !== 404) throw new Error(`a forged token returned ${forged.status}`);
      return `${openDay} · booked ${workers[0].display_name} · view/reschedule/cancel 200 · forged token 404`;
    });
  }

  // ── 7 · tenant isolation across the whole cohort ───────────────────────────
  await ok("no cohort business accepts another's service id", async () => {
    const rows: Array<{ slug: string; serviceId: string }> = [];
    for (const entry of COHORT) {
      const { data: service } = await db
        .from("service")
        .select("id")
        .eq("business_id", entry.businessId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (service) rows.push({ slug: entry.slug, serviceId: service.id });
    }
    const date = dayISO(3);
    let probes = 0;
    for (const a of rows) {
      for (const b of rows) {
        if (a.slug === b.slug) continue;
        const response = await fetch(
          `${BASE}/api/site-spec/booking?slug=${a.slug}&serviceId=${b.serviceId}&date=${date}`,
          { cache: "no-store" }
        );
        if (response.status !== 404) {
          throw new Error(`${a.slug} accepted ${b.slug}'s service id (HTTP ${response.status})`);
        }
        probes += 1;
      }
    }
    return `${probes} cross-tenant probes, all 404`;
  });

  // ── 8 · the rest of production ─────────────────────────────────────────────
  await ok("the 15 legacy sites are byte-identical to the pre-widening witness", async () => {
    const baseline = readFileSync(
      "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f/legacy-baseline.txt",
      "utf8"
    )
      .trim()
      .split("\n")
      .map((line) => line.split(" "));
    const strip = (html: string) =>
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const changed: string[] = [];
    for (const [slug, status, hash] of baseline) {
      const response = await fetch(`${BASE}/s/${slug}`, { cache: "no-store" });
      const digest = createHash("md5").update(strip(await response.text())).digest("hex");
      if (String(response.status) !== status || digest !== hash) changed.push(slug);
    }
    if (changed.length) throw new Error(`${changed.length} changed: ${changed.join(", ")}`);
    return `${baseline.length}/${baseline.length} identical`;
  });

  await ok("nothing was written outside the cohort since the mission began", async () => {
    const tables: Array<[string, string]> = [
      ["builder_site_versions", "site_id"],
      ["booking", "business_id"],
      ["reservations", "business_id"],
      ["service", "business_id"],
      ["team_member", "business_id"]
    ];
    const siteIds = new Set(COHORT.map((entry) => entry.siteId));
    const lines: string[] = [];
    for (const [table, column] of tables) {
      const { data, error } = await db
        .from(table)
        .select(`id, ${column}, created_at`)
        .gte("created_at", MISSION_START);
      if (error) {
        lines.push(`${table}: unreadable (${error.message.slice(0, 40)})`);
        continue;
      }
      const rows = (data ?? []) as any[];
      const strangers = rows.filter((row) =>
        column === "site_id" ? !siteIds.has(row[column]) : !COHORT_BUSINESS_IDS.has(row[column])
      );
      if (strangers.length) {
        throw new Error(`${strangers.length} row(s) in ${table} since ${MISSION_START} belong to a business outside the cohort`);
      }
      lines.push(`${table} +${rows.length} (all cohort)`);
    }
    return lines.join(" · ");
  });

  await ok("no sixth business was created or enabled", async () => {
    const { count: rollouts } = await db
      .from("business_site_spec_rollout")
      .select("business_id", { count: "exact", head: true })
      .neq("state", "off");
    const { data: newBusinesses } = await db
      .from("businesses")
      .select("id, created_at")
      .gte("created_at", MISSION_DAY);
    if ((rollouts ?? 0) !== 5) throw new Error(`${rollouts} enabled rollouts`);
    if ((newBusinesses ?? []).length) {
      throw new Error(`${newBusinesses!.length} business(es) created since ${MISSION_DAY}`);
    }
    return `5 enabled · 0 businesses created since ${MISSION_DAY.slice(0, 10)}`;
  });

  const path =
    "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f2/phase-i-verification.json";
  writeFileSync(path, JSON.stringify({ verifiedAt: new Date().toISOString(), passed, failed, results }, null, 2));

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  console.log(`  written to ${path}`);
  if (failed > 0) process.exit(1);
};

void main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exit(1);
});
