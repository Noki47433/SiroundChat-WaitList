/**
 * Stage 3F.2 · Phase H (preflight) — the production witness, taken immediately
 * before the measurement.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f2-witness.ts
 *
 * Everything Phase I will be compared against is recorded here first, so that
 * "nothing moved" is a comparison between two files rather than a claim:
 *
 *   · the enabled set — ids and names, exactly five
 *   · per cohort site: draft and published pointers, publish timestamp, version
 *     count, the semantic fingerprint of the published spec, and the visible
 *     text fingerprint of the public page (on a real 200)
 *   · the 15 legacy sites, compared against the pre-widening witness
 *   · row counts for every table this mission could conceivably touch
 *   · the shared limiter's health
 *
 * Read-only. Writes one evidence file.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { COHORT, admin, pageFingerprint } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const EVIDENCE = "/Users/kyro/Downloads/next/audit-output/phase-3/evidence";
const db = admin();

const served = async (slug: string) => {
  let last = 0;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${BASE}/s/${slug}`, { cache: "no-store" });
    if (response.status === 200) return { status: 200, body: await response.text(), attempts: attempt };
    last = response.status;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`/s/${slug} never returned 200 — last ${last}`);
};

const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const COUNTED_TABLES = [
  "businesses",
  "builder_sites",
  "builder_site_versions",
  "builder_site_assets",
  "business_site_spec_rollout",
  "business_booking_migration",
  "booking",
  "reservations",
  "service",
  "team_member",
  "leads"
] as const;

const main = async () => {
  const { data: rollout } = await db
    .from("business_site_spec_rollout")
    .select("business_id, state, public_mode")
    .neq("state", "off");
  const enabled = [];
  for (const row of rollout ?? []) {
    const { data: b } = await db.from("businesses").select("business_name").eq("id", row.business_id).single();
    enabled.push({ businessId: row.business_id, name: b?.business_name ?? null, state: row.state, publicMode: row.public_mode });
  }
  if (enabled.length !== 5) throw new Error(`${enabled.length} enabled — expected exactly 5`);
  const unexpected = enabled.filter((e) => !COHORT.some((c) => c.businessId === e.businessId));
  if (unexpected.length) throw new Error(`unexpected enabled business: ${JSON.stringify(unexpected)}`);

  const sites = [];
  for (const entry of COHORT) {
    const { data: site } = await db
      .from("builder_sites")
      .select("draft_version_id, published_version_id, spec_published_at")
      .eq("id", entry.siteId)
      .single();
    const { data: published } = await db
      .from("builder_site_versions")
      .select("spec, version_number")
      .eq("id", site!.published_version_id!)
      .single();
    const { count } = await db
      .from("builder_site_versions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", entry.siteId);
    const page = await served(entry.slug);
    sites.push({
      n: entry.n,
      slug: entry.slug,
      draftVersionId: site!.draft_version_id,
      publishedVersionId: site!.published_version_id,
      publishedVersionNumber: published?.version_number ?? null,
      specPublishedAt: site!.spec_published_at,
      versionCount: count ?? 0,
      publishedSemanticFingerprint: semanticFingerprint(published?.spec),
      publicPageFingerprint: pageFingerprint(page.body)
    });
    console.log(`  #${entry.n} ${entry.slug.padEnd(26)} published v${published?.version_number} · ${count} versions · page 200`);
  }

  const legacyBaseline = readFileSync(`${EVIDENCE}/site-spec-stage3f/legacy-baseline.txt`, "utf8")
    .trim()
    .split("\n")
    .map((line) => line.split(" "));
  const legacy = [];
  for (const [slug, status, hash] of legacyBaseline) {
    const response = await fetch(`${BASE}/s/${slug}`, { cache: "no-store" });
    const digest = createHash("md5").update(strip(await response.text())).digest("hex");
    legacy.push({ slug, status: response.status, md5: digest, identicalToPreWideningWitness: String(response.status) === status && digest === hash });
  }
  const legacySame = legacy.filter((l) => l.identicalToPreWideningWitness).length;
  console.log(`  legacy sites identical to the pre-widening witness: ${legacySame}/${legacy.length}`);

  const counts: Record<string, number | string> = {};
  for (const table of COUNTED_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    counts[table] = error ? `unreadable: ${error.code ?? "?"}` : (count ?? 0);
  }
  console.log(`  counts: ${Object.entries(counts).map(([t, c]) => `${t} ${c}`).join(" · ")}`);

  const limiter = await (await fetch(`${BASE}/api/health/rate-limit`, { cache: "no-store" })).json().catch(() => ({}));
  console.log(`  limiter: ${limiter.mode} · configured ${limiter.configured} · productionSafe ${limiter.productionSafe}`);

  const path = `${EVIDENCE}/site-spec-stage3f2/phase-h-witness.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        deployment: process.env.DEPLOYMENT ?? null,
        commit: process.env.COMMIT ?? null,
        enabled,
        sites,
        legacy,
        counts,
        limiter: { mode: limiter.mode, configured: limiter.configured, productionSafe: limiter.productionSafe }
      },
      null,
      2
    )
  );
  console.log(`  written to ${path}`);
  if (legacySame !== legacy.length) process.exit(1);
};

// Only when run directly. Importing COUNTED_TABLES once ran this and overwrote the
// pre-measurement witness with post-measurement state — see the Stage 3F.2 report.
if (process.argv[1]?.includes("stage3f2-witness")) {
  void main().catch((error) => {
    console.error(String((error as Error)?.message ?? error));
    process.exit(1);
  });
}
