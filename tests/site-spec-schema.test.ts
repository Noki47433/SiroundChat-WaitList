/**
 * Site Spec contract — what the validator accepts and what it refuses.
 *   npx tsx tests/site-spec-schema.test.ts
 *
 * The renderer is written assuming a spec it is handed is already coherent, so
 * everything that assumption depends on has to be proved here.
 */
import assert from "node:assert/strict";

import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { FIXTURES, FADE_SPEC } from "@/tests/fixtures/site-spec";

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

/** Deep clone so each case starts from a known-good spec. */
const clone = (): any => JSON.parse(JSON.stringify(FADE_SPEC));

/** Assert a spec is refused, and that the refusal names the field responsible. */
const rejects = (spec: unknown, pathFragment: string, label: string) => {
  const result = validateSiteSpec(spec);
  assert.equal(result.ok, false, `${label}: expected rejection, got acceptance`);
  if (result.ok) return;
  const matched = result.issues.some((issue) => issue.path.includes(pathFragment));
  assert.ok(
    matched,
    `${label}: expected an issue on "${pathFragment}", got ${JSON.stringify(result.issues)}`
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Acceptance
// ─────────────────────────────────────────────────────────────────────────────

ok("all four approved fixtures validate", () => {
  for (const fixture of FIXTURES) {
    const result = validateSiteSpec(fixture.spec);
    assert.ok(
      result.ok,
      `${fixture.label} should validate, got ${JSON.stringify(result.ok ? [] : result.issues)}`
    );
  }
});

ok("validation is idempotent — a parsed spec revalidates unchanged", () => {
  const first = validateSiteSpec(FADE_SPEC);
  assert.ok(first.ok);
  const second = validateSiteSpec((first as { ok: true; spec: SiteSpec }).spec);
  assert.ok(second.ok);
  assert.deepEqual(
    (second as { ok: true; spec: SiteSpec }).spec,
    (first as { ok: true; spec: SiteSpec }).spec
  );
});

ok("defaults are applied rather than demanded", () => {
  const spec = clone();
  delete spec.design.density;
  delete spec.sections[2].showPrices;
  const result = validateSiteSpec(spec);
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  assert.equal(result.spec.design.density, "regular");
  assert.equal((result.spec.sections[2] as any).showPrices, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Shape and required fields
// ─────────────────────────────────────────────────────────────────────────────

ok("a non-object, the wrong kind and the wrong version are all refused", () => {
  assert.equal(validateSiteSpec(null).ok, false);
  assert.equal(validateSiteSpec("site_spec").ok, false);
  rejects({ ...clone(), kind: "integrated_template" }, "kind", "wrong kind");
  rejects({ ...clone(), version: 2 }, "version", "wrong version");
});

ok("a missing required field is refused", () => {
  const spec = clone();
  delete spec.meta.seo.title;
  rejects(spec, "title", "missing seo title");

  const noPalette = clone();
  delete noPalette.design.palette.accent;
  rejects(noPalette, "accent", "missing accent");
});

ok("a spec with no sections is refused", () => {
  const spec = clone();
  spec.sections = [];
  rejects(spec, "sections", "empty sections");
});

// ─────────────────────────────────────────────────────────────────────────────
// Enums and bounded tokens
// ─────────────────────────────────────────────────────────────────────────────

ok("an unknown section type is refused", () => {
  const spec = clone();
  spec.sections[2].type = "pricing-table";
  rejects(spec, "sections", "unknown section type");
});

ok("an unknown layout, presentation, treatment or chrome value is refused", () => {
  const layout = clone();
  layout.sections[2].layout = "diagonal";
  rejects(layout, "layout", "unknown layout");

  const presentation = clone();
  presentation.sections[2].presentation = "carousel";
  rejects(presentation, "presentation", "unknown services presentation");

  const treatment = clone();
  treatment.design.art.treatment = "vaporwave";
  rejects(treatment, "treatment", "unknown art treatment");

  const nav = clone();
  nav.design.chrome.nav = "floating";
  rejects(nav, "nav", "unknown nav shape");
});

ok("a gallery presentation cannot be borrowed by a services section", () => {
  const spec = clone();
  spec.sections[2].presentation = "mosaic";
  rejects(spec, "presentation", "cross-type presentation");
});

ok("a font is an id, never a font-family string", () => {
  const spec = clone();
  spec.design.typography.display = "Comic Sans MS, cursive";
  rejects(spec, "display", "raw font stack");
});

ok("out-of-bounds geometry is refused", () => {
  const big = clone();
  big.design.geometry.sectionPad = 4000;
  rejects(big, "sectionPad", "oversized padding");

  const negative = clone();
  negative.design.geometry.radius = -8;
  rejects(negative, "radius", "negative radius");

  const nan = clone();
  nan.design.geometry.gap = "26px";
  rejects(nan, "gap", "geometry as a CSS string");
});

ok("a colour must be hex — no rgb(), no var(), no keyword", () => {
  for (const value of ["rgb(0,0,0)", "var(--x)", "black", "#12345", "red; }"]) {
    const spec = clone();
    spec.design.palette.accent = value;
    rejects(spec, "accent", `colour "${value}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────────────────────

ok("only https links survive", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "//example.com",
    "not a url"
  ]) {
    const spec = clone();
    spec.socials = [{ label: "Link", url }];
    rejects(spec, "url", `url "${url}"`);
  }

  const good = clone();
  good.socials = [{ label: "Link", url: "https://example.com/x" }];
  assert.ok(validateSiteSpec(good).ok);
});

ok("an external CTA is held to the same link rule", () => {
  const spec = clone();
  spec.nav.cta = { label: "Book", target: { kind: "external", url: "javascript:alert(1)" } };
  rejects(spec, "url", "javascript CTA");
});

ok("control characters are refused in copy", () => {
  const spec = clone();
  spec.sections[0].headline = "Sharp fades\u0000booked";
  rejects(spec, "headline", "NUL in a headline");
});

ok("markup in copy is data, not a validation error — the renderer escapes it", () => {
  // Rejecting angle brackets would break legitimate copy ("Open 9<->5"). The
  // guarantee is that it is escaped at render time, which the renderer test
  // proves; here we only assert it does not smuggle past as a special case.
  const spec = clone();
  spec.sections[0].headline = "<script>alert(1)</script>";
  const result = validateSiteSpec(spec);
  assert.ok(result.ok, "markup in copy should validate as ordinary text");
});

// ─────────────────────────────────────────────────────────────────────────────
// Section ids, ordering, references
// ─────────────────────────────────────────────────────────────────────────────

ok("duplicate section ids are refused", () => {
  const spec = clone();
  spec.sections[3].id = spec.sections[2].id;
  rejects(spec, "id", "duplicate section id");
});

ok("a section id must be a usable anchor", () => {
  const spec = clone();
  spec.sections[2].id = "Our Services!";
  rejects(spec, "id", "unsafe section id");
});

ok("exactly one hero, and it opens the page", () => {
  const none = clone();
  none.sections.shift();
  rejects(none, "sections", "no hero");

  const two = clone();
  two.sections.push({ ...two.sections[0], id: "hero-two" });
  rejects(two, "sections", "two heroes");

  const late = clone();
  const [hero, ...rest] = late.sections;
  late.sections = [...rest, hero];
  rejects(late, "sections", "hero not first");
});

ok("singleton sections cannot be duplicated", () => {
  const spec = clone();
  spec.sections.push({ ...spec.sections[4], id: "hours-two" });
  rejects(spec, "sections", "two hours sections");
});

ok("a CTA cannot target a section that does not exist", () => {
  const spec = clone();
  spec.sections[0].secondaryCta.target = { kind: "section", sectionId: "nowhere" };
  rejects(spec, "target", "dangling CTA target");
});

ok("a CTA cannot target an enquiry form the site does not have", () => {
  const spec = clone();
  spec.nav.cta.target = { kind: "enquiry" };
  rejects(spec, "target", "enquiry CTA without an enquiry section");
});

ok("nav items must point at real, navigable sections", () => {
  const missing = clone();
  missing.nav.items = ["nowhere"];
  rejects(missing, "items", "nav to unknown section");

  const hero = clone();
  hero.nav.items = ["hero"];
  rejects(hero, "items", "nav to the hero");
});

// ─────────────────────────────────────────────────────────────────────────────
// Business-fact references
// ─────────────────────────────────────────────────────────────────────────────

ok("a row-scoped fact reference requires an id, and a global one refuses it", () => {
  const missingId = clone();
  missingId.sections[2].heading.title = { ref: "service.price" };
  rejects(missingId, "title", "service.price without an id");

  const spuriousId = clone();
  spuriousId.sections[6].heading.title = {
    ref: "location.address",
    id: "11111111-1111-4111-8111-111111111111"
  };
  rejects(spuriousId, "title", "location.address with an id");
});

ok("an unknown reference kind is refused", () => {
  const spec = clone();
  spec.sections[2].heading.title = { ref: "business.revenue" };
  rejects(spec, "title", "unknown fact ref");
});

// ─────────────────────────────────────────────────────────────────────────────
// Unsupported combinations
// ─────────────────────────────────────────────────────────────────────────────

ok("a gallery must fill its grid exactly", () => {
  const spec: any = JSON.parse(JSON.stringify(FIXTURES[1].spec));
  spec.sections[1].items.pop();
  rejects(spec, "items", "mosaic with five tiles");

  const captions: any = JSON.parse(JSON.stringify(FIXTURES[3].spec));
  captions.sections[1].captions.pop();
  rejects(captions, "captions", "captions not one per tile");
});

ok("`flush` is refused where the composition cannot survive it", () => {
  const spec = clone();
  spec.sections[4].layout = "flush";
  rejects(spec, "layout", "flush hours section");
});

ok("a reviews list cannot be empty — that is what `empty` is for", () => {
  const spec: any = JSON.parse(JSON.stringify(FIXTURES[2].spec));
  spec.sections[5].presentation = "list";
  rejects(spec, "items", "empty reviews list");
});

ok("the hero and booking strip carry no layout — they compose from their own variant", () => {
  const spec: any = clone();
  spec.sections[0].layout = "split";
  spec.sections[1].layout = "centered";
  const result = validateSiteSpec(spec);
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  // A field the renderer ignores must not survive into the stored spec, or the
  // owner is told a choice was recorded that changes nothing.
  assert.ok(!("layout" in result.spec.sections[0]), "hero should have no layout");
  assert.ok(!("layout" in result.spec.sections[1]), "booking strip should have no layout");
});

ok("an enquiry form must be able to reach somebody", () => {
  const noReply: any = JSON.parse(JSON.stringify(FIXTURES[3].spec));
  noReply.sections[4].fields = [
    { name: "name", label: "Your name", required: true },
    { name: "message", label: "Message", required: true }
  ];
  rejects(noReply, "fields", "no email or phone field");

  const noMessage: any = JSON.parse(JSON.stringify(FIXTURES[3].spec));
  noMessage.sections[4].fields = [
    { name: "name", label: "Your name", required: true },
    { name: "email", label: "Email", required: true }
  ];
  rejects(noMessage, "fields", "no message field");

  const duplicate: any = JSON.parse(JSON.stringify(FIXTURES[3].spec));
  duplicate.sections[4].fields.push({ name: "name", label: "Again", required: false });
  rejects(duplicate, "fields", "duplicate field");
});

// ─────────────────────────────────────────────────────────────────────────────
// Contrast
// ─────────────────────────────────────────────────────────────────────────────

ok("unreadable colour pairings are refused", () => {
  const onAccent = clone();
  onAccent.design.palette.accentInk = "#E0A43C";
  rejects(onAccent, "accentInk", "accent text on the same accent");

  const bodyText = clone();
  bodyText.design.palette.ink = "#0A0A0C";
  rejects(bodyText, "ink", "near-black body text on a near-black page");
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
