/**
 * Stage 3F.1 · Phase E — the same 36 prompts, all five businesses, 180 edits.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f1-measure.ts
 *
 * Stage 3F measured 5.36% against a < 5% gate and five of its six "failures"
 * were the product answering correctly: the owner asked for something the site
 * already was, and it said so. That is not a failure, but Stage 3F had no class
 * for it, and inventing one after seeing the number is the one thing the
 * no-gaming rule forbids. So the class was declared first — in
 * stage3f1-classifier.ts, committed before this file existed — and the rule that
 * makes it honest is that the model's own claim proves nothing. The stored spec,
 * read BEFORE the edit, has to show the state was already there.
 *
 * Everything else about the measurement is deliberately unchanged from Stage 3F:
 * the prompts are IMPORTED from measure-edit-reliability.ts rather than copied,
 * so their text, order and mustRefuse flags are identical by construction, and
 * the pacing is the same 11s that keeps the run inside the owner's rate budget.
 *
 * ── the rules, all of them written before a single edit was sent ─────────────
 *
 * Denominator. An execution counts as an attempt unless it was a guaranteed
 * success the model was never really tested by. Stage 3F excluded correct policy
 * refusals on that reasoning; the same reasoning excludes correct no-ops,
 * duplicate refusals and guard responses. This is the harsher reading — every
 * excluded row is a success — and it is taken deliberately, so nobody has to
 * wonder whether the denominator was chosen to suit the numerator.
 *
 * Applied is not the same as correct. `changed: true` only says a version was
 * written. Where the frozen taxonomy has a predicate for a prompt, that
 * predicate is also checked AFTER the edit: a change that does not leave the
 * site in the requested state is a wrong mutation, not a success. This can only
 * move rows from the success column to the failure column.
 *
 * Throttling. A 429 is the limiter working, but it is not a free pass: the
 * request is retried once after a full window, and a second 429 counts as a hard
 * failure rather than being excluded. The taxonomy has no throttle class and
 * this run does not add one.
 *
 * Nothing here publishes. Every edit lands on the draft, and each business is
 * put back to its Phase D baseline when its run finishes.
 */
import { writeFileSync } from "node:fs";

import {
  CLASS_RULES,
  HARD_FAILURE_CLASSES,
  NO_OP_PREDICATES,
  NO_OP_REPLY_PATTERN,
  proveNoOp,
  type OutcomeClass
} from "./stage3f1-classifier";
import { COHORT, admin, fingerprint, sessionFor, type CohortEntry } from "./stage3f1-cohort";
import { PROMPTS } from "./measure-edit-reliability";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const db = admin();

/** 60 edits per ten minutes is one every ten seconds. Sit just inside it. */
const PACE_MS = 11_000;
/** A 429 gets one retry, after a full limiter window rather than a polite pause. */
const THROTTLE_BACKOFF_MS = 10 * 60_000 + 15_000;
/** Longer than the 30s owner SLA, so a timeout is observed rather than imposed. */
const CLIENT_DEADLINE_MS = 75_000;

/** Excluded from the denominator: the model was not really on trial. */
const NOT_AN_ATTEMPT: ReadonlySet<OutcomeClass> = new Set<OutcomeClass>([
  "correct_policy_refusal",
  "duplicate_section_refusal",
  "stale_write_conflict",
  "idempotent_replay",
  "correct_no_op"
]);

type Execution = {
  business: number;
  slug: string;
  index: number;
  prompt: string;
  kind: string;
  mustRefuse: boolean;
  ms: number;
  status: number;
  changed: boolean;
  outcome: OutcomeClass;
  hard: boolean;
  /** Why the classifier landed where it did — the evidence, not the assertion. */
  evidence: string;
  reply: string;
  repaired: boolean;
  tokens: number;
  throttleRetries: number;
  specBefore: string;
  specAfter: string;
};

const specOfVersion = async (versionId: string | null) => {
  if (!versionId) return null;
  const { data } = await db.from("builder_site_versions").select("spec").eq("id", versionId).single();
  return (data?.spec as any) ?? null;
};

const draftVersionId = async (siteId: string, cookie: string) => {
  const response = await fetch(`${BASE}/api/site-spec/state?siteId=${siteId}`, {
    headers: { cookie },
    cache: "no-store"
  });
  const body: any = await response.json().catch(() => ({}));
  return (body?.state?.draftVersionId as string | undefined) ?? null;
};

