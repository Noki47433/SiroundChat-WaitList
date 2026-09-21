/**
 * Stage 3F.2 · Phase G — is the new edit pipeline the one production is serving?
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f2-smoke.ts
 *
 * One edit through the owner's route that the Phase D baseline already
 * satisfies: Solo Studio's gallery is a mosaic. The new build must answer with
 * changed:false, noOp:true, bounded diagnostics, and write nothing. The old build
 * would have written a version and said so — which is exactly what this checks
 * is no longer possible. Draft-only either way.
 */
import { COHORT, admin, sessionFor } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const db = admin();
const main = async () => {
  const entry = COHORT.find((c) => c.n === 2)!;
  const cookie = await sessionFor(entry);
  const count = async () =>
    (await db.from("builder_site_versions").select("id", { count: "exact", head: true }).eq("site_id", entry.siteId)).count ?? 0;
  const { data: site } = await db.from("builder_sites").select("draft_version_id").eq("id", entry.siteId).single();
  const before = await count();
  const response = await fetch(`${BASE}/api/site-spec/edit`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ siteId: entry.siteId, baseVersionId: site!.draft_version_id, requestId: `s3f2-smoke-${Date.now()}`, message: "Make the gallery a mosaic" })
  });
  const body: any = await response.json();
  const after = await count();
  const { data: siteAfter } = await db.from("builder_sites").select("draft_version_id").eq("id", entry.siteId).single();
  console.log(`  HTTP ${response.status} · changed=${body.changed} · versions ${before} → ${after} · draft pointer ${siteAfter!.draft_version_id === site!.draft_version_id ? "unchanged" : "MOVED"}`);
  console.log(`  reply: ${body.reply}`);
  console.log(`  diagnostics keys: ${Object.keys(body.diagnostics ?? {}).sort().join(", ") || "(none — OLD BUILD)"}`);
  console.log(`  diagnostics: model=${body.diagnostics?.model} tokens=${body.diagnostics?.promptTokens}+${body.diagnostics?.completionTokens} noOp=${body.diagnostics?.noOp} totalMs=${body.diagnostics?.totalMs}`);
  const ok = response.status === 200 && body.changed === false && body.diagnostics?.noOp === true && after === before;
  console.log(ok ? "  SMOKE PASS — the Stage 3F.2 pipeline is live" : "  SMOKE FAIL");
  if (!ok) process.exit(1);
};
void main();
