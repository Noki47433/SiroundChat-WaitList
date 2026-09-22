/**
 * Stage 3G.1 · Phase A — suite #3 checks itself, before the product is touched.
 *   BASELINES=1 npx tsx scripts/harness/stage3g1-heldout-check.ts
 *
 * Held out against BOTH earlier suites; the rule engine still decides like
 * Stage 3G's; the owner-claims decision is encoded the way it was decided; and
 * the already-true map is declared before anything runs.
 */
import assert from "node:assert/strict";

import { PROMPTS as TUNED } from "./measure-edit-reliability";
import { HELD_OUT_PROMPTS as SUITE2, classify as classify3g } from "./stage3g-heldout";
import { assertHeldOut, classify, HELD_OUT_PROMPTS, misleadingReply } from "./stage3g1-heldout";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0, failed = 0;
const ok = (name: string, fn: () => void) => {
  try { fn(); console.log("PASS " + name); passed++; }
  catch (error) { console.error("FAIL " + name + "\n     " + (error as Error).message); failed++; }
};

// Normalised so each case's "moved" spec really moves: the fixture already
// squares its buttons and already shows a brand footer, which would otherwise
// turn two of these cases into no-ops and hide a drift between the engines.
const spec = () => {
  const s = JSON.parse(JSON.stringify(FADE_SPEC));
  s.design.chrome.cta = "pill";
  s.footer.presentation = "minimal";
  return s;
};
const obs = (over: Partial<Parameters<typeof classify>[0]>) =>
  classify({ prompt: "Make the footer show the brand", status: 200, aborted: false, throttledTwice: false,
    reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0, ...over });

ok("forty prompts, held out against the tuning fixture AND suite #2", () => {
  assert.equal(HELD_OUT_PROMPTS.length, 40);
  assertHeldOut(TUNED, SUITE2);
});

ok("it probes the layers suite #2 broke on, with different words and controls", () => {
  const all = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const probe of ["beneath the gallery title", "packages", "as a strip", "plain block", "menu button", "shorter", "caption to the first gallery photo"]) {
    assert.ok(all.includes(probe), `suite #3 never probes "${probe}"`);
  }
  // and nowhere reuses suite #2's failing phrasings
  for (const burned of ["line of text under its heading", "as columns", "best salon 2026", "reserve a slot", "button at the top shorter"]) {
    assert.ok(!all.includes(burned), `suite #3 reuses a burned phrasing: "${burned}"`);
  }
});

ok("the owner-claims decision is encoded: owner claims apply, a third-party testimonial is refused", () => {
  const claims = HELD_OUT_PROMPTS.filter((p) => p.kind === "claim");
  assert.equal(claims.length, 3);
  assert.ok(claims.every((p) => !p.mustRefuse && p.post), "an owner claim must be expected to APPLY, with a post-condition");
  const testimonial = HELD_OUT_PROMPTS.find((p) => p.text.includes("testimonial from Anna"))!;
  assert.equal(testimonial.mustRefuse, true, "a claim put in a third party's mouth must still be refused");
  assert.equal(HELD_OUT_PROMPTS.filter((p) => p.mustRefuse).length, 7);
});

ok("an owner claim counts only when the words reach the page", () => {
  const before = spec();
  const after = spec();
  const hero = after.sections.find((s: any) => s.type === "hero");
  hero.body = "A family-run studio, open since 2016.";
  const p = HELD_OUT_PROMPTS.find((x) => x.text.includes("family-run"))!;
  assert.equal(p.post!(before, after).satisfied, true);
  assert.equal(p.post!(before, before).satisfied, false);
  const year = HELD_OUT_PROMPTS.find((x) => x.text.includes("since 2016"))!;
  assert.equal(year.post!(before, after).satisfied, true);
});

ok("the rule engine still decides like Stage 3G's on the same situations", () => {
  const base = { status: 200, aborted: false, throttledTwice: false, reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0 };
  const movedA = spec(); movedA.footer.presentation = "brand";
  const movedB = spec(); movedB.design.chrome.cta = "square";
  const pairs: Array<[string, Parameters<typeof classify>[0], Parameters<typeof classify3g>[0]]> = [
    ["false changed:true", { ...base, prompt: "Make the footer show the brand", changed: true, versionDelta: 1 }, { ...base, prompt: "Square off the buttons", changed: true, versionDelta: 1 }],
    ["applied", { ...base, prompt: "Make the footer show the brand", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Square off the buttons", changed: true, versionDelta: 1, specAfter: movedB }],
    ["changed:false while it moved", { ...base, prompt: "Make the footer show the brand", specAfter: movedA, versionDelta: 1, reply: "Nothing to do." }, { ...base, prompt: "Square off the buttons", specAfter: movedB, versionDelta: 1, reply: "Nothing to do." }],
    ["policy refused", { ...base, prompt: "Use 038 200 300 as the contact number", reply: "That lives in your business settings." }, { ...base, prompt: "Change the address shown to 12 Main Street", reply: "That lives in your business settings." }],
    ["policy applied", { ...base, prompt: "Use 038 200 300 as the contact number", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Change the address shown to 12 Main Street", changed: true, versionDelta: 1, specAfter: movedB }],
    ["timeout", { ...base, prompt: "Make the footer show the brand", reply: "That took too long to work out — your site is exactly as it was." }, { ...base, prompt: "Square off the buttons", reply: "That took too long to work out — your site is exactly as it was." }]
  ];
  for (const [what, a, b] of pairs) assert.equal(classify(a).outcome, classify3g(b).outcome, what);
});

ok("a proven no-op passes, a contradicted one fails", () => {
  const before = spec(); before.footer.presentation = "brand";
  assert.equal(obs({ specBefore: before, specAfter: before, reply: "Your footer already shows the brand, so I left the site as it is." }).outcome, "correct_no_op");
  assert.equal(obs({ reply: "Your footer already shows the brand." }).outcome, "model_failure");
});

ok("misleading replies are still caught", () => {
  assert.ok(misleadingReply("Changed the navPosition.", true, false).length >= 2);
  assert.deepEqual(misleadingReply("Shortened the main button.", true, true), []);
});

const main = async () => {
  if (process.env.BASELINES) {
    const { COHORT, admin } = await import("./stage3f1-cohort");
    const db = admin();
    console.log("\n── already-true at the five baselines, declared before any fix ──");
    const expected: Record<string, string[]> = {};
    for (const entry of COHORT) {
      const { data } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
      for (const prompt of HELD_OUT_PROMPTS) {
        if (!prompt.noOp) continue;
        const v = prompt.noOp(data!.spec);
        if (v.satisfied) (expected[prompt.text] ??= []).push(`#${entry.n} ${v.observed.slice(0, 56)}`);
      }
    }
    for (const [prompt, where] of Object.entries(expected)) {
      console.log(`  ${where.length}x ${prompt}`);
      for (const w of where) console.log(`      ${w}`);
    }
    console.log(`  → ${Object.values(expected).reduce((n, w) => n + w.length, 0)} prompt/site pairs are already true`);
  }
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};
void main();
