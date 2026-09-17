/**
 * Stage 3F.1 · Phase D — put all five drafts back to a controlled baseline.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f1-restore.ts
 *
 * Stage 3F's drafts still carry that run's 27 edits apiece. Re-measuring from
 * there would measure a different site, so the numbers would not be comparable
 * with the ones they are meant to correct.
 *
 * Three things have to be true when this finishes, and each is proven rather
 * than assumed:
 *
 *   the draft IS the baseline      — fingerprint of the restored draft equals the
 *                                    fingerprint of the baseline version, declared
 *                                    in stage3f1-cohort.ts before this ran
 *   the live site did NOT move     — published_version_id identical, and the public
 *                                    page's visible text byte-identical, before and
 *                                    after
 *   it went through the product    — the restore is a POST to the owner's own undo
 *                                    route with the session cookie, not an UPDATE.
 *                                    Anything a service-role write could fix here
 *                                    is something an owner could not.
 */
import { writeFileSync } from "node:fs";

import { COHORT, admin, fingerprint, pageFingerprint, sessionFor } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const db = admin();

let failed = 0;
const check = (name: string, condition: boolean, detail: string) => {
  console.log(`    ${condition ? "PASS" : "FAIL"} ${name}\n           ${detail}`);
  if (!condition) failed += 1;
};

const siteRow = async (siteId: string) => {
  const { data, error } = await db
    .from("builder_sites")
    .select("id, slug, draft_version_id, published_version_id, spec_published_at")
    .eq("id", siteId)
    .single();
  if (error || !data) throw new Error(`site ${siteId}: ${error?.message}`);
  return data;
};

const specOf = async (versionId: string) => {
  const { data, error } = await db
    .from("builder_site_versions")
    .select("spec, version_number")
    .eq("id", versionId)
    .single();
  if (error || !data) throw new Error(`version ${versionId}: ${error?.message}`);
  return data;
};


/**
 * The page as a visitor gets it, insisting on a real 200.
 *
 * The first pass of this harness fingerprinted a 504 and then reported that the
 * canary's public page had changed. It had not: a cold lambda answered the first
 * request after the deploy with a gateway timeout, and an error page hashed
 * differently from a website, as it should. A comparison is only worth making
 * between two pages that were actually served.
 */
const servedPage = async (slug: string) => {
  let last = 0;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${BASE}/s/${slug}`, { cache: "no-store" });
    if (response.status === 200) {
      return { status: 200, print: pageFingerprint(await response.text()), attempts: attempt };
    }
    last = response.status;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`/s/${slug} never returned 200 — last status ${last}`);
};

const main = async () => {
  const record: any[] = [];

  for (const entry of COHORT) {
    console.log(`\n──────── #${entry.n} ${entry.label} (${entry.slug}) ────────`);

    // ── the baseline is the one that was declared ────────────────────────────
    const baseline = await specOf(entry.baselineVersionId);
    const baselinePrint = fingerprint(baseline.spec);
    check(
      "the baseline version is the one declared before the run",
      baselinePrint === entry.baselineFingerprint && baseline.version_number === entry.baselineVersionNumber,
      `v${baseline.version_number} ${baselinePrint.slice(0, 16)} (declared v${entry.baselineVersionNumber} ${entry.baselineFingerprint.slice(0, 16)})`
    );

    // ── what the public sees, before ─────────────────────────────────────────
    const before = await siteRow(entry.siteId);
    const beforeDraft = before.draft_version_id
      ? fingerprint((await specOf(before.draft_version_id)).spec)
      : "(none)";
    const publicBefore = await servedPage(entry.slug);
    const publicPrintBefore = publicBefore.print;
    console.log(
      `    draft ${beforeDraft.slice(0, 16)} · published ${String(before.published_version_id).slice(0, 8)} · page ${publicPrintBefore.slice(0, 16)} (HTTP ${publicBefore.status}${publicBefore.attempts > 1 ? `, ${publicBefore.attempts} attempts` : ""})`
    );

    // ── restore, through the owner's own route ───────────────────────────────
    //
    // Skipped when the draft already IS the baseline, so re-running this to
    // re-verify does not append a stack of identical versions to a history that
    // is meant to be readable. The check below proves the end state either way.
    const alreadyThere = beforeDraft === entry.baselineFingerprint;
    if (alreadyThere) {
      console.log(`    ·    draft is already at the baseline — no version appended`);
    } else {
      const cookie = await sessionFor(entry);
      const response = await fetch(`${BASE}/api/site-spec/undo`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ siteId: entry.siteId, versionId: entry.baselineVersionId })
      });
      const body: any = await response.json().catch(() => ({}));
      check(
        "the owner's own restore route accepted it",
        response.status === 200,
        `HTTP ${response.status} → v${body?.version?.number ?? "?"}`
      );
    }

    // ── the draft IS the baseline ────────────────────────────────────────────
    const after = await siteRow(entry.siteId);
    const restored = await specOf(after.draft_version_id!);
    const restoredPrint = fingerprint(restored.spec);
    check(
      "the restored draft is byte-identical to the baseline",
      restoredPrint === entry.baselineFingerprint,
      `v${restored.version_number} ${restoredPrint.slice(0, 16)} vs baseline ${entry.baselineFingerprint.slice(0, 16)}`
    );

    // ── and the live site did not move ───────────────────────────────────────
    const publicAfter = await servedPage(entry.slug);
    const publicPrintAfter = publicAfter.print;
    check(
      "the published pointer did not move",
      after.published_version_id === before.published_version_id &&
        after.spec_published_at === before.spec_published_at,
      `${String(after.published_version_id).slice(0, 8)} (was ${String(before.published_version_id).slice(0, 8)})`
    );
    check(
      "the public page is byte-identical",
      publicAfter.status === 200 && publicPrintAfter === publicPrintBefore,
      `HTTP ${publicAfter.status} · ${publicPrintAfter.slice(0, 16)} (was ${publicPrintBefore.slice(0, 16)})`
    );

    record.push({
      n: entry.n,
      slug: entry.slug,
      baselineVersionId: entry.baselineVersionId,
      baselineVersionNumber: entry.baselineVersionNumber,
      baselineFingerprint: entry.baselineFingerprint,
      draftBefore: { versionId: before.draft_version_id, fingerprint: beforeDraft },
      draftAfter: {
        versionId: after.draft_version_id,
        versionNumber: restored.version_number,
        fingerprint: restoredPrint
      },
      publishedVersionId: after.published_version_id,
      publishedUnchanged: after.published_version_id === before.published_version_id,
      restorePerformed: !alreadyThere,
      publicPageFingerprint: publicPrintAfter,
      publicPageUnchanged: publicPrintAfter === publicPrintBefore
    });
  }

  const path =
    "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f1/phase-d-restore.json";
  writeFileSync(path, JSON.stringify({ restoredAt: new Date().toISOString(), sites: record }, null, 2));

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  ${failed === 0 ? "all five drafts are at their declared baselines" : `${failed} check(s) FAILED`}`);
  console.log(`  written to ${path}`);
  if (failed > 0) process.exit(1);
};

void main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exit(1);
});
