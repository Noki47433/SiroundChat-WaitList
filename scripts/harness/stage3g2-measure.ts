/**
 * Stage 3G.2 · Phase E — held-out suite #4, on the product with the five
 * mechanisms closed.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3g2-measure.ts
 *
 * The Stage 3F.2 production runner, pointed at the held-out suite. It differs in
 * three ways, all of them refusals:
 *
 *   · there is NO local mode. The held-out suite is run once, against the
 *     deployed product, and is never used to tune anything;
 *   · it refuses to start unless the sealed witness matches its committed
 *     hash — so the measurement cannot run against a lost or re-taken baseline;
 *   · it refuses to start unless the working tree's product code is identical
 *     to the deployed commit, so "the product was not modified during the
 *     measurement" is checked rather than promised.
 *
 * Everything that decides a verdict lives in stage3g-heldout.ts, committed and
 * hashed before the first model call. Per execution it records the pre/post
 * semantic fingerprint, class and evidence, version delta, changed flag,
 * latency, usage, attempts/repair, requestId, whether the reply misleads, and —
 * for any timeout — whether the site moved afterwards.
 *
 * Draft-only. Each business is restored to its declared baseline when its run
 * ends, through the owner's own route.
 */
import { writeFileSync } from "node:fs";

import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { execFileSync } from "node:child_process";

import { PROMPTS as TUNED } from "./measure-edit-reliability";
import { HELD_OUT_PROMPTS as SUITE2 } from "./stage3g-heldout";
import { HELD_OUT_PROMPTS as SUITE3 } from "./stage3g1-heldout";
import {
  assertHeldOut,
  classify,
  HARD_FAILURE_CLASSES,
  HELD_OUT_PROMPTS,
  misleadingReply,
  NOT_AN_ATTEMPT,
  type OutcomeClass
} from "./stage3g2-heldout";
import { readSealedWitness } from "./stage3g2-witness";
import { COHORT, admin, sessionFor, type CohortEntry } from "./stage3f1-cohort";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : null;
const db = admin();

const PACE_MS = 11_000;
/** The commit production is serving; the product must be identical to it. */
const DEPLOYED = process.env.DEPLOYED_COMMIT ?? "f9c2a4de";
const THROTTLE_BACKOFF_MS = 10 * 60_000 + 15_000;
const CLIENT_DEADLINE_MS = 75_000;
/** How long after a timeout to look again for a late write. Longer than the 30s owner SLA. */
const LATE_WRITE_WATCH_MS = 45_000;
const OWNER_SLA_MS = 30_000;

type Snapshot = { versionId: string | null; spec: unknown; versionCount: number };
type Attempt = { status: number; body: any; aborted: boolean; ms: number; transport?: number };

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
      const started = Date.now();
      let transport = 0;
      const post = async (attempt: number): Promise<Attempt> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_DEADLINE_MS);
      try {
        const response = await fetch(`${BASE}/api/site-spec/edit`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ siteId: entry.siteId, baseVersionId, requestId, message }),
          signal: controller.signal
        });
        const body = await response.json().catch(() => ({}));
        return { status: response.status, body, aborted: false, ms: Date.now() - started, transport };
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return { status: 0, body: {}, aborted: true, ms: Date.now() - started };
        // A transport failure is the network, not the product. The first run of
        // this suite died at execution 108 on a `fetch failed`, losing 92
        // executions to a blip. Retried here, twice, with a pause; only a
        // request that cannot be delivered three times over stops the run.
        transport += 1;
        if (attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5_000 * (attempt + 1)));
        return post(attempt + 1);
      } finally {
        clearTimeout(timer);
      }
      };
      return post(0);
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
  /** Stage 3G.2: what the model said would be true, and how much of it was not. */
  expectationsStated: number;
  expectationsFailed: number;
  throttleRetries: number;
  /** Network failures retried by the harness; the product never saw them. */
  transportRetries: number;
  lateMutation: boolean | null;
};

