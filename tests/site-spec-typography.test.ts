/**
 * Stage 3E.1 — typography without opening the design system.
 *   npx tsx tests/site-spec-typography.test.ts
 *
 * Written before any model was asked anything, deliberately. Stage 3E measured
 * two hard failures — "make the headings a little larger" and "use a more classic
 * typeface for headings" — and the temptation with a failure like that is to let
 * a little more through and watch the number improve. What the model gains here
 * is not a size and not a font name: it is a choice from a list of four words and
 * a list of seven ids. The arithmetic and the font stacks stay in code.
 *
 * So these tests are mostly about what CANNOT happen:
 *
 *   · no px, rem, em, percentage or bare number can become a type size
 *   · no arbitrary string can become a font-family
 *   · an injection string is a rejected value, not a smaller injection
 *   · a design edit cannot touch a price, a duration, an hour or a phone number
 *   · a spec written before these fields existed still validates and still
 *     renders exactly as it did
 */
import assert from "node:assert/strict";

import { applyOps } from "@/lib/site-spec/ops";
import { toSiteSpecOp } from "@/lib/site-spec/ai/edit";
import { validateSiteSpec, SiteSpecSchema, type SiteSpec } from "@/lib/site-spec/schema";
import { designToCssVariables } from "@/lib/site-spec/tokens";
import {
  FONT_STACKS,
  FONT_STACK_IDS,
  TYPE_SCALES,
  TYPE_SCALE_FACTOR
} from "@/lib/site-spec/vocabulary";
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

const spec = () => JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
const apply = (ops: any[]) => applyOps(spec(), ops);

// ─────────────────────────────────────────────────────────────────────────────
// 1 · the vocabulary is closed, and the numbers are ours
// ─────────────────────────────────────────────────────────────────────────────

ok("the type scale is four named steps and nothing else", () => {
  assert.deepEqual([...TYPE_SCALES], ["smaller", "default", "larger", "largest"]);
  for (const step of TYPE_SCALES) {
    const factor = TYPE_SCALE_FACTOR[step];
    assert.equal(typeof factor, "number");
    assert.ok(factor >= 0.8 && factor <= 1.4, `${step} multiplier ${factor} is outside a sane range`);
  }
  assert.equal(TYPE_SCALE_FACTOR.default, 1, "default must be exactly no change");
});

ok("the steps are monotonic — larger really is larger", () => {
  const order = TYPE_SCALES.map((step) => TYPE_SCALE_FACTOR[step]);
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i] > order[i - 1], `${TYPE_SCALES[i]} is not larger than ${TYPE_SCALES[i - 1]}`);
  }
});

