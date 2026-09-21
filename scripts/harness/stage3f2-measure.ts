/**
 * Stage 3F.2 · Phase H — 36 prompts × 5 businesses, classified by the frozen contract.
 *
 *   MODE=production BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f2-measure.ts
 *   MODE=local npx tsx scripts/harness/stage3f2-measure.ts        (dress rehearsal)
 *
 * Two executors, one classifier. `production` drives the owner's real edit route
 * with a session cookie, exactly as Stage 3F.1 did. `local` runs the same edit
 * pipeline in-process against an in-memory store seeded with the same baseline —
 * the real model, authorizer, applier, validator and guard, and nothing written
 * anywhere. The local mode exists so the product can be rehearsed before it is
 * deployed; only the production run is the measurement.
 *
 * Everything that decides a verdict lives in stage3f2-contract.ts, committed and
 * hashed before the product changed. This file only observes and records:
 * per execution the pre/post semantic fingerprint, the class and its evidence,
 * the version delta, the changed flag, latency, usage, attempts and repair, the
 * requestId, whether the reply misleads, and — for any timeout — whether the
 * site moved afterwards.
 *
 * The prompts are imported, not copied. Pacing is Stage 3F.1's 11 seconds.
 * Nothing is published; each business's draft is restored to its Phase D
 * baseline when its run ends.
 */
import { writeFileSync } from "node:fs";

import { loadBusiness } from "@/lib/business/load";
import { runEdit, editDiagnostics } from "@/lib/site-spec/ai/session";
import { loadAssetChoices } from "@/lib/site-spec/api/guard";
import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { getDraftVersion, saveDraftSpec } from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import { PROMPTS } from "./measure-edit-reliability";
import {
  assertCoverage,
  classify,
  HARD_FAILURE_CLASSES,
  misleadingReply,
  NOT_AN_ATTEMPT,
  type OutcomeClass
} from "./stage3f2-contract";
import { COHORT, admin, sessionFor, type CohortEntry } from "./stage3f1-cohort";

const MODE = (process.env.MODE ?? "local") as "local" | "production";
const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : null;
const db = admin();

const PACE_MS = MODE === "production" ? 11_000 : 0;
const THROTTLE_BACKOFF_MS = 10 * 60_000 + 15_000;
const CLIENT_DEADLINE_MS = 75_000;
/** How long after a timeout to look again for a late write. Longer than the 30s owner SLA. */
const LATE_WRITE_WATCH_MS = 45_000;
const OWNER_SLA_MS = 30_000;

type Snapshot = { versionId: string | null; spec: unknown; versionCount: number };
type Attempt = { status: number; body: any; aborted: boolean; ms: number };

type Executor = {
  snapshot: () => Promise<Snapshot>;
  edit: (message: string, baseVersionId: string | null, requestId: string) => Promise<Attempt>;
  restore: () => Promise<{ ok: boolean; fingerprintMatches: boolean }>;
};

// ── production: the owner's own routes ────────────────────────────────────────

const productionExecutor = async (entry: CohortEntry): Promise<Executor> => {
  const cookie = await sessionFor(entry);
  const snapshot = async (): Promise<Snapshot> => {
    const { data: site } = await db.from("builder_sites").select("draft_version_id").eq("id", entry.siteId).single();
    const versionId = (site?.draft_version_id as string | null) ?? null;
    const { data: version } = versionId
      ? await db.from("builder_site_versions").select("spec").eq("id", versionId).single()
      : { data: null };
    const { count } = await db
      .from("builder_site_versions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", entry.siteId);
    return { versionId, spec: version?.spec ?? null, versionCount: count ?? 0 };
  };
  return {
    snapshot,
    edit: async (message, baseVersionId, requestId) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_DEADLINE_MS);
      const started = Date.now();
      try {
        const response = await fetch(`${BASE}/api/site-spec/edit`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ siteId: entry.siteId, baseVersionId, requestId, message }),
          signal: controller.signal
        });
        const body = await response.json().catch(() => ({}));
        return { status: response.status, body, aborted: false, ms: Date.now() - started };
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return { status: 0, body: {}, aborted: true, ms: Date.now() - started };
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    restore: async () => {
      const response = await fetch(`${BASE}/api/site-spec/undo`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ siteId: entry.siteId, versionId: entry.baselineVersionId })
      });
      const after = await snapshot();
      const { data: baseline } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
      return {
        ok: response.status === 200,
        fingerprintMatches: semanticFingerprint(after.spec) === semanticFingerprint(baseline?.spec)
      };
    }
  };
};