const runBusiness = async (entry: CohortEntry): Promise<{ rows: Execution[]; restored: { ok: boolean; fingerprintMatches: boolean } }> => {
  console.log(`\n════════ #${entry.n} ${entry.label} ════════`);
  const executor = await productionExecutor(entry);
  const rows: Execution[] = [];
  let lastStarted = 0;

  for (const [index, prompt] of HELD_OUT_PROMPTS.entries()) {
    const wait = PACE_MS - (Date.now() - lastStarted);
    if (lastStarted && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStarted = Date.now();

    const before = await executor.snapshot();
    const requestId = `s3g2-${entry.n}-${index}-${Date.now()}`;
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
      expectationsStated: Number(diagnostics?.expectationsStated ?? 0),
      expectationsFailed: Number(diagnostics?.expectationsFailed ?? 0),
      throttleRetries,
      transportRetries: attempt.transport ?? 0,
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
    executionsStatingAnExpectation: rows.filter((r) => r.expectationsStated > 0).length,
    expectationsStated: rows.reduce((sum, r) => sum + r.expectationsStated, 0),
    /** An edit whose stated outcome never came true, even after the repair. */
    refusedForUnmetExpectation: rows.filter((r) => r.expectationsFailed > 0 && !r.changed).length,
    throttleRetries: rows.reduce((s, r) => s + r.throttleRetries, 0),
    transportRetries: rows.reduce((s, r) => s + r.transportRetries, 0),
    usageBlindExecutions: blind.length,
    promptTokens: tokensIn,
    completionTokens: tokensOut,
    meanPromptTokensPerEdit: Math.round(tokensIn / Math.max(1, modelled.length)),
    meanCompletionTokensPerEdit: Math.round(tokensOut / Math.max(1, modelled.length)),
    models: [...new Set(rows.map((r) => r.usage?.model).filter(Boolean))],
    currencyCost: "unavailable — no model price is configured in the codebase; token counts are the measured cost"
  };
};

const SEALED = readSealedWitness();

const main = async () => {
  // Refusal 1: every prompt is held out, and none is duplicated.
  assertHeldOut(TUNED, SUITE2, SUITE3);
  // Refusal 2: the product is exactly what production is serving.
  const drift = execFileSync("git", ["diff", "--stat", DEPLOYED, "--", "app", "lib", "components", "supabase"], {
    cwd: `${__dirname}/../..`,
    encoding: "utf8"
  }).trim();
  if (drift) throw new Error(`the product differs from the deployed commit ${DEPLOYED}:\n${drift}`);
  // Refusal 3: the witness is the sealed one (readSealedWitness threw if not).
  console.log(`  witness sealed at ${SEALED.witness.takenAt} · sha256 ${SEALED.sha256.slice(0, 16)}`);
  console.log(`  product identical to deployed ${DEPLOYED}`);

  const cohort = ONLY ? COHORT.filter((e) => e.n === ONLY) : COHORT;
  console.log(`  ${HELD_OUT_PROMPTS.length} held-out prompts × ${cohort.length} businesses = ${HELD_OUT_PROMPTS.length * cohort.length} executions`);

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
  console.log(`  policy ${total.policyCorrect} · timeouts ${total.timeouts} · over 30s ${total.overSla} · conflicts ${total.conflicts} · throttle retries ${total.throttleRetries} · network retries ${total.transportRetries}`);
  console.log(`  p50 ${(total.p50Ms / 1000).toFixed(1)}s · p95 ${(total.p95Ms / 1000).toFixed(1)}s · worst ${(total.worstMs / 1000).toFixed(1)}s`);
  console.log(`  usage: ${total.promptTokens} prompt + ${total.completionTokens} completion tokens · mean ${total.meanPromptTokensPerEdit}+${total.meanCompletionTokensPerEdit}/edit · blind ${total.usageBlindExecutions} · model ${total.models.join(",")}`);
  console.log(`  repairs attempted ${total.repairAttempted}, succeeded ${total.repaired}`);
  console.log(`  expectations: ${total.expectationsStated} stated across ${total.executionsStatingAnExpectation} executions · ${total.refusedForUnmetExpectation} edits refused for an outcome that never came true`);

  const hard = all.filter((r) => r.hard);
  if (hard.length) {
    console.log("\n  hard failures:");
    for (const r of hard) console.log(`    #${r.business} [${r.outcome}] ${r.prompt}\n        ${r.evidence.slice(0, 160)}\n        reply: ${r.reply.slice(0, 120)}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = process.env.MEASUREMENT_NAME ?? "phase-e-measurement";
  const path = `/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3g2/${name}-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ suite: "held-out", deployment: process.env.DEPLOYMENT ?? null, commit: process.env.COMMIT ?? null, witnessSha256: SEALED.sha256, measuredAt: new Date().toISOString(), cohort: total, perBusiness, executions: all }, null, 2));
  console.log(`\n  written to ${path}`);
};

// Directly only. Importing this module once printed its preflight and began a
// run; a measurement must never start because something imported it.
if (process.argv[1]?.includes("stage3g2-measure"))
  void main().catch((error) => {
    console.error(String((error as Error)?.stack ?? error));
    process.exit(1);
  });
