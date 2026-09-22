/**
 * Stage 3G.1 · Phase C — is the fixed pipeline the one production serves?
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3g1-smoke.ts
 *
 * Two requests, both from the SPENT Stage 3G suite, so held-out suite #3 is not
 * touched: one that failed on 5 of 5 sites before the fix ("Show the opening
 * hours as columns"), and one that must still be a truthful no-op. Draft-only:
 * whatever happens, the draft is put back.
 */
import { COHORT, admin, sessionFor } from "./stage3f1-cohort";
import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const db = admin();

const main = async () => {
  const entry = COHORT.find((c) => c.n === 2)!;
  const cookie = await sessionFor(entry);
  const state = async () => {
    const { data: site } = await db.from("builder_sites").select("draft_version_id").eq("id", entry.siteId).single();
    const { data: version } = await db.from("builder_site_versions").select("spec").eq("id", site!.draft_version_id!).single();
    const { count } = await db.from("builder_site_versions").select("id", { count: "exact", head: true }).eq("site_id", entry.siteId);
    return { id: site!.draft_version_id as string, spec: version?.spec, count: count ?? 0 };
  };
  const edit = async (message: string) => {
    const before = await state();
    const response = await fetch(`${BASE}/api/site-spec/edit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ siteId: entry.siteId, baseVersionId: before.id, requestId: `s3g1-smoke-${Date.now()}`, message })
    });
    const body: any = await response.json();
    const after = await state();
    const hours = (spec: any) => spec?.sections?.find((s: any) => s.type === "hours");
    console.log(`  "${message}"`);
    console.log(`     HTTP ${response.status} · changed=${body.changed} · versions ${before.count} → ${after.count} · hours presentation ${hours(before.spec)?.presentation} → ${hours(after.spec)?.presentation}`);
    console.log(`     reply: ${body.reply}`);
    console.log(`     diagnostics: repairAttempted=${body.diagnostics?.repairAttempted} repaired=${body.diagnostics?.repaired} noOp=${body.diagnostics?.noOp}`);
    return { body, before, after };
  };

  const fixed = await edit("Show the opening hours as columns");
  const noop = await edit("Keep the menu pinned at the top of the page");

  // put it back
  await fetch(`${BASE}/api/site-spec/undo`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ siteId: entry.siteId, versionId: entry.baselineVersionId })
  });
  const restored = await state();
  const { data: baseline } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
  const back = semanticFingerprint(restored.spec) === semanticFingerprint(baseline?.spec);

  const hoursNow = (fixed.after.spec as any)?.sections?.find((s: any) => s.type === "hours")?.presentation;
  const ok = fixed.body.changed === true && hoursNow === "cols" && noop.body.changed === false && noop.body.diagnostics?.noOp === true && back;
  console.log(`  restored to baseline: ${back ? "fingerprint matches" : "MISMATCH"}`);
  console.log(ok ? "  SMOKE PASS — the Stage 3G.1 pipeline is live" : "  SMOKE FAIL");
  if (!ok) process.exit(1);
};

void main();
