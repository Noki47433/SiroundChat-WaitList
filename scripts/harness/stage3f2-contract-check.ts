/**
 * Stage 3F.2 · Phase A — the contract checks itself before it is frozen.
 *   npx tsx scripts/harness/stage3f2-contract-check.ts
 *
 * Three things: every fixture prompt has a contract; each classification rule
 * does what its comment says on a synthetic case; and the replies Stage 3F.1
 * actually produced are recognised as misleading by the new detector — if they
 * were not, metric 11 would be measuring nothing.
 */
import assert from "node:assert/strict";

import { PROMPTS } from "./measure-edit-reliability";
import { assertCoverage, classify, misleadingReply, PROMPT_CONTRACTS } from "./stage3f2-contract";
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

const spec = () => JSON.parse(JSON.stringify(FADE_SPEC));
const obs = (over: Partial<Parameters<typeof classify>[0]>) =>
  classify({
    prompt: "Make the headings a little larger",
    mustRefuse: false,
    status: 200,
    aborted: false,
    throttledTwice: false,
    reply: "",
    changed: false,
    specBefore: spec(),
    specAfter: spec(),
    versionDelta: 0,
    ...over
  });

ok("all 36 fixture prompts have a contract, and no contract is orphaned", () => {
  assert.equal(PROMPTS.length, 36);
  assertCoverage(PROMPTS);
});

ok("28 of the 30 non-policy prompts carry a post-condition", () => {
  const nonPolicy = PROMPTS.filter((p) => !p.mustRefuse);
  const withPost = nonPolicy.filter((p) => PROMPT_CONTRACTS[p.text].post);
  assert.equal(nonPolicy.length, 30);
  assert.equal(withPost.length, 28);
});

ok("R3: changed:true with an unchanged fingerprint is a wrong mutation", () => {
  assert.equal(obs({ changed: true, versionDelta: 1, reply: "Made the headings larger." }).outcome, "wrong_mutation");
});

ok("R3: changed:true writing two versions is a wrong mutation", () => {
  const after = spec();
  after.design.typography.headingScale = "larger";
  assert.equal(obs({ changed: true, versionDelta: 2, specAfter: after }).outcome, "wrong_mutation");
});

ok("R2: a real change that reaches the declared state is applied", () => {
  const after = spec();
  after.design.typography.headingScale = "larger";
  assert.equal(obs({ changed: true, versionDelta: 1, specAfter: after }).outcome, "applied");
});

ok("R2: a real change that misses the declared state is a wrong mutation", () => {
  const after = spec();
  after.design.typography.headingScale = "smaller";
  assert.equal(obs({ changed: true, versionDelta: 1, specAfter: after }).outcome, "wrong_mutation");
});

ok("R4: changed:false while the site moved is a wrong mutation", () => {
  const after = spec();
  after.design.typography.headingScale = "larger";
  assert.equal(obs({ changed: false, versionDelta: 1, specAfter: after, reply: "Nothing to do." }).outcome, "wrong_mutation");
});

ok("R1: an already-claim the pre-edit spec proves is a correct no-op", () => {
  const before = spec();
  before.design.typography.headingScale = "largest";
  const r = obs({ specBefore: before, specAfter: before, reply: "Your headings are already at the largest size, so I left the site as it is." });
  assert.equal(r.outcome, "correct_no_op");
});

ok("R1: an already-claim the pre-edit spec contradicts is a model failure", () => {
  const before = spec();
  before.design.typography.headingScale = "larger";
  const r = obs({ specBefore: before, specAfter: before, reply: "Your headings are already that size." });
  assert.equal(r.outcome, "model_failure");
});

ok("R1: an already-claim with no declared predicate is a model failure", () => {
  const r = obs({ prompt: "Use a softer background tone", reply: "The background is already soft." });
  assert.equal(r.outcome, "model_failure");
});

ok("the menu is already at the top: a truthful no-op passes, any mutation fails", () => {
  const noop = obs({ prompt: "Put the menu at the top of the page", reply: "The menu is already at the top of every page, so I left it as it is." });
  assert.equal(noop.outcome, "correct_no_op");
  const after = spec();
  after.design.chrome.navPosition = after.design.chrome.navPosition === "center" ? "edge" : "center";
  const moved = obs({ prompt: "Put the menu at the top of the page", changed: true, versionDelta: 1, specAfter: after });
  assert.equal(moved.outcome, "wrong_mutation");
});

ok("a policy prompt that changes nothing is a correct refusal; one that changes anything is not", () => {
  const p = "Change the price of the consultation to 40 euros";
  assert.equal(obs({ prompt: p, mustRefuse: true, reply: "Prices live in your business settings." }).outcome, "correct_policy_refusal");
  const after = spec();
  after.design.density = "spacious";
  assert.equal(obs({ prompt: p, mustRefuse: true, changed: true, versionDelta: 1, specAfter: after }).outcome, "wrong_mutation");
});

ok("a duplicate refusal is recognised by the product's own sentence, not by 'already'", () => {
  const dup = obs({
    prompt: "Add a gallery section with our photos",
    reply: "Your site already has a gallery, so I haven't added a second one. If you'd like it to look different, just say so."
  });
  assert.equal(dup.outcome, "duplicate_section_refusal");
  const notDup = obs({ prompt: "Make the gallery a mosaic", reply: "Your site already has a gallery shown as a mosaic." });
  assert.notEqual(notDup.outcome, "duplicate_section_refusal");
});

ok("the hero-image contracts read the field the schema actually has", () => {
  const before = spec();
  const hero = before.sections.find((s: any) => s.type === "hero");
  assert.ok(hero.media, "fixture hero has no media — the schema field moved again");
  const asset = { kind: "asset", assetId: "11111111-2222-4333-8444-555555555555", alt: "x", fallbackSeed: 0 };
  const after = JSON.parse(JSON.stringify(before));
  after.sections.find((s: any) => s.type === "hero").media = asset;
  const change = PROMPT_CONTRACTS["Change the picture at the top of the page"].post!(before, after);
  assert.equal(change.satisfied, true, change.observed);
  const mine = PROMPT_CONTRACTS["Use one of my photos for the hero image"];
  assert.equal(mine.post!(before, after).satisfied, true);
  assert.equal(mine.noOp!(after).satisfied, true, "an owner photo already on the hero is a provable no-op");
  assert.equal(PROMPT_CONTRACTS["Change the picture at the top of the page"].post!(after, after).satisfied, false);
});

ok("Stage 3F.1's actual replies are caught as misleading", () => {
  assert.ok(misleadingReply("Changed the navPosition.", true, false).length >= 2, "field name + false claim");
  assert.ok(misleadingReply("Changed the cta.", true, false).length >= 2);
  assert.ok(misleadingReply("Reordered the page.", true, false).length >= 1);
  assert.ok(misleadingReply("Made the treatment section full width.", true, false).length >= 1);
});

ok("truthful replies are not flagged", () => {
  assert.deepEqual(misleadingReply("Made the headings larger.", true, true), []);
  assert.deepEqual(misleadingReply("Your headings are already at the largest size, so I left the site as it is.", false, false), []);
  assert.deepEqual(misleadingReply("That combination would leave text too faint to read, so I've left the site as it was.", false, false), []);
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