// ── local: the same pipeline, in-process, against an in-memory store ─────────

const localExecutor = async (entry: CohortEntry): Promise<Executor> => {
  const { data: baseline } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
  const business = await loadBusiness(db as any, entry.businessId);
  const assets = await loadAssetChoices(db, entry.siteId);
  const fake = new FakeSiteDb();
  const siteId = entry.siteId;
  fake.addSite({ id: siteId, business_id: entry.businessId, slug: entry.slug });
  const seeded = await saveDraftSpec(fake as any, siteId, baseline!.spec, { source: "restore" });
  if (!seeded.ok) throw new Error(`could not seed ${entry.slug}`);
  const snapshot = async (): Promise<Snapshot> => {
    const draft = await getDraftVersion(fake as any, siteId);
    return {
      versionId: draft.ok ? (draft.value?.id ?? null) : null,
      spec: draft.ok ? (draft.value?.spec ?? null) : null,
      versionCount: fake.versions.length
    };
  };
  return {
    snapshot,
    edit: async (message, baseVersionId) => {
      const started = Date.now();
      const current = await snapshot();
      const outcome = await runEdit({
        supabase: fake as any,
        siteId,
        spec: current.spec as any,
        business,
        message,
        assets,
        expectedParentVersionId: baseVersionId
      });
      const ms = Date.now() - started;
      return {
        status: outcome.conflict ? 409 : 200,
        aborted: false,
        ms,
        body: { changed: outcome.changed, reply: outcome.reply, diagnostics: editDiagnostics(outcome, ms) }
      };
    },
    restore: async () => ({ ok: true, fingerprintMatches: true })
  };
};

// ── one business ──────────────────────────────────────────────────────────────

type Execution = {
  business: number;
  slug: string;
  index: number;
  prompt: string;
  kind: string;
  mustRefuse: boolean;
  requestId: string;
  status: number;
  ms: number;
  overSla: boolean;
  changed: boolean;
  noOp: boolean;
  outcome: OutcomeClass;
  hard: boolean;
  evidence: string;
  reply: string;
  misleading: string[];
  fingerprintBefore: string;
  fingerprintAfter: string;
  versionDelta: number;
  usage: { model: string | null; promptTokens: number; completionTokens: number; attempts: number; modelMs: number } | null;
  repairAttempted: boolean;
  repaired: boolean;
  throttleRetries: number;
  lateMutation: boolean | null;
};