ok("every font id resolves to a real stack with a fallback", () => {
  for (const id of FONT_STACK_IDS) {
    const stack = FONT_STACKS[id];
    assert.ok(stack.includes(","), `${id} has no fallback`);
    assert.ok(!/url\(|@import|javascript:|expression\(/i.test(stack), `${id} carries something executable`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · valid changes
// ─────────────────────────────────────────────────────────────────────────────

for (const step of TYPE_SCALES) {
  ok(`heading scale "${step}" applies and validates`, () => {
    const result = apply([{ op: "set_token", path: "typography.headingScale", value: step }]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal((result.spec.design.typography as any).headingScale, step);
    assert.equal(validateSiteSpec(result.spec).ok, true);
  });
}

ok("body scale applies independently of heading scale", () => {
  const result = apply([
    { op: "set_token", path: "typography.headingScale", value: "larger" },
    { op: "set_token", path: "typography.bodyScale", value: "smaller" }
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const typography = result.spec.design.typography as any;
  assert.equal(typography.headingScale, "larger");
  assert.equal(typography.bodyScale, "smaller");
});

ok("every font id can be set for headings and for body", () => {
  for (const id of FONT_STACK_IDS) {
    for (const path of ["typography.display", "typography.body"]) {
      const result = apply([{ op: "set_token", path, value: id }]);
      assert.equal(result.ok, true, `${path} = ${id} was refused`);
    }
  }
});

ok("a scale change reaches the stylesheet as a multiplier, not a size", () => {
  const result = apply([{ op: "set_token", path: "typography.headingScale", value: "largest" }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const css = designToCssVariables(result.spec.design) as Record<string, string>;
  assert.equal(css["--w-hscale"], String(TYPE_SCALE_FACTOR.largest));
  // The emitted value is a bare number. A unit here would mean a size had leaked.
  assert.match(String(css["--w-hscale"]), /^[0-9.]+$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · no-op changes
// ─────────────────────────────────────────────────────────────────────────────

ok("setting the scale to the value it already has is accepted and changes nothing", () => {
  const before = spec();
  const current = (before.design.typography as any).headingScale ?? "default";
  const result = applyOps(before, [
    { op: "set_token", path: "typography.headingScale", value: current }
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.spec.design.typography, spec().design.typography);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · what must not get through
// ─────────────────────────────────────────────────────────────────────────────

const REFUSED_SIZES = [
  "18px", "1.4rem", "2em", "120%", "clamp(20px,4vw,40px)", "calc(1rem + 2px)",
  "xx-large", "bigger", "", "  ", "LARGER"
];
for (const value of REFUSED_SIZES) {
  ok(`type size refuses ${JSON.stringify(value)}`, () => {
    const result = apply([{ op: "set_token", path: "typography.headingScale", value }]);
    assert.equal(result.ok, false, `"${value}" was accepted as a type size`);
  });
}

ok("a numeric type size is refused — there is no number path for scale", () => {
  for (const value of [18, 1.5, 0, 999]) {
    const result = apply([{ op: "set_token", path: "typography.headingScale", value }]);
    assert.equal(result.ok, false, `${value} was accepted as a type size`);
  }
});

const REFUSED_FONTS = [
  "Comic Sans MS",
  "'Helvetica', sans-serif",
  "url(https://evil.example/font.woff2)",
  "system; background:url(javascript:alert(1))",
  "</style><script>alert(1)</script>",
  "var(--w-ink)",
  "@import url(x)",
  "serif-display, Comic Sans"
];
for (const value of REFUSED_FONTS) {
  ok(`font family refuses ${JSON.stringify(value.slice(0, 34))}`, () => {
    for (const path of ["typography.display", "typography.body"]) {
      const result = apply([{ op: "set_token", path, value }]);
      assert.equal(result.ok, false, `"${value}" was accepted for ${path}`);
    }
  });
}

ok("an injection string is a refused value, not a shortened one", () => {
  const attack = "largest\"; background:url(javascript:alert(1)); x:\"";
  const result = apply([{ op: "set_token", path: "typography.headingScale", value: attack }]);
  assert.equal(result.ok, false);
  // And nothing resembling it can be present in the rendered variables.
  const css = designToCssVariables(spec().design) as Record<string, string>;
  assert.ok(!JSON.stringify(css).includes("javascript:"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · the model surface maps intent onto the closed choices — and only those
// ─────────────────────────────────────────────────────────────────────────────

ok("the model's set_token maps a scale word through unchanged", () => {
  const op = toSiteSpecOp({
    op: "set_token",
    path: "typography.headingScale",
    stringValue: "larger",
    numberValue: null
  } as any);
  assert.deepEqual(op, { op: "set_token", path: "typography.headingScale", value: "larger" });
});

ok("a model numberValue cannot become a type size", () => {
  // The scale paths are not numeric, so a model that sends a number sends nothing.
  const op = toSiteSpecOp({
    op: "set_token",
    path: "typography.headingScale",
    stringValue: null,
    numberValue: 42
  } as any);
  assert.equal(op, null);
});

ok("the prompt actually names every font id, so none is unreachable", async () => {
  const { EDIT_SYSTEM_PROMPT } = await import("@/lib/site-spec/ai/edit");
  for (const id of FONT_STACK_IDS) {
    assert.ok(EDIT_SYSTEM_PROMPT.includes(id), `the prompt never mentions the "${id}" font`);
  }
  for (const step of TYPE_SCALES) {
    assert.ok(EDIT_SYSTEM_PROMPT.includes(step), `the prompt never mentions the "${step}" scale`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 · operational truth is untouched by design edits
// ─────────────────────────────────────────────────────────────────────────────

ok("a typography change touches design and nothing else", () => {
  const before = spec();
  const result = applyOps(before, [
    { op: "set_token", path: "typography.headingScale", value: "largest" },
    { op: "set_token", path: "typography.display", value: "serif-display" }
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const original = spec();
  // Everything outside `design` is byte-identical: sections, selection, content,
  // terminology, seo. A price or an opening hour cannot move through this door.
  assert.deepEqual(
    { ...result.spec, design: null },
    { ...original, design: null },
    "a design edit changed something outside design"
  );
  // And within design, only typography moved.
  assert.deepEqual(result.spec.design.palette, original.design.palette);
  assert.deepEqual(result.spec.design.geometry, original.design.geometry);
  assert.deepEqual(result.spec.design.hero, original.design.hero);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7 · specs written before these fields existed
// ─────────────────────────────────────────────────────────────────────────────

ok("a spec with no scale fields validates and defaults to no change", () => {
  const old = spec() as any;
  delete old.design.typography.headingScale;
  delete old.design.typography.bodyScale;

  const parsed = SiteSpecSchema.safeParse(old);
  assert.equal(parsed.success, true, "an existing production spec no longer validates");
  if (!parsed.success) return;
  assert.equal((parsed.data.design.typography as any).headingScale, "default");
  assert.equal((parsed.data.design.typography as any).bodyScale, "default");
});

ok("an older spec renders at exactly the size it always did", () => {
  const old = spec() as any;
  delete old.design.typography.headingScale;
  delete old.design.typography.bodyScale;
  const parsed = SiteSpecSchema.parse(old);
  const css = designToCssVariables(parsed.design) as Record<string, string>;
  assert.equal(css["--w-hscale"], "1");
  assert.equal(css["--w-bscale"], "1");
});

// ─────────────────────────────────────────────────────────────────────────────
// 8 · Stage 3E.1 — the services full-width request
// ─────────────────────────────────────────────────────────────────────────────

ok("the exact Stage 3E failure now applies, as the legal full-width layout", () => {
  const before = spec();
  const services = before.sections.find((section: any) => section.type === "services") as any;
  const result = applyOps(before, [
    // What the model reaches for when asked for full width.
    { op: "set_layout", sectionId: services.id, layout: "flush" }
  ]);
  assert.equal(result.ok, true, "the request was refused again");
  if (!result.ok) return;
  const after = result.spec.sections.find((section: any) => section.id === services.id) as any;
  assert.equal(after.layout, "wide", "flush should map to the legal full-width layout");
  assert.equal(validateSiteSpec(result.spec).ok, true);
});

ok("every layout is now legal on a services section", () => {
  const services = spec().sections.find((section: any) => section.type === "services") as any;
  for (const layout of ["stack", "split", "wide", "centered", "edge", "flush"]) {
    const result = apply([{ op: "set_layout", sectionId: services.id, layout }]);
    assert.equal(result.ok, true, `layout "${layout}" was refused`);
  }
});

ok("a contact section may still be genuinely edge-to-edge", () => {
  // The mapping must not take flush away from the one section built to survive it.
  const base = spec();
  const contact = base.sections.find((section: any) => section.type === "contact") as any;
  if (!contact) return; // fixture has no contact section; nothing to assert
  const result = applyOps(base, [{ op: "set_layout", sectionId: contact.id, layout: "flush" }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const after = result.spec.sections.find((section: any) => section.id === contact.id) as any;
  assert.equal(after.layout, "flush", "contact lost its edge-to-edge layout");
});

ok("mapping a layout changes nothing else about the section", () => {
  const before = spec();
  const services = before.sections.find((section: any) => section.type === "services") as any;
  const snapshot = JSON.parse(JSON.stringify(services));
  const result = applyOps(before, [
    { op: "set_layout", sectionId: services.id, layout: "flush" }
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const after = result.spec.sections.find((section: any) => section.id === services.id) as any;
  assert.deepEqual(
    { ...after, layout: null },
    { ...snapshot, layout: null },
    "something other than the layout moved"
  );
  // Section count and order are untouched.
  assert.deepEqual(
    result.spec.sections.map((section: any) => section.id),
    spec().sections.map((section: any) => section.id)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 9 · the timeout contract
// ─────────────────────────────────────────────────────────────────────────────

ok("the owner-facing SLA is larger than the model budget it contains", async () => {
  const { EDIT_MODEL_TIMEOUT_MS, EDIT_RESPONSE_SLA_MS } = await import("@/lib/site-spec/ai/edit");
  assert.equal(EDIT_MODEL_TIMEOUT_MS, 25_000);
  assert.equal(EDIT_RESPONSE_SLA_MS, 30_000);
  assert.ok(
    EDIT_RESPONSE_SLA_MS > EDIT_MODEL_TIMEOUT_MS,
    "the promise to the owner must leave room for the work after the model answers"
  );
  assert.ok(
    EDIT_RESPONSE_SLA_MS - EDIT_MODEL_TIMEOUT_MS >= 5_000,
    "authorise, apply, validate, write and two network hops need real headroom"
  );
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
