/**
 * Stage 3F.1 — the navigation gap, closed without new vocabulary.
 *   npx tsx tests/site-spec-navigation.test.ts
 *
 * Written before any model was asked anything.
 *
 * "Add the gallery to the navigation" was the one genuine failure in the Stage 3F
 * cohort, and the replay showed the cause is not where the error message pointed.
 * `set_nav` replaces the entire menu, and `describeSpecForEditing` — everything
 * the model is told about the site — never mentions the menu. So the model was
 * asked to restate a list it had never been shown, and did the only thing it
 * could: it enumerated the sections. That overflows the four-item cap and starts
 * with `hero`, which is not linkable, so the request died at the validator or the
 * applier and the owner was told it "didn't come through in a form I can use".
 *
 * The fix adds no operation, no path, no selector and no URL. It shows the model
 * the list it is being asked to replace, and makes the two refusals say what is
 * actually wrong. These tests pin both halves, and the invariants around them.
 */
import assert from "node:assert/strict";

import { applyOps } from "@/lib/site-spec/ops";
import { describeSpecForEditing } from "@/lib/site-spec/ai/edit";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { MAX_NAV_ITEMS } from "@/lib/site-spec/vocabulary";
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

const base = (): SiteSpec => JSON.parse(JSON.stringify(FADE_SPEC));