const runBusiness = async (entry: CohortEntry): Promise<{ rows: Execution[]; restored: { ok: boolean; fingerprintMatches: boolean } }> => {
  console.log(`\n════════ #${entry.n} ${entry.label} (${MODE}) ════════`);
  const executor = MODE === "production" ? await productionExecutor(entry) : await localExecutor(entry);
  const rows: Execution[] = [];
  let lastStarted = 0;

  for (const [index, prompt] of PROMPTS.entries()) {
    const wait = PACE_MS - (Date.now() - lastStarted);
    if (lastStarted && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStarted = Date.now();

    const before = await executor.snapshot();
    const requestId = `s3f2-${entry.n}-${index}-${Date.now()}`;
    let attempt = await executor.edit(prompt.text, before.versionId, requestId);
    let reply = String(attempt.body?.reply ?? attempt.body?.error ?? "");
    let throttleRetries = 0;

    if (attempt.status === 429 || /a lot of changes very quickly/i.test(reply)) {
      throttleRetries = 1;
      console.log("    throttled — one retry after a full window (R7)");
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_BACKOFF_MS));
      const again = await executor.snapshot();
      attempt = await executor.edit(prompt.text, again.versionId, `${requestId}-retry`);
      reply = String(attempt.body?.reply ?? attempt.body?.error ?? "");
      lastStarted = Date.now();
    }
    const throttledTwice = throttleRetries > 0 && (attempt.status === 429 || /a lot of changes very quickly/i.test(reply));

    let after = await executor.snapshot();
    const changed = attempt.body?.changed === true;

    // Gate 12: a timeout must not become a write later.
    let lateMutation: boolean | null = null;
    if (attempt.aborted || /took too long/i.test(reply)) {
      await new Promise((resolve) => setTimeout(resolve, LATE_WRITE_WATCH_MS));
      const later = await executor.snapshot();
      lateMutation = later.versionId !== after.versionId || later.versionCount !== after.versionCount;
      after = later;
    }

    const { outcome, evidence } = classify({
      prompt: prompt.text,
      mustRefuse: Boolean(prompt.mustRefuse),
      status: attempt.status,
      aborted: attempt.aborted,
      throttledTwice,
      reply,
      changed,
      specBefore: before.spec,
      specAfter: after.spec,
      versionDelta: after.versionCount - before.versionCount
    });
    const fingerprintBefore = semanticFingerprint(before.spec);
    const fingerprintAfter = semanticFingerprint(after.spec);
    const diagnostics = attempt.body?.diagnostics ?? null;

    const row: Execution = {
      business: entry.n,
      slug: entry.slug,
      index: index + 1,
      prompt: prompt.text,
      kind: prompt.kind,
      mustRefuse: Boolean(prompt.mustRefuse),
      requestId,
      status: attempt.status,
      ms: attempt.ms,
      overSla: attempt.ms > OWNER_SLA_MS,
      changed,
      noOp: Boolean(diagnostics?.noOp),
      outcome,
      hard: HARD_FAILURE_CLASSES.has(outcome),
      evidence,
      reply: reply.slice(0, 200),
      misleading: misleadingReply(reply, changed, fingerprintBefore !== fingerprintAfter),
      fingerprintBefore: fingerprintBefore.slice(0, 16),
      fingerprintAfter: fingerprintAfter.slice(0, 16),
      versionDelta: after.versionCount - before.versionCount,
      usage: diagnostics
        ? {
            model: diagnostics.model ?? null,
            promptTokens: Number(diagnostics.promptTokens ?? 0),
            completionTokens: Number(diagnostics.completionTokens ?? 0),
            attempts: Number(diagnostics.attempts ?? 0),
            modelMs: Number(diagnostics.modelMs ?? 0)
          }
        : null,
      repairAttempted: Boolean(diagnostics?.repairAttempted),
      repaired: Boolean(diagnostics?.repaired),
      throttleRetries,
      lateMutation
    };
    rows.push(row);

    const mark = row.hard ? "✗" : outcome === "applied" ? "✓" : "·";
    console.log(
      `  ${String(index + 1).padStart(2)} ${mark} ${(row.ms / 1000).toFixed(1).padStart(5)}s ${outcome.padEnd(25)} ${prompt.text.slice(0, 44)}`
    );
    if (row.hard) console.log(`        → ${evidence.slice(0, 140)}\n        reply: ${reply.slice(0, 120)}`);
    if (row.misleading.length) console.log(`        MISLEADING: ${row.misleading.join("; ")} — ${reply.slice(0, 100)}`);
    if (row.lateMutation) console.log(`        LATE MUTATION AFTER TIMEOUT`);
  }

  const restored = await executor.restore();
  console.log(`  restored to baseline: ${restored.ok ? "route 200" : "ROUTE FAILED"} · ${restored.fingerprintMatches ? "fingerprint matches" : "FINGERPRINT MISMATCH"}`);
  return { rows, restored };
};

// ── the numbers ───────────────────────────────────────────────────────────────

