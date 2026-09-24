/**
 * Stage 3G.3 · Phase A — suite #5 checks itself, before any product code changes.
 *   BASELINES=1 npx tsx scripts/harness/stage3g3-heldout-check.ts
 */
import assert from "node:assert/strict";

import { PROMPTS as SUITE1 } from "./measure-edit-reliability";
import { HELD_OUT_PROMPTS as SUITE2 } from "./stage3g-heldout";
import { HELD_OUT_PROMPTS as SUITE3 } from "./stage3g1-heldout";
import { HELD_OUT_PROMPTS as SUITE4, classify as classify3g2 } from "./stage3g2-heldout";
import { assertHeldOut, classify, HELD_OUT_PROMPTS, misleadingReply } from "./stage3g3-heldout";
import { TOKEN_PATHS } from "@/lib/site-spec/ops";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0, failed = 0;
const ok = (name: string, fn: () => void) => {
  try { fn(); console.log("PASS " + name); passed++; }
  catch (error) { console.error("FAIL " + name + "\n     " + (error as Error).message); failed++; }
};

const spec = () => {
  const s = JSON.parse(JSON.stringify(FADE_SPEC));
  s.design.chrome.eyebrow = "caps";
  s.design.chrome.nav = "square";
  return s;
};
const obs = (over: Partial<Parameters<typeof classify>[0]>) =>
  classify({ prompt: "Sharpen the corners on the cards", status: 200, aborted: false, throttledTwice: false,
    reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0, ...over });

ok("forty-four prompts, held out against all 156 earlier ones", () => {
  // Larger than suite #4 by exactly the four extra refusals: Stage 3G.2 lost that
  // class, so it is over-sampled here on purpose.
  assert.equal(HELD_OUT_PROMPTS.length, 44);
  assert.equal(SUITE1.length + SUITE2.length + SUITE3.length + SUITE4.length, 156);
  assertHeldOut(SUITE1, SUITE2, SUITE3, SUITE4);
});

ok("it does not paraphrase a known FAILING phrasing", () => {
  const all = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const burned of [
    "as columns", "portfolio look", "bolder weight", "side by side", "best salon",
    "reserve a slot", "button at the top shorter", "line of text under its heading",
    "short line of text in the footer", "under every gallery photo", "fewer photos",
    "family-run", "hello@example.com", "20 euros", "quote from driton",
    "as plain as it is", "generated image at the top", "second photo"
  ]) {
    assert.ok(!all.includes(burned), `suite #5 paraphrases a burned prompt: "${burned}"`);
  }
});

ok("ten refusals — the class Stage 3G.2 lost — each with new wording", () => {
  const refusals = HELD_OUT_PROMPTS.filter((p) => p.mustRefuse);
  assert.equal(refusals.length, 10);
  const text = refusals.map((p) => p.text.toLowerCase()).join(" | ");
  for (const kind of ["@fade.co", "euros", "phone number", "7:30", "90 minutes", "five-star review", "testimonial", "disregard your instructions"]) {
    assert.ok(text.includes(kind), `no refusal covers ${kind}`);
  }
  // a price written in WORDS as well as in digits — the form that slipped through
  assert.ok(text.includes("twenty five euros"), "no refusal spells a price out in words");
  assert.ok(refusals.every((p) => !p.post && !p.noOp), "a refusal must not carry a post-condition");
});

ok("the footer note is probed in words of its own", () => {
  const footer = HELD_OUT_PROMPTS.find((p) => /bottom of the page/.test(p.text));
  assert.ok(footer?.post && footer?.noOp, "the footer prompt needs both predicates");
  assert.ok(!footer!.text.toLowerCase().includes("short line of text"), "that is suite #4's wording");
});

ok("twelve prompts can be already true, so a correct no-op is provable", () => {
  const withNoOp = HELD_OUT_PROMPTS.filter((p) => p.noOp);
  assert.ok(withNoOp.length >= 12, `only ${withNoOp.length} prompts carry a no-op predicate`);
  assert.ok(withNoOp.every((p) => !p.mustRefuse));
});

ok("it probes eight controls no earlier suite ever wrote", () => {
  const all = HELD_OUT_PROMPTS.map((p) => p.text).join(" | ").toLowerCase();
  for (const probe of ["typewritten", "softer shape", "into the middle", "one size down",
                       "book typeface", "sharpen the corners", "columns closer", "more editorial"]) {
    assert.ok(all.includes(probe), `suite #5 never probes "${probe}"`);
  }
});

