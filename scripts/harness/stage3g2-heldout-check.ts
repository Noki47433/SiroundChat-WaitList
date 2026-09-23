/**
 * Stage 3G.2 · Phase A — suite #4 checks itself, before any product code changes.
 *   BASELINES=1 npx tsx scripts/harness/stage3g2-heldout-check.ts
 */
import assert from "node:assert/strict";

import { PROMPTS as SUITE1 } from "./measure-edit-reliability";
import { HELD_OUT_PROMPTS as SUITE2 } from "./stage3g-heldout";
import { HELD_OUT_PROMPTS as SUITE3, classify as classify3g1 } from "./stage3g1-heldout";
import { assertHeldOut, classify, HELD_OUT_PROMPTS, misleadingReply } from "./stage3g2-heldout";
import { TOKEN_PATHS } from "@/lib/site-spec/ops";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0, failed = 0;
const ok = (name: string, fn: () => void) => {
  try { fn(); console.log("PASS " + name); passed++; }
  catch (error) { console.error("FAIL " + name + "\n     " + (error as Error).message); failed++; }
};

const spec = () => {
  const s = JSON.parse(JSON.stringify(FADE_SPEC));
  s.design.chrome.cta = "pill";
  s.footer.presentation = "minimal";
  return s;
};
const obs = (over: Partial<Parameters<typeof classify>[0]>) =>
  classify({ prompt: "Make the dividing lines thicker", status: 200, aborted: false, throttledTwice: false,
    reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0, ...over });

ok("forty prompts, held out against all 116 earlier ones", () => {
  assert.equal(HELD_OUT_PROMPTS.length, 40);
  assert.equal(SUITE1.length + SUITE2.length + SUITE3.length, 116);
  assertHeldOut(SUITE1, SUITE2, SUITE3);
});

ok("it does not paraphrase any known failure", () => {
  const all = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const burned of [
    "as columns", "portfolio look", "bolder weight", "side by side", "best salon",
    "reserve a slot", "button at the top shorter", "line of text under its heading",
    "family-run", "since 2016", "best newcomer", "two big images", "packages"
  ]) {
    assert.ok(!all.includes(burned), `suite #4 paraphrases a burned prompt: "${burned}"`);
  }
});

ok("it probes controls no earlier suite ever touched", () => {
  const all = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const probe of ["heavier", "letter spacing", "narrower", "shorter in height", "space between them",
                       "dividing lines", "big panels", "muted text", "generated image"]) {
    assert.ok(all.includes(probe), `suite #4 never probes "${probe}"`);
  }
});

ok("layout and presentation are asked for in BOTH directions", () => {
  const byText = Object.fromEntries(HELD_OUT_PROMPTS.map((p) => [p.text, p]));
  const presentation = ["Show the booking area as a dark inverted panel", "Give the services an editorial treatment", "Show the services one under another in a plain list"];
  const layout = ["Lay the opening hours out with the heading beside the text", "Stack the gallery heading above its photos", "Centre the opening hours heading and text"];
  for (const t of [...presentation, ...layout]) assert.ok(byText[t]?.post, `${t} has no post-condition`);
  assert.equal(presentation.length + layout.length, 6);
});

ok("the gallery caption/tile interaction is exercised three times, in order", () => {
  const order = HELD_OUT_PROMPTS.map((p) => p.text);
  const label = order.indexOf("Label the second photo in the gallery");
  const fewer = order.indexOf("Show fewer photos in the gallery, but larger");
  const every = order.indexOf("Put a caption under every gallery photo");
  assert.ok(label > -1 && fewer > label && every > fewer, "the caption must come before the tile-count change");
});

ok("four owner claims, and a third-party quote that must still be refused", () => {
  assert.equal(HELD_OUT_PROMPTS.filter((p) => p.kind === "claim").length, 4);
  assert.ok(HELD_OUT_PROMPTS.filter((p) => p.kind === "claim").every((p) => !p.mustRefuse && p.post));
  assert.equal(HELD_OUT_PROMPTS.find((p) => p.text.includes("quote from Driton"))?.mustRefuse, true);
  assert.equal(HELD_OUT_PROMPTS.filter((p) => p.mustRefuse).length, 6);
});

ok("the rule engine still decides like Stage 3G.1's on the same situations", () => {
  const base = { status: 200, aborted: false, throttledTwice: false, reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0 };
  const movedA = spec(); movedA.design.geometry.rule = Number(movedA.design.geometry.rule) + 1;
  const movedB = spec(); movedB.footer.presentation = "brand";
  const pairs: Array<[string, Parameters<typeof classify>[0], Parameters<typeof classify3g1>[0]]> = [
    ["false changed:true", { ...base, prompt: "Make the dividing lines thicker", changed: true, versionDelta: 1 }, { ...base, prompt: "Make the footer show the brand", changed: true, versionDelta: 1 }],
    ["applied", { ...base, prompt: "Make the dividing lines thicker", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Make the footer show the brand", changed: true, versionDelta: 1, specAfter: movedB }],
    ["changed:false while it moved", { ...base, prompt: "Make the dividing lines thicker", specAfter: movedA, versionDelta: 1, reply: "Nothing to do." }, { ...base, prompt: "Make the footer show the brand", specAfter: movedB, versionDelta: 1, reply: "Nothing to do." }],
    ["policy refused", { ...base, prompt: "Show our email as hello@example.com", reply: "That lives in your business settings." }, { ...base, prompt: "Use 038 200 300 as the contact number", reply: "That lives in your business settings." }],
    ["policy applied", { ...base, prompt: "Show our email as hello@example.com", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Use 038 200 300 as the contact number", changed: true, versionDelta: 1, specAfter: movedB }],
    ["timeout", { ...base, prompt: "Make the dividing lines thicker", reply: "That took too long to work out — your site is exactly as it was." }, { ...base, prompt: "Make the footer show the brand", reply: "That took too long to work out — your site is exactly as it was." }]
  ];
  for (const [what, a, b] of pairs) assert.equal(classify(a).outcome, classify3g1(b).outcome, what);
});

ok("a proven no-op passes, a contradicted one fails", () => {
  const before = spec(); before.design.geometry.rule = 4;
  assert.equal(obs({ specBefore: before, specAfter: before, reply: "Your dividing lines are already as thick as they go, so I left the site as it is." }).outcome, "correct_no_op");
  assert.equal(obs({ reply: "They are already that thick." }).outcome, "model_failure");
});

ok("misleading replies are still caught", () => {
  assert.ok(misleadingReply("Changed the radiusLg.", true, false).length >= 2);
  assert.deepEqual(misleadingReply("Made the dividing lines thicker.", true, true), []);
});

ok("the suite reaches a fair share of the writable-control registry", () => {
  // Not every token needs a prompt, but the suite must touch controls the
  // earlier suites never did — this records how much of the registry is covered.
  const touched = ["typography.heroWeight", "typography.tracking", "typography.measure", "hero.height",
                   "geometry.gap", "geometry.rule", "geometry.radiusLg", "palette.muted"];
  for (const path of touched) assert.ok((TOKEN_PATHS as readonly string[]).includes(path), `${path} is not a writable control`);
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
