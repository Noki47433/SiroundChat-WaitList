/**
 * Stage 3G · Phase A — the held-out suite checks itself, before it is frozen.
 *   npx tsx scripts/harness/stage3g-heldout-check.ts            (offline parts)
 *   BASELINES=1 npx tsx scripts/harness/stage3g-heldout-check.ts (also reads the five baselines)
 *
 * Four things:
 *
 *  1. every prompt is genuinely held out — none appears in the fixture the
 *     product was tuned against, and none is duplicated here;
 *  2. the rule engine, which is a deliberate copy of Stage 3F.2's, still decides
 *     the same way that one does on the same structural situations (a copy that
 *     drifts is worse than no copy);
 *  3. each rule does what its comment says, on synthetic specs;
 *  4. with BASELINES=1, the predicates are evaluated against the five real
 *     baselines and the expected already-true map is printed — declared here,
 *     before the run, so no no-op can be argued for afterwards.
 */
import assert from "node:assert/strict";

import { PROMPTS as TUNED } from "./measure-edit-reliability";
import { classify as classify3f2 } from "./stage3f2-contract";
import {
  assertHeldOut,
  classify,
  HELD_OUT_PROMPTS,
  HARD_FAILURE_CLASSES,
  misleadingReply,
  NOT_AN_ATTEMPT
} from "./stage3g-heldout";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    console.log("PASS " + name);
    passed++;
  } catch (error) {
    console.error("FAIL " + name + "\n     " + (error as Error).message);
    failed++;
  }
};

// The synthetic base is normalised so each case's "moved" spec really moves:
// the fixture already squares its buttons, which would have made the
// square-off case a no-op and hidden a drift between the two engines.
const spec = () => {
  const s = JSON.parse(JSON.stringify(FADE_SPEC));
  s.design.chrome.cta = "pill";
  return s;
};
const withGallery = () => {
  const s = spec();
  const at = s.sections.findIndex((x: any) => x.type === "services");
  s.sections.splice(at + 1, 0, {
    id: "gallery", type: "gallery", layout: "wide", presentation: "mosaic",
    heading: { title: "Gallery" }, items: [{ kind: "generated", seed: 1 }], captions: [], framing: {}
  });
  return s;
};

const obs = (over: Partial<Parameters<typeof classify>[0]>) =>
  classify({
    prompt: "Square off the buttons",
    status: 200, aborted: false, throttledTwice: false, reply: "",
    changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0,
    ...over
  });

// 1 · held out
ok("no held-out prompt appears in the fixture the product was tuned against", () => {
  assert.equal(HELD_OUT_PROMPTS.length, 40);
  assert.equal(TUNED.length, 36);
  assertHeldOut(TUNED);
});

ok("the held-out suite reaches state the tuning fixture never touched", () => {
  const joined = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const probe of ["body text", "all-caps", "cinematic", "columns", "crew", "search results", "tracking pixel", "best salon", "five-star review", "off the page"]) {
    assert.ok(joined.includes(probe), `the suite never probes "${probe}"`);
  }
  // …and it still covers the same shapes of request the old one did.
  const kinds = new Set(HELD_OUT_PROMPTS.map((p) => p.kind));
  assert.deepEqual([...kinds].sort(), ["asset", "copy", "design", "layout", "policy", "section", "wording"]);
  assert.equal(HELD_OUT_PROMPTS.filter((p) => p.mustRefuse).length, 8);
});

