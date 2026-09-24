/**
 * Stage 3G.3 · Phase D — the production witness, captured once and made immutable.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3g3-witness.ts
 *
 * The rule the product owner set after Stage 3F.2 — no reconstructed baseline,
 * ever again — carried forward unchanged from Stage 3G and 3G.1.
 *
 * Stage 3F.2's witness was overwritten by my own tooling — a helper imported the
 * witness module for a constant, the module ran `main()` on import, and the
 * pre-measurement record became a post-measurement one. It had to be
 * reconstructed and disclosed. Stage 3G may not repeat that, so this file is
 * written to be impossible to lose by accident:
 *
 *   · it runs ONLY when executed directly — never on import;
 *   · it REFUSES to write if the witness file already exists (write-once);
 *   · the file is made read-only (0444) the moment it is written;
 *   · its SHA-256 is written beside it, also read-only, and committed to git
 *     before the measurement runs;
 *   · the measurement re-reads both and refuses to start unless they agree.
 *
 * Read-only against production.
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { COHORT, admin, pageFingerprint } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const EVIDENCE = "/Users/kyro/Downloads/next/audit-output/phase-3/evidence";
/**
 * Which witness this run uses. A witness is written once and never rewritten, so
 * a second measurement needs a second file rather than a deleted one — the name
 * is given on the command line, and both the writer and the reader use it.
 */
export const WITNESS_PATH = `${EVIDENCE}/site-spec-stage3g3/${process.env.WITNESS_NAME ?? "phase-d-witness"}.json`;
export const WITNESS_HASH_PATH = `${WITNESS_PATH}.sha256`;
const db = admin();

/** Every table this stage could conceivably touch. */
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

/** Read the witness and prove it is the one that was committed. */
export const readSealedWitness = () => {
  const raw = readFileSync(WITNESS_PATH, "utf8");
  const expected = readFileSync(WITNESS_HASH_PATH, "utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(raw).digest("hex");
  if (actual !== expected) {
    throw new Error(`the witness does not match its sealed hash — expected ${expected}, got ${actual}`);
  }
  return { witness: JSON.parse(raw), sha256: actual };
};

const served = async (slug: string) => {
  let last = 0;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${BASE}/s/${slug}`, { cache: "no-store" });
    if (response.status === 200) return await response.text();
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

const main = async () => {
  if (existsSync(WITNESS_PATH)) {
    throw new Error(`${WITNESS_PATH} already exists — a witness is written once. Delete it deliberately if you truly mean to retake it.`);
  }

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
  const strangers = enabled.filter((e) => !COHORT.some((c) => c.businessId === e.businessId));
  if (strangers.length) throw new Error(`unexpected enabled business: ${JSON.stringify(strangers)}`);

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
    const { data: draft } = await db
      .from("builder_site_versions")
      .select("spec, version_number")
      .eq("id", site!.draft_version_id!)
      .single();
    const { count } = await db
      .from("builder_site_versions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", entry.siteId);
    const draftPrint = semanticFingerprint(draft?.spec);
    sites.push({
      n: entry.n,
      slug: entry.slug,
      draftVersionId: site!.draft_version_id,
      draftVersionNumber: draft?.version_number ?? null,
      draftSemanticFingerprint: draftPrint,
      draftIsDeclaredBaseline: draftPrint === semanticFingerprint((await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single()).data?.spec),
      baselineVersionId: entry.baselineVersionId,
      publishedVersionId: site!.published_version_id,
      publishedVersionNumber: published?.version_number ?? null,
      specPublishedAt: site!.spec_published_at,
      versionCount: count ?? 0,
      publishedSemanticFingerprint: semanticFingerprint(published?.spec),
      publicPageFingerprint: pageFingerprint(await served(entry.slug))
    });
    const s = sites[sites.length - 1];
    console.log(`  #${entry.n} ${entry.slug.padEnd(26)} published v${s.publishedVersionNumber} · draft v${s.draftVersionNumber} ${s.draftIsDeclaredBaseline ? "= declared baseline" : "≠ BASELINE"} · ${s.versionCount} versions · page 200`);
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

  const body = JSON.stringify(
    {
      takenAt: new Date().toISOString(),
      deployment: process.env.DEPLOYMENT ?? null,
      commit: process.env.COMMIT ?? null,
      note: "Written once, made read-only, hashed beside this file, and committed before the held-out measurement.",
      enabled,
      sites,
      legacy,
      counts,
      limiter: { mode: limiter.mode, configured: limiter.configured, productionSafe: limiter.productionSafe }
    },
    null,
    2
  );
  writeFileSync(WITNESS_PATH, body, { flag: "wx" });
  const sha = createHash("sha256").update(body).digest("hex");
  writeFileSync(WITNESS_HASH_PATH, `${sha}  ${WITNESS_PATH.split("/").pop()}\n`, { flag: "wx" });
  chmodSync(WITNESS_PATH, 0o444);
  chmodSync(WITNESS_HASH_PATH, 0o444);
  console.log(`  sealed ${WITNESS_PATH}`);
  console.log(`  sha256 ${sha}`);
  if (legacySame !== legacy.length) process.exit(1);
  if (!sites.every((s) => s.draftIsDeclaredBaseline)) {
    console.log("  NOTE: a draft is not at its declared baseline — restore before measuring.");
    process.exit(1);
  }
};

// Directly only. Importing this file must never run it — that is the Stage 3F.2 lesson.
if (process.argv[1]?.includes("stage3g3-witness")) {
  void main().catch((error) => {
    console.error(String((error as Error)?.message ?? error));
    process.exit(1);
  });
}