export const summarise = (rows: Execution[]) => {
  const count = (o: OutcomeClass) => rows.filter((r) => r.outcome === o).length;
  const attempted = rows.filter((r) => !NOT_AN_ATTEMPT.has(r.outcome)).length;
  const hard = rows.filter((r) => r.hard).length;
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((times.length * p) / 100))] ?? 0;
  // Executions that reached the model. A refused policy prompt still costs a call.
  const modelled = rows.filter((r) => r.status === 200 && !r.throttleRetries);
  const blind = modelled.filter((r) => !r.usage || (r.usage.promptTokens === 0 && r.usage.attempts === 0 && r.usage.modelMs === 0));
  const tokensIn = rows.reduce((s, r) => s + (r.usage?.promptTokens ?? 0), 0);
  const tokensOut = rows.reduce((s, r) => s + (r.usage?.completionTokens ?? 0), 0);
  const policy = rows.filter((r) => r.mustRefuse);
  return {
    executions: rows.length,
    applied: count("applied"),
    correctNoOps: count("correct_no_op"),
    correctPolicyRefusals: count("correct_policy_refusal"),
    duplicateRefusals: count("duplicate_section_refusal"),
    conflicts: count("stale_write_conflict"),
    idempotentReplays: count("idempotent_replay"),
    timeouts: count("timeout"),
    modelFailures: count("model_failure"),
    wrongMutations: count("wrong_mutation"),
    attempted,
    hardFailures: hard,
    hardFailureRate: Number(((hard / Math.max(1, attempted)) * 100).toFixed(2)),
    falseChangedTrue: rows.filter((r) => r.changed && r.fingerprintBefore === r.fingerprintAfter).length,
    misleadingReplies: rows.filter((r) => r.misleading.length).length,
    overSla: rows.filter((r) => r.overSla).length,
    lateMutations: rows.filter((r) => r.lateMutation).length,
    policyCorrect: `${policy.filter((r) => r.outcome === "correct_policy_refusal").length}/${policy.length}`,
    noOpWritesZeroVersions: rows.filter((r) => r.noOp && r.versionDelta !== 0).length === 0,
    p50Ms: pct(50),
    p95Ms: pct(95),
    worstMs: times[times.length - 1] ?? 0,
    repairAttempted: rows.filter((r) => r.repairAttempted).length,
    repaired: rows.filter((r) => r.repaired).length,
    throttleRetries: rows.reduce((s, r) => s + r.throttleRetries, 0),
    usageBlindExecutions: blind.length,
    promptTokens: tokensIn,
    completionTokens: tokensOut,
    meanPromptTokensPerEdit: Math.round(tokensIn / Math.max(1, modelled.length)),
    meanCompletionTokensPerEdit: Math.round(tokensOut / Math.max(1, modelled.length)),
    models: [...new Set(rows.map((r) => r.usage?.model).filter(Boolean))],
    currencyCost: "unavailable — no model price is configured in the codebase; token counts are the measured cost"
  };
};

const main = async () => {
  assertCoverage(PROMPTS);
  const cohort = ONLY ? COHORT.filter((e) => e.n === ONLY) : COHORT;
  console.log(`  ${PROMPTS.length} prompts × ${cohort.length} businesses = ${PROMPTS.length * cohort.length} executions · mode ${MODE}`);

  const all: Execution[] = [];
  const perBusiness: Record<string, ReturnType<typeof summarise> & { restored: unknown }> = {};
  for (const entry of cohort) {
    const { rows, restored } = await runBusiness(entry);
    all.push(...rows);
    perBusiness[entry.slug] = { ...summarise(rows), restored };
    const s = perBusiness[entry.slug];
    console.log(
      `  ── ${entry.label}: ${s.hardFailures} hard / ${s.attempted} → ${s.hardFailureRate}% · false changed:true ${s.falseChangedTrue} · misleading ${s.misleadingReplies} · no-ops ${s.correctNoOps}`
    );
  }

  const total = summarise(all);
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`  COHORT  ${total.hardFailures} hard of ${total.attempted} attempted → ${total.hardFailureRate}%   (gate < 5%)`);
  console.log(`  false changed:true ${total.falseChangedTrue} · misleading replies ${total.misleadingReplies} · late mutations ${total.lateMutations}   (gate 0 each)`);
  console.log(`  policy ${total.policyCorrect} · timeouts ${total.timeouts} · over 30s ${total.overSla} · conflicts ${total.conflicts} · throttle retries ${total.throttleRetries}`);
  console.log(`  p50 ${(total.p50Ms / 1000).toFixed(1)}s · p95 ${(total.p95Ms / 1000).toFixed(1)}s · worst ${(total.worstMs / 1000).toFixed(1)}s`);
  console.log(`  usage: ${total.promptTokens} prompt + ${total.completionTokens} completion tokens · mean ${total.meanPromptTokensPerEdit}+${total.meanCompletionTokensPerEdit}/edit · blind ${total.usageBlindExecutions} · model ${total.models.join(",")}`);
  console.log(`  repairs attempted ${total.repairAttempted}, succeeded ${total.repaired}`);

  const hard = all.filter((r) => r.hard);
  if (hard.length) {
    console.log("\n  hard failures:");
    for (const r of hard) console.log(`    #${r.business} [${r.outcome}] ${r.prompt}\n        ${r.evidence.slice(0, 160)}\n        reply: ${r.reply.slice(0, 120)}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = MODE === "production" ? "phase-h-measurement" : "rehearsal-local";
  const path = `/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f2/${name}-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ mode: MODE, measuredAt: new Date().toISOString(), cohort: total, perBusiness, executions: all }, null, 2));
  console.log(`\n  written to ${path}`);
};

void main().catch((error) => {
  console.error(String((error as Error)?.stack ?? error));
  process.exit(1);
});
