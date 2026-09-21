/**
 * Stage 3F.2 · Phase H (preflight) — a scoped, restore-verifiable backup.
 *   OUT=<dir outside the repo> npx tsx scripts/harness/stage3f2-backup.ts
 *
 * Why scoped. Stage 3F took a full `supabase db dump`, which needs Docker; the
 * Docker daemon is not running on this machine, and starting Docker Desktop on a
 * battery-powered laptop in the middle of a session is not a change this
 * mission should make on its own. So this backs up exactly what the measurement
 * and verification can write — the five cohort businesses' site rows, every
 * version of their sites, their assets, their rollout and booking-migration
 * rows, and their bookings — and nothing it cannot. The report says so.
 *
 * Output goes OUTSIDE the repository: version specs and bookings are business
 * and customer data, and do not belong in audit-output. What goes into the
 * evidence set is the manifest: per table, a row count and a SHA-256 over the
 * canonical rows, so the restore can be checked against it.
 *
 * Read-only against production.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { COHORT, admin } from "./stage3f1-cohort";

const OUT = process.env.OUT;
if (!OUT) throw new Error("set OUT to a directory outside the repository");
const db = admin();

const businessIds = COHORT.map((c) => c.businessId);
const siteIds = COHORT.map((c) => c.siteId);

const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
      : value;

/** Every row, paged, ordered by id so the checksum is stable. */
const all = async (table: string, column: string, ids: string[]) => {
  const rows: any[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from(table).select("*").in(column, ids).order("id").range(from, from + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return rows;
};

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const plan: Array<[string, string, string[]]> = [
    ["businesses", "id", businessIds],
    ["builder_sites", "id", siteIds],
    ["builder_site_versions", "site_id", siteIds],
    ["builder_site_assets", "site_id", siteIds],
    ["business_site_spec_rollout", "business_id", businessIds],
    ["business_booking_migration", "business_id", businessIds],
    ["booking", "business_id", businessIds]
  ];
  const manifest: Record<string, { rows: number; sha256: string }> = {};
  for (const [table, column, ids] of plan) {
    let rows: any[];
    try {
      rows = await all(table, column, ids);
    } catch {
      // Tables keyed by business_id without an `id` column: page without ordering by id.
      const { data, error } = await db.from(table).select("*").in(column, ids);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows = (data ?? []).sort((a: any, b: any) => JSON.stringify(canonical(a)).localeCompare(JSON.stringify(canonical(b))));
    }
    const lines = rows.map((row) => JSON.stringify(canonical(row)));
    writeFileSync(`${OUT}/${table}.jsonl`, lines.join("\n") + (lines.length ? "\n" : ""));
    manifest[table] = {
      rows: rows.length,
      sha256: createHash("sha256").update(lines.join("\n")).digest("hex")
    };
    console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(5)} rows  ${manifest[table].sha256.slice(0, 16)}`);
  }
  const record = { takenAt: new Date().toISOString(), scope: "the five cohort businesses", manifest };
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(record, null, 2));
  writeFileSync(
    "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f2/phase-h-backup-manifest.json",
    JSON.stringify(record, null, 2)
  );
  console.log("  manifest written (data stays outside the repository)");
};

void main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exit(1);
});