const postEdit = async (siteId: string, cookie: string, baseVersionId: string | null, message: string, requestId: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_DEADLINE_MS);
  try {
    const response = await fetch(`${BASE}/api/site-spec/edit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ siteId, baseVersionId, requestId, message }),
      signal: controller.signal
    });
    const body: any = await response.json().catch(() => ({}));
    return { status: response.status, body, aborted: false };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return { status: 0, body: {}, aborted: true };
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const runBusiness = async (entry: CohortEntry): Promise<Execution[]> => {
  console.log(`\n════════ #${entry.n} ${entry.label} ════════`);
  const cookie = await sessionFor(entry);
  const executions: Execution[] = [];
  let lastStarted = 0;

  for (const [index, prompt] of PROMPTS.entries()) {
    const wait = PACE_MS - (Date.now() - lastStarted);
    if (lastStarted && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStarted = Date.now();

    const baseVersionId = await draftVersionId(entry.siteId, cookie);
    const specBefore = await specOfVersion(baseVersionId);

    const started = Date.now();
    let attempt = await postEdit(
      entry.siteId,
      cookie,
      baseVersionId,
      prompt.text,
      `s3f1-${entry.n}-${index}-${Date.now()}`
    );
    let throttleRetries = 0;
    let reply = String(attempt.body?.reply ?? attempt.body?.error ?? "");

    if (attempt.status === 429 || /a lot of changes very quickly/i.test(reply)) {
      throttleRetries = 1;
      console.log(`    throttled — waiting a full window before the one retry`);
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_BACKOFF_MS));
      attempt = await postEdit(
        entry.siteId,
        cookie,
        await draftVersionId(entry.siteId, cookie),
        prompt.text,
        `s3f1-${entry.n}-${index}-retry-${Date.now()}`
      );
      reply = String(attempt.body?.reply ?? attempt.body?.error ?? "");
      lastStarted = Date.now();
    }

    const ms = Date.now() - started;
    const changed = attempt.body?.changed === true;
    const specAfter = await specOfVersion(await draftVersionId(entry.siteId, cookie));

    // ── classification, in the order declared above ──────────────────────────
    let outcome: OutcomeClass;
    let evidence: string;

    if (attempt.aborted) {
      outcome = "timeout";
      evidence = `no response inside ${CLIENT_DEADLINE_MS / 1000}s`;
    } else if (attempt.status === 429 || /a lot of changes very quickly/i.test(reply)) {
      outcome = "model_failure";
      evidence = "throttled twice, a full limiter window apart — counted against the gate, not excluded";
    } else if (attempt.status === 409) {
      outcome = "stale_write_conflict";
      evidence = `HTTP 409 ${String(attempt.body?.error ?? "")}`;
    } else if (/took too long/i.test(reply)) {
      outcome = "timeout";
      evidence = `the edit route reported its own deadline: ${reply.slice(0, 80)}`;
    } else if (/already has a/.test(reply)) {
      outcome = "duplicate_section_refusal";
      evidence = `duplicate guard: ${reply.slice(0, 80)}`;
    } else if (prompt.mustRefuse) {
      const moved = fingerprint(specBefore) !== fingerprint(specAfter);
      outcome = changed || moved ? "wrong_mutation" : "correct_policy_refusal";
      evidence = changed || moved
        ? `a request that must be refused changed the spec (changed=${changed}, specMoved=${moved})`
        : `refused, and the spec did not move`;
    } else if (changed) {
      const predicate = NO_OP_PREDICATES[prompt.text];
      if (predicate) {
        const after = predicate(specAfter);
        outcome = after.satisfied ? "applied" : "wrong_mutation";
        evidence = after.satisfied
          ? `applied, and the post-edit spec satisfies the declared predicate: ${after.observed}`
          : `a version was written but the requested state is not there: ${after.observed}`;
      } else {
        outcome = "applied";
        evidence = "a version was written; no declared predicate for this prompt";
      }
    } else if (NO_OP_REPLY_PATTERN.test(reply)) {
      const proof = proveNoOp(prompt.text, specBefore);
      outcome = proof.allowed ? "correct_no_op" : "model_failure";
      evidence = proof.evidence;
    } else {
      outcome = "model_failure";
      evidence = `no change and no no-op claim: ${reply.slice(0, 90)}`;
    }

    const hard = HARD_FAILURE_CLASSES.has(outcome);
    executions.push({
      business: entry.n,
      slug: entry.slug,
      index: index + 1,
      prompt: prompt.text,
      kind: prompt.kind,
      mustRefuse: Boolean(prompt.mustRefuse),
      ms,
      status: attempt.status,
      changed,
      outcome,
      hard,
      evidence,
      reply: reply.slice(0, 140),
      repaired: Boolean(attempt.body?.diagnostics?.repaired),
      tokens: Number(attempt.body?.usage?.promptTokens ?? 0) + Number(attempt.body?.usage?.completionTokens ?? 0),
      throttleRetries,
      specBefore: fingerprint(specBefore).slice(0, 16),
      specAfter: fingerprint(specAfter).slice(0, 16)
    });

    const mark = hard ? "✗" : outcome === "applied" ? "✓" : "·";
    console.log(
      `  ${String(index + 1).padStart(2)} ${mark} ${(ms / 1000).toFixed(1).padStart(5)}s ${outcome.padEnd(25)} ${prompt.text.slice(0, 46)}`
    );
    if (hard) console.log(`        → ${evidence.slice(0, 120)}`);
  }

  // Put the draft back, so the next run starts where this one did.
  const restore = await fetch(`${BASE}/api/site-spec/undo`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ siteId: entry.siteId, versionId: entry.baselineVersionId })
  });
  const restored = await specOfVersion(await draftVersionId(entry.siteId, cookie));
  console.log(
    `  restored to baseline: HTTP ${restore.status} · ${fingerprint(restored) === entry.baselineFingerprint ? "fingerprint matches" : "FINGERPRINT MISMATCH"}`
  );

  return executions;
};