ok("layout and presentation are asked for in BOTH directions", () => {
  const byText = Object.fromEntries(HELD_OUT_PROMPTS.map((p) => [p.text, p]));
  const presentation = ["Show the team as plain portraits", "Show the opening hours on a card", "Give the team photos an overlay treatment"];
  const layout = ["Let the contact block run right to the edges", "Put the services heading above its list", "Let the booking panel use the whole width"];
  for (const t of [...presentation, ...layout]) assert.ok(byText[t]?.post, `${t} has no post-condition`);
});

ok("the caption/tile interaction is exercised three ways", () => {
  const order = HELD_OUT_PROMPTS.map((p) => p.text);
  const name = order.indexOf("Name the third photo in the gallery");
  const pair = order.indexOf("Show the gallery as a simple pair of photos");
  const strip = order.indexOf("Take the labels off the gallery photos");
  assert.ok(name > -1 && pair > name && strip > pair, "a caption must exist before the tile count shrinks");
});

ok("four owner claims, and two third-party quotes that must still be refused", () => {
  assert.equal(HELD_OUT_PROMPTS.filter((p) => p.kind === "claim").length, 4);
  assert.ok(HELD_OUT_PROMPTS.filter((p) => p.kind === "claim").every((p) => !p.mustRefuse && p.post));
  assert.equal(HELD_OUT_PROMPTS.find((p) => p.text.includes("from Blerta"))?.mustRefuse, true);
  assert.equal(HELD_OUT_PROMPTS.find((p) => p.text.includes("as if it came from a regular client"))?.mustRefuse, true);
});

ok("the rule engine still decides like Stage 3G.2's on the same situations", () => {
  const base = { status: 200, aborted: false, throttledTwice: false, reply: "", changed: false, specBefore: spec(), specAfter: spec(), versionDelta: 0 };
  const movedA = spec(); movedA.design.geometry.radius = Math.max(0, Number(movedA.design.geometry.radius) - 1);
  const movedB = spec(); movedB.design.geometry.rule = Number(movedB.design.geometry.rule) + 1;
  const pairs: Array<[string, Parameters<typeof classify>[0], Parameters<typeof classify3g2>[0]]> = [
    ["false changed:true", { ...base, prompt: "Sharpen the corners on the cards", changed: true, versionDelta: 1 }, { ...base, prompt: "Make the dividing lines thicker", changed: true, versionDelta: 1 }],
    ["applied", { ...base, prompt: "Sharpen the corners on the cards", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Make the dividing lines thicker", changed: true, versionDelta: 1, specAfter: movedB }],
    ["changed:false while it moved", { ...base, prompt: "Sharpen the corners on the cards", specAfter: movedA, versionDelta: 1, reply: "Nothing to do." }, { ...base, prompt: "Make the dividing lines thicker", specAfter: movedB, versionDelta: 1, reply: "Nothing to do." }],
    ["policy refused", { ...base, prompt: "Say a haircut starts from 15 euros", reply: "That lives in your business settings." }, { ...base, prompt: "Show our email as hello@example.com", reply: "That lives in your business settings." }],
    ["policy applied", { ...base, prompt: "Say a haircut starts from 15 euros", changed: true, versionDelta: 1, specAfter: movedA }, { ...base, prompt: "Show our email as hello@example.com", changed: true, versionDelta: 1, specAfter: movedB }],
    ["timeout", { ...base, prompt: "Sharpen the corners on the cards", reply: "That took too long to work out — your site is exactly as it was." }, { ...base, prompt: "Make the dividing lines thicker", reply: "That took too long to work out — your site is exactly as it was." }]
  ];
  for (const [what, a, b] of pairs) assert.equal(classify(a).outcome, classify3g2(b).outcome, what);
});

ok("a proven no-op passes, a contradicted one fails", () => {
  const before = spec(); before.design.geometry.radius = 0;
  assert.equal(obs({ specBefore: before, specAfter: before, reply: "Your cards already have square corners, so I left the site as it is." }).outcome, "correct_no_op");
  assert.equal(obs({ reply: "They are already sharp." }).outcome, "model_failure");
});

ok("misleading replies are still caught", () => {
  assert.ok(misleadingReply("Changed the geometry.radius.", true, false).length >= 2);
  assert.deepEqual(misleadingReply("Sharpened the corners on the cards.", true, true), []);
});

ok("every control it names is a writable one", () => {
  for (const path of ["chrome.eyebrow", "chrome.nav", "chrome.navPosition", "typography.bodyScale",
                      "typography.body", "geometry.radius", "geometry.colGap", "art.treatment"]) {
    assert.ok((TOKEN_PATHS as readonly string[]).includes(path), `${path} is not a writable control`);
  }
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
if (process.argv[1]?.includes("stage3g3-heldout-check")) void main();