/** The production shape of the failure: a site that HAS a gallery. */
const withGallery = (): SiteSpec => {
  const spec = base();
  const services = spec.sections.findIndex((s: any) => s.type === "services");
  spec.sections.splice(services + 1, 0, {
    id: "gallery",
    type: "gallery",
    layout: "wide",
    presentation: "mosaic",
    heading: { title: "Our Work" },
    items: Array.from({ length: 6 }, (_, i) => ({ kind: "generated", seed: i })),
    captions: [],
    framing: {}
  } as any);
  return spec;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1 · the model must be able to SEE the list it is asked to replace
// ─────────────────────────────────────────────────────────────────────────────

ok("the site description tells the model what is currently in the navigation", () => {
  const spec = withGallery();
  const described = describeSpecForEditing(spec, []);
  assert.match(described, /NAVIGATION/i, "the description never mentions the navigation");
  for (const id of (spec as any).nav.items) {
    assert.ok(described.includes(id), `the current nav item "${id}" is not shown to the model`);
  }
});

/** The NAVIGATION block only — so these assertions cannot pass on the section list. */
const navBlock = (described: string) => {
  const start = described.search(/NAVIGATION/i);
  if (start === -1) return "";
  const rest = described.slice(start);
  const end = rest.search(/\n\n[A-Z ]{4,}:/);
  return end === -1 ? rest : rest.slice(0, end);
};

ok("the navigation block states the cap and that the hero cannot be linked", () => {
  const block = navBlock(describeSpecForEditing(withGallery(), []));
  assert.notEqual(block, "", "there is no navigation block at all");
  assert.ok(
    block.includes(String(MAX_NAV_ITEMS)),
    `the ${MAX_NAV_ITEMS}-item cap is not stated in the navigation block`
  );
  assert.match(block, /hero/i, "the navigation block does not say the hero cannot be linked");
});

ok("the navigation block names which section ids are linkable", () => {
  const spec = withGallery();
  const block = navBlock(describeSpecForEditing(spec, []));
  const linkable = spec.sections
    .filter((s: any) => s.type !== "hero" && s.type !== "bookingStrip")
    .map((s: any) => s.id);
  for (const id of linkable) {
    assert.ok(block.includes(id), `linkable section "${id}" is not offered in the navigation block`);
  }
  // And the two that are not linkable must not appear in the OFFERED LIST — which
  // is the comma-separated ids before the em dash, not the sentence after it that
  // explains why the hero is excluded.
  const listed = block
    .split("\n")
    .find((line) => /can be linked:/i.test(line))!
    .replace(/.*can be linked:\s*/i, "")
    .split("—")[0]
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  for (const id of spec.sections
    .filter((s: any) => s.type === "hero" || s.type === "bookingStrip")
    .map((s: any) => s.id)) {
    assert.ok(!listed.includes(id), `"${id}" is offered as a nav choice`);
  }
  for (const id of linkable) {
    assert.ok(listed.includes(id), `linkable "${id}" missing from the offered list`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · the operation itself: a gallery can be added to the navigation
// ─────────────────────────────────────────────────────────────────────────────

ok("a gallery present on the page can be added to the navigation", () => {
  const spec = withGallery();
  const before = [...(spec as any).nav.items];
  // What a model that can see the list would send: the existing items plus the
  // gallery, within the cap.
  const next = [...before.slice(0, MAX_NAV_ITEMS - 1), "gallery"];
  const result = applyOps(spec, [{ op: "set_nav", items: next }]);
  assert.equal(result.ok, true, `refused: ${(result as any).message ?? JSON.stringify((result as any).issues)}`);
  if (!result.ok) return;
  assert.deepEqual((result.spec as any).nav.items, next);
  assert.ok((result.spec as any).nav.items.includes("gallery"));
  assert.equal(validateSiteSpec(result.spec).ok, true);
});

ok("adding to the navigation changes nothing else at all", () => {
  const spec = withGallery();
  const before = JSON.parse(JSON.stringify(spec));
  const next = [...(spec as any).nav.items.slice(0, MAX_NAV_ITEMS - 1), "gallery"];
  const result = applyOps(spec, [{ op: "set_nav", items: next }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Sections, design, terminology, footer, seo — all untouched.
  assert.deepEqual(result.spec.sections, before.sections, "a nav change moved a section");
  assert.deepEqual(result.spec.design, before.design, "a nav change moved the design");
  assert.deepEqual((result.spec as any).terminology, before.terminology);
  assert.deepEqual(
    { ...(result.spec as any), nav: null },
    { ...before, nav: null },
    "something outside the navigation changed"
  );
});

ok("section ids stay unique and in order across a nav change", () => {
  const spec = withGallery();
  const idsBefore = spec.sections.map((s: any) => s.id);
  const next = [...(spec as any).nav.items.slice(0, MAX_NAV_ITEMS - 1), "gallery"];
  const result = applyOps(spec, [{ op: "set_nav", items: next }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const idsAfter = result.spec.sections.map((s: any) => s.id);
  assert.deepEqual(idsAfter, idsBefore);
  assert.equal(new Set(idsAfter).size, idsAfter.length, "duplicate section ids");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · what must still be refused, and said clearly
// ─────────────────────────────────────────────────────────────────────────────

ok("a section that does not exist is refused by name", () => {
  const result = applyOps(withGallery(), [{ op: "set_nav", items: ["services", "nowhere"] }]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "unapplicable");
  assert.match((result as any).message, /nowhere/, "the refusal does not name the missing section");
});

ok("the hero is still refused, and the refusal says which item and why", () => {
  const result = applyOps(withGallery(), [{ op: "set_nav", items: ["hero", "services"] }]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match((result as any).message, /hero/, "the refusal does not name the offending item");
  assert.match(
    (result as any).message,
    /top of the page|cannot be linked|not something the navigation/i,
    "the refusal does not explain why"
  );
});

ok("a booking strip is still refused", () => {
  const result = applyOps(withGallery(), [{ op: "set_nav", items: ["book-strip", "services"] }]);
  assert.equal(result.ok, false);
});

ok("more than four items is refused, and the refusal says the menu is full", () => {
  const spec = withGallery();
  const tooMany = spec.sections
    .filter((s: any) => s.type !== "hero" && s.type !== "bookingStrip")
    .map((s: any) => s.id)
    .slice(0, MAX_NAV_ITEMS + 1);
  assert.ok(tooMany.length > MAX_NAV_ITEMS, "fixture cannot produce an over-cap list");
  const result = applyOps(spec, [{ op: "set_nav", items: tooMany }]);
  assert.equal(result.ok, false, "an over-cap navigation was accepted");
  if (result.ok) return;
  const message =
    result.reason === "unapplicable"
      ? (result as any).message
      : JSON.stringify((result as any).issues);
  assert.match(
    message,
    new RegExp(`${MAX_NAV_ITEMS}|four|room|full`, "i"),
    `an over-cap refusal should say the menu only holds ${MAX_NAV_ITEMS}: got ${message}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · no new capability crept in
// ─────────────────────────────────────────────────────────────────────────────

ok("navigation still accepts section ids only — no path, URL or selector", () => {
  const attacks = [
    "/gallery",
    "https://example.com",
    "#gallery",
    ".nav-item",
    "<a href=x>",
    "javascript:alert(1)",
    "services?x=1"
  ];
  for (const value of attacks) {
    const result = applyOps(withGallery(), [{ op: "set_nav", items: [value] }]);
    assert.equal(result.ok, false, `navigation accepted ${JSON.stringify(value)}`);
  }
});

ok("the operation vocabulary is unchanged — set_nav is still the only nav write", () => {
  const spec = withGallery();
  // Nothing may write nav.items except set_nav.
  for (const op of ["set_copy", "set_layout", "set_presentation", "reorder_sections"]) {
    const before = JSON.stringify((spec as any).nav);
    const result = applyOps(spec, [{ op, sectionId: "services", layout: "wide" } as any]);
    if (result.ok) {
      assert.equal(JSON.stringify((result.spec as any).nav), before, `${op} altered the navigation`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