// 2 · the copied engine still agrees with Stage 3F.2's
ok("the rule engine decides the same way Stage 3F.2's does, on the same situations", () => {
  const cases: Array<{ what: string; held: Parameters<typeof classify>[0]; tuned: Parameters<typeof classify3f2>[0] }> = [];
  const heldBase = { status: 200, aborted: false, throttledTwice: false, reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0 };
  const tunedBase = { ...heldBase, mustRefuse: false };

  const movedHeld = spec(); movedHeld.design.chrome.cta = "square";
  const movedTuned = spec(); movedTuned.design.typography.headingScale = "larger";

  cases.push({ what: "false changed:true",
    held: { ...heldBase, prompt: "Square off the buttons", changed: true, versionDelta: 1 },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", changed: true, versionDelta: 1 } });
  cases.push({ what: "applied and the state arrived",
    held: { ...heldBase, prompt: "Square off the buttons", changed: true, versionDelta: 1, specAfter: movedHeld },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", changed: true, versionDelta: 1, specAfter: movedTuned } });
  cases.push({ what: "changed:false while the site moved",
    held: { ...heldBase, prompt: "Square off the buttons", specAfter: movedHeld, versionDelta: 1, reply: "Nothing to do." },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", specAfter: movedTuned, versionDelta: 1, reply: "Nothing to do." } });
  cases.push({ what: "two versions for one edit",
    held: { ...heldBase, prompt: "Square off the buttons", changed: true, versionDelta: 2, specAfter: movedHeld },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", changed: true, versionDelta: 2, specAfter: movedTuned } });
  cases.push({ what: "a policy prompt that changed nothing",
    held: { ...heldBase, prompt: "Change the address shown to 12 Main Street", reply: "That lives in your business settings." },
    tuned: { ...tunedBase, prompt: "Change our phone number to 555 0000", mustRefuse: true, reply: "That lives in your business settings." } });
  cases.push({ what: "a policy prompt that changed something",
    held: { ...heldBase, prompt: "Change the address shown to 12 Main Street", changed: true, versionDelta: 1, specAfter: movedHeld },
    tuned: { ...tunedBase, prompt: "Change our phone number to 555 0000", mustRefuse: true, changed: true, versionDelta: 1, specAfter: movedTuned } });
  cases.push({ what: "an already-claim with no predicate",
    held: { ...heldBase, prompt: "Use a calmer accent colour", reply: "The accent is already calm." },
    tuned: { ...tunedBase, prompt: "Use a softer background tone", reply: "The background is already soft." } });
  cases.push({ what: "a timeout",
    held: { ...heldBase, prompt: "Square off the buttons", reply: "That took too long to work out — your site is exactly as it was." },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", reply: "That took too long to work out — your site is exactly as it was." } });
  cases.push({ what: "a stale-write conflict",
    held: { ...heldBase, prompt: "Square off the buttons", status: 409 },
    tuned: { ...tunedBase, prompt: "Make the headings a little larger", status: 409 } });

  for (const c of cases) {
    const a = classify(c.held).outcome;
    const b = classify3f2(c.tuned).outcome;
    assert.equal(a, b, `${c.what}: held-out says ${a}, Stage 3F.2 says ${b}`);
  }
  assert.deepEqual([...HARD_FAILURE_CLASSES].sort(), ["model_failure", "timeout", "wrong_mutation"]);
  assert.equal(NOT_AN_ATTEMPT.size, 5);
});

// 3 · the rules, on synthetic specs
ok("a proven no-op passes and a contradicted one fails", () => {
  const before = spec();
  before.design.chrome.cta = "square";
  assert.equal(obs({ specBefore: before, specAfter: before, reply: "Your buttons are already square, so I left the site as it is." }).outcome, "correct_no_op");
  assert.equal(obs({ reply: "Your buttons are already square, so I left the site as it is." }).outcome, "model_failure");
});

ok("the menu-at-the-top phrasing is a no-op, and any mutation for it fails", () => {
  const p = "Keep the menu pinned at the top of the page";
  assert.equal(obs({ prompt: p, reply: "Your menu is already at the top of every page, in the header." }).outcome, "correct_no_op");
  const moved = spec();
  moved.design.chrome.navPosition = moved.design.chrome.navPosition === "center" ? "edge" : "center";
  assert.equal(obs({ prompt: p, changed: true, versionDelta: 1, specAfter: moved }).outcome, "wrong_mutation");
});

ok("a duplicate section is only a duplicate refusal where one is expected", () => {
  const reply = "Your site already has a gallery, so I haven't added a second one. If you'd like it to look different, just say so.";
  assert.equal(obs({ prompt: "Add a second gallery of photos", reply }).outcome, "duplicate_section_refusal");
  assert.notEqual(obs({ prompt: "Show the gallery as two big images", reply }).outcome, "duplicate_section_refusal");
});

ok("a removal counts only when the section is really gone", () => {
  const before = withGallery();
  const after = withGallery();
  after.sections = after.sections.filter((s: any) => s.type !== "gallery");
  const p = "Take the gallery off the page altogether";
  assert.equal(classify({ prompt: p, status: 200, aborted: false, throttledTwice: false, reply: "Removed the gallery section.", changed: true, specBefore: before, specAfter: after, versionDelta: 1 }).outcome, "applied");
  const elsewhere = withGallery();
  elsewhere.design.density = "compact";
  assert.equal(classify({ prompt: p, status: 200, aborted: false, throttledTwice: false, reply: "Tightened the spacing.", changed: true, specBefore: before, specAfter: elsewhere, versionDelta: 1 }).outcome, "wrong_mutation");
});

ok("misleading replies are still caught", () => {
  assert.ok(misleadingReply("Changed the navPosition.", true, false).length >= 2);
  assert.deepEqual(misleadingReply("Squared off the buttons.", true, true), []);
  assert.deepEqual(misleadingReply("Your buttons are already square, so I left the site as it is.", false, false), []);
});

// 4 · what the baselines already satisfy — declared BEFORE the run
const withBaselines = async () => {
  const { COHORT, admin } = await import("./stage3f1-cohort");
  const db = admin();
  console.log("\n── already-true at the five baselines, declared before the run ──");
  const expected: Record<string, string[]> = {};
  for (const entry of COHORT) {
    const { data } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
    for (const prompt of HELD_OUT_PROMPTS) {
      if (!prompt.noOp) continue;
      const verdict = prompt.noOp(data!.spec);
      if (verdict.satisfied) (expected[prompt.text] ??= []).push(`#${entry.n} ${verdict.observed.slice(0, 60)}`);
    }
  }
  for (const [prompt, where] of Object.entries(expected)) {
    console.log(`  ${where.length}x ${prompt}`);
    for (const w of where) console.log(`      ${w}`);
  }
  const total = Object.values(expected).reduce((sum, w) => sum + w.length, 0);
  console.log(`  → ${total} prompt/site pairs are already true at the baseline (they can only be correct no-ops, never applied)`);
  return expected;
};

const main = async () => {
  if (process.env.BASELINES) await withBaselines();
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

void main();
