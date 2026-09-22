/**
 * Stage 3G · Phase E — why the held-out suite failed, at the layer it failed.
 *   npx tsx scripts/harness/stage3g-failure-replay.ts [runs=2]
 *
 * Five clusters accounted for all 18 hard failures, each repeating across
 * businesses. This replays one representative of each against the declared
 * baseline through the real model, authorizer, applier and validator, with an
 * in-memory store, and prints the operations the model actually proposed. No
 * product code is changed, here or by this script — it only reads and reports.
 */
import { writeFileSync } from "node:fs";

import { loadBusiness } from "@/lib/business/load";
import { loadAssetChoices } from "@/lib/site-spec/api/guard";
import { interpretEdit } from "@/lib/site-spec/ai/edit";
import { runEdit } from "@/lib/site-spec/ai/session";
import { applyOps } from "@/lib/site-spec/ops";
import { saveDraftSpec } from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import { COHORT, admin } from "./stage3f1-cohort";

const RUNS = Number(process.argv[2] ?? 2);
const db = admin();

const CASES: Array<{ business: number; prompt: string; cluster: string }> = [
  { business: 1, prompt: "Give the gallery a line of text under its heading", cluster: "A · 5/5 model_failure — no operations proposed" },
  { business: 1, prompt: "Show the opening hours as columns", cluster: "B · 5/5 — layout changed instead of presentation" },
  { business: 1, prompt: "Add a line saying we have won Best Salon 2026", cluster: "C · 4/5 — an invented award was applied" },
  { business: 2, prompt: "Rename the main button to Reserve a slot", cluster: "D · 2/5 — terminology changed instead of the button label" },
  { business: 3, prompt: "Make the button at the top shorter", cluster: "E · 2/5 — the headline was rewritten instead of the button" }
];

const main = async () => {
  const record: any[] = [];
  for (const c of CASES) {
    const entry = COHORT.find((e) => e.n === c.business)!;
    const { data } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
    const business = await loadBusiness(db as any, entry.businessId);
    const assets = await loadAssetChoices(db, entry.siteId);
    console.log(`\n══════ ${c.cluster}\n       #${c.business} ${entry.label} · "${c.prompt}"`);

    for (let run = 1; run <= RUNS; run += 1) {
      const fake = new FakeSiteDb();
      fake.addSite({ id: entry.siteId, business_id: entry.businessId, slug: entry.slug });
      const seeded: any = await saveDraftSpec(fake as any, entry.siteId, data!.spec, { source: "restore" });
      const calls: any[] = [];
      const outcome = await runEdit({
        supabase: fake as any,
        siteId: entry.siteId,
        spec: seeded.value.spec,
        business,
        message: c.prompt,
        assets,
        expectedParentVersionId: seeded.value.id,
        interpret: async (input) => {
          const result = await interpretEdit(input);
          const ops = result.ok ? result.ops : [];
          const applied = ops.length ? applyOps(input.spec, ops, { assets }) : null;
          calls.push({
            repair: calls.length > 0,
            understanding: result.ok ? result.understanding : `FAILED ${result.reason}`,
            notAWebsiteChange: result.ok ? (result as any).notAWebsiteChange ?? null : null,
            alreadyTrue: result.ok ? (result as any).alreadyTrue ?? null : null,
            ops,
            applied: applied ? (applied.ok ? "ok" : `${applied.reason}: ${JSON.stringify((applied as any).issues ?? (applied as any).message).slice(0, 160)}`) : "(no ops)"
          });
          return result;
        }
      });
      console.log(`  run ${run}: changed=${outcome.changed}${outcome.noOp ? " (no-op)" : ""}`);
      for (const call of calls) {
        console.log(`    ${call.repair ? "repair" : "first "} understood: ${String(call.understanding).slice(0, 84)}`);
        if (call.notAWebsiteChange) console.log(`            notAWebsiteChange: ${call.notAWebsiteChange.slice(0, 96)}`);
        if (call.alreadyTrue) console.log(`            alreadyTrue: ${call.alreadyTrue}`);
        for (const op of call.ops) console.log(`            op: ${JSON.stringify(op).slice(0, 150)}`);
        console.log(`            → ${call.applied}`);
      }
      console.log(`    reply: ${outcome.reply.slice(0, 120)}`);
      record.push({ ...c, run, changed: outcome.changed, noOp: Boolean(outcome.noOp), reply: outcome.reply, calls });
    }
  }
  const path = "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3g/phase-e-failure-replay.json";
  writeFileSync(path, JSON.stringify({ replayedAt: new Date().toISOString(), code: "46a9a848 (deployed, unmodified)", record }, null, 2));
  console.log(`\n  written to ${path}`);
};

void main().catch((error) => {
  console.error(String((error as Error)?.stack ?? error));
  process.exit(1);
});
