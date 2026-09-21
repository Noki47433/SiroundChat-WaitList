/**
 * Stage 3F.2 · Phase F (reproduction) — the three Stage 3F.1 residuals, replayed.
 *   npx tsx scripts/harness/stage3f2-residual-replay.ts [runs=3]
 *
 * The brief's rule is "fix only the demonstrated layer", which means the layer
 * has to be demonstrated first. So this recovers the EXACT spec each failing
 * edit started from — versions are append-only, and the Stage 3F.1 evidence
 * recorded a fingerprint of every pre-edit spec — and runs the real pipeline on
 * it: the real model, the real authorizer, the real applier and validator, the
 * real bounded repair. Only the store is fake (tests/support/fake-site-db), so
 * nothing here can write to production.
 *
 * For each attempt it prints which stage the request died at — model mapping,
 * operation shape, applier, validator — and what the repair did.
 *
 * Reads production (service role, read-only). Writes nothing but stdout and one
 * evidence file.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { loadBusiness } from "@/lib/business/load";
import { loadAssetChoices } from "@/lib/site-spec/api/guard";
import { interpretEdit } from "@/lib/site-spec/ai/edit";
import { runEdit } from "@/lib/site-spec/ai/session";
import { applyOps } from "@/lib/site-spec/ops";
import { saveDraftSpec } from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import { COHORT, admin, fingerprint } from "./stage3f1-cohort";

const RUNS = Number(process.argv[2] ?? 3);
/** "before" on the unchanged pipeline, "after" once the Stage 3F.2 changes are in. */
const LABEL = process.argv[3] ?? "before";
const db = admin();
const EVIDENCE = "/Users/kyro/Downloads/next/audit-output/phase-3/evidence";

const CASES = [
  { business: 1, prompt: "Make the site feel a bit warmer in colour" },
  { business: 3, prompt: "Move the booking section higher up the page" },
  { business: 2, prompt: "Make the gallery a mosaic" }
];

/** The 3F.1 run recorded fingerprint(specBefore).slice(0,16); find that version. */
const recoverPreEditSpec = async (siteId: string, prefix: string) => {
  const { data } = await db
    .from("builder_site_versions")
    .select("id, version_number, spec")
    .eq("site_id", siteId)
    .order("version_number", { ascending: true });
  const hit = (data ?? []).find((row) => fingerprint(row.spec).startsWith(prefix));
  if (!hit) throw new Error(`no stored version matches ${prefix}`);
  return hit;
};

const main = async () => {
  const measurement = JSON.parse(
    readFileSync(`${EVIDENCE}/site-spec-stage3f1/phase-e-measurement-2026-09-17T16-42-32-152Z.json`, "utf8")
  );
  const record: any[] = [];

  for (const c of CASES) {
    const entry = COHORT.find((e) => e.n === c.business)!;
    const row = measurement.executions.find((e: any) => e.business === c.business && e.prompt === c.prompt);
    const version = await recoverPreEditSpec(entry.siteId, row.specBefore);
    const business = await loadBusiness(db as any, entry.businessId);
    // Exactly what the edit route gives the model (guard.ts loadAssetChoices).
    const assets = await loadAssetChoices(db, entry.siteId);

    console.log(`\n══════ #${c.business} ${entry.label} · "${c.prompt}"`);
    console.log(`  3F.1 outcome : ${row.outcome} — ${row.reply.slice(0, 90)}`);
    console.log(`  pre-edit spec: v${version.version_number} (${row.specBefore}) recovered from history`);

    for (let run = 1; run <= RUNS; run += 1) {
      const fake = new FakeSiteDb();
      const siteId = "33333333-1111-4111-8111-00000000000" + c.business;
      fake.addSite({ id: siteId, business_id: entry.businessId, slug: `replay-${c.business}` });
      const seeded = await saveDraftSpec(fake as any, siteId, version.spec, { source: "generated" });
      if (!seeded.ok) throw new Error("could not seed the fake store");

      const calls: any[] = [];
      const outcome = await runEdit({
        supabase: fake as any,
        siteId,
        spec: (seeded as any).value.spec,
        business,
        message: c.prompt,
        assets,
        expectedParentVersionId: (seeded as any).value.id,
        interpret: async (input) => {
          const result = await interpretEdit(input);
          const ops = result.ok ? result.ops : [];
          const apply = ops.length ? applyOps(input.spec, ops, { assets }) : null;
          calls.push({
            repair: calls.length > 0,
            ok: result.ok,
            reason: result.ok ? null : result.reason,
            understanding: result.ok ? result.understanding : null,
            notAWebsiteChange: result.ok ? (result as any).notAWebsiteChange ?? null : null,
            ops,
            applied: apply ? (apply.ok ? "ok" : `${apply.reason}: ${JSON.stringify((apply as any).issues ?? (apply as any).message).slice(0, 200)}`) : "(no ops)"
          });
          return result;
        }
      });

      console.log(`  ── run ${run}: changed=${outcome.changed} · stage=${outcome.diagnostics?.stage ?? "-"} · model calls=${calls.length}`);
      for (const call of calls) {
        console.log(`     ${call.repair ? "repair" : "first "}  ${call.ok ? "" : `FAILED ${call.reason}`}${call.understanding ? `understood: ${call.understanding.slice(0, 80)}` : ""}`);
        if (call.notAWebsiteChange) console.log(`             notAWebsiteChange: ${call.notAWebsiteChange.slice(0, 100)}`);
        for (const op of call.ops) console.log(`             op: ${JSON.stringify(op).slice(0, 170)}`);
        console.log(`             → ${call.applied}`);
      }
      console.log(`     reply: ${outcome.reply.slice(0, 140)}${outcome.noOp ? "   [no-op: nothing written]" : ""}`);
      if (outcome.diagnostics) console.log(`     diagnostic: ${outcome.diagnostics.detail.slice(0, 200)}`);
      record.push({ business: c.business, prompt: c.prompt, run, changed: outcome.changed, diagnostics: outcome.diagnostics ?? null, reply: outcome.reply, calls });
    }
  }

  const path = `${EVIDENCE}/site-spec-stage3f2/phase-f-residual-replay-${LABEL}.json`;
  writeFileSync(path, JSON.stringify({ replayedAt: new Date().toISOString(), code: LABEL === "before" ? "098519a4 + ccef2181 (unchanged edit pipeline)" : "Stage 3F.2 edit pipeline (working tree)", record }, null, 2));
  console.log(`\n  written to ${path}`);
};

void main().catch((error) => {
  console.error(String((error as Error)?.stack ?? error));
  process.exit(1);
});