const summarise = (rows: Execution[]) => {
  const count = (outcome: OutcomeClass) => rows.filter((row) => row.outcome === outcome).length;
  const hard = rows.filter((row) => row.hard).length;
  const attempted = rows.filter((row) => !NOT_AN_ATTEMPT.has(row.outcome)).length;
  const times = rows.map((row) => row.ms).sort((a, b) => a - b);
  const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((times.length * p) / 100))] ?? 0;
  return {
    executions: rows.length,
    applied: count("applied"),
    correctPolicyRefusals: count("correct_policy_refusal"),
    duplicateRefusals: count("duplicate_section_refusal"),
    correctNoOps: count("correct_no_op"),
    conflicts: count("stale_write_conflict"),
    idempotentReplays: count("idempotent_replay"),
    timeouts: count("timeout"),
    modelFailures: count("model_failure"),
    wrongMutations: count("wrong_mutation"),
    throttleRetries: rows.reduce((sum, row) => sum + row.throttleRetries, 0),
    repairs: rows.filter((row) => row.repaired).length,
    attempted,
    hardFailures: hard,
    hardFailureRate: Number(((hard / Math.max(1, attempted)) * 100).toFixed(2)),
    p50Ms: pct(50),
    p95Ms: pct(95),
    worstMs: times[times.length - 1] ?? 0,
    meanTokens: Math.round(rows.reduce((sum, row) => sum + row.tokens, 0) / Math.max(1, rows.length))
  };
};

const main = async () => {
  console.log(`  ${PROMPTS.length} prompts × ${COHORT.length} businesses = ${PROMPTS.length * COHORT.length} executions`);
  console.log(`  classes: ${Object.keys(CLASS_RULES).length}, of which hard: ${[...HARD_FAILURE_CLASSES].join(", ")}`);

  const all: Execution[] = [];
  const perBusiness: Record<string, ReturnType<typeof summarise>> = {};
  for (const entry of COHORT) {
    const rows = await runBusiness(entry);
    all.push(...rows);
    perBusiness[entry.slug] = summarise(rows);
    const s = perBusiness[entry.slug];
    console.log(
      `  ── ${entry.label}: ${s.hardFailures} hard of ${s.attempted} attempted → ${s.hardFailureRate}%  (p50 ${(s.p50Ms / 1000).toFixed(1)}s, p95 ${(s.p95Ms / 1000).toFixed(1)}s)`
    );
  }

  const cohort = summarise(all);
  console.log("\n══════════════════════════════════════════════════════════════");
  for (const entry of COHORT) {
    const s = perBusiness[entry.slug];
    console.log(
      `  #${entry.n} ${entry.label.padEnd(18)} hard ${String(s.hardFailures).padStart(2)} / ${String(s.attempted).padStart(2)} → ${String(s.hardFailureRate).padStart(5)}%   no-ops ${s.correctNoOps}  refusals ${s.correctPolicyRefusals}  applied ${s.applied}`
    );
  }
  console.log(
    `\n  COHORT  ${cohort.hardFailures} hard of ${cohort.attempted} attempted  →  ${cohort.hardFailureRate}%   (gate: < 5%)`
  );
  console.log(`  timeouts ${cohort.timeouts} · conflicts ${cohort.conflicts} · throttle retries ${cohort.throttleRetries} · repairs ${cohort.repairs}`);
  console.log(`  p50 ${(cohort.p50Ms / 1000).toFixed(1)}s · p95 ${(cohort.p95Ms / 1000).toFixed(1)}s · worst ${(cohort.worstMs / 1000).toFixed(1)}s · mean ${cohort.meanTokens} tokens/edit`);

  const hardRows = all.filter((row) => row.hard);
  if (hardRows.length) {
    console.log("\n  hard failures:");
    for (const row of hardRows) {
      console.log(`    #${row.business} [${row.outcome}] ${row.prompt}\n        ${row.evidence.slice(0, 150)}`);
    }
  }
  const noOps = all.filter((row) => row.outcome === "correct_no_op");
  if (noOps.length) {
    console.log("\n  correct no-ops, each proven against the pre-edit spec:");
    for (const row of noOps) console.log(`    #${row.business} ${row.prompt}\n        ${row.evidence}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f1/phase-e-measurement-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ measuredAt: new Date().toISOString(), cohort, perBusiness, executions: all }, null, 2));
  console.log(`\n  written to ${path}`);
};

void main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exit(1);
});
