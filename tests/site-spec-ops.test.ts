/**
 * Structured edit operations — the mutation layer, proved with hand-written
 * operations and no model anywhere near it.
 *
 *   npm run test:site-spec:ops
 *
 * This is deliberately the first thing built and the first thing tested in
 * Stage 2. If a model can only express change through these operations, then
 * whatever a model does is bounded by what is proved here.
 */
import assert from "node:assert/strict";

import { authorizeOps, checkCopyForOperationalFacts } from "@/lib/site-spec/authorize";
import { applyOps, describeOps, type SiteSpecOp } from "@/lib/site-spec/ops";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import {
  FADE_BUSINESS,
  FADE_SPEC,
  LENS_BUSINESS,
  LENS_SPEC,
  LUMI_BUSINESS,
  LUMI_SPEC
} from "@/tests/fixtures/site-spec";

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

const base = (): SiteSpec => {
  const parsed = validateSiteSpec(JSON.parse(JSON.stringify(FADE_SPEC)));
  assert.ok(parsed.ok, "the fixture must be valid to start from");
  return parsed.spec;
};

const applyOk = (spec: SiteSpec, ops: SiteSpecOp[]): SiteSpec => {
  const result = applyOps(spec, ops);
  assert.ok(result.ok, `expected the batch to apply, got ${JSON.stringify(result)}`);
  return (result as { ok: true; spec: SiteSpec }).spec;
};

const applyFails = (spec: SiteSpec, ops: unknown, label: string) => {
  const result = applyOps(spec, ops);
  assert.equal(result.ok, false, `${label}: expected the batch to be refused`);
  return result as Extract<ReturnType<typeof applyOps>, { ok: false }>;
};

const section = (spec: SiteSpec, id: string) => spec.sections.find((s) => s.id === id)!;

// ─────────────────────────────────────────────────────────────────────────────
// Purity and atomicity — the two properties everything else depends on
// ─────────────────────────────────────────────────────────────────────────────

ok("the same spec and the same operations always produce the same result", () => {
  const ops: SiteSpecOp[] = [
    { op: "set_copy", target: { field: "hero.headline" }, value: "A new headline." },
    { op: "set_token", path: "density", value: "spacious" },
    { op: "set_layout", sectionId: "services", layout: "wide" }
  ];
  const first = applyOk(base(), ops);
  const second = applyOk(base(), ops);
  assert.deepEqual(first, second, "applyOps is not deterministic");
});

ok("applying operations never mutates the spec it was given", () => {
  const original = base();
  const snapshot = JSON.stringify(original);
  applyOk(original, [{ op: "set_copy", target: { field: "hero.headline" }, value: "Changed." }]);
  assert.equal(JSON.stringify(original), snapshot, "the input spec was mutated in place");
});

ok("a batch is atomic — one bad operation discards the whole batch", () => {
  const spec = base();
  const result = applyFails(
    spec,
    [
      { op: "set_copy", target: { field: "hero.headline" }, value: "This one is fine." },
      { op: "set_layout", sectionId: "does-not-exist", layout: "wide" },
      { op: "set_token", path: "density", value: "spacious" }
    ],
    "mixed batch"
  );
  assert.equal(result.reason, "unapplicable");
  assert.equal((result as { opIndex: number }).opIndex, 1, "should name the operation that failed");
  // Nothing from the batch survived, including the operation before the failure.
  assert.equal((section(spec, "hero") as any).headline, "Sharp fades.\nBooked in seconds.");
  assert.equal(spec.design.density, "regular");
});

ok("the result of every accepted batch passes Stage 1 validation", () => {
  const spec = applyOk(base(), [
    { op: "set_token", path: "palette.accent", value: "#3355FF" },
    { op: "set_token", path: "palette.accentInk", value: "#FFFFFF" },
    { op: "reorder_sections", order: ["hero", "book-strip", "team", "services", "hours", "booking", "contact"] }
  ]);
  assert.ok(validateSiteSpec(spec).ok, "an accepted batch produced an invalid spec");
});

ok("a batch whose end state would be invalid is refused, not saved", () => {
  // Accent text that cannot be read on the accent — each op is individually
  // shaped correctly, but the resulting spec fails the contrast rule.
  const result = applyFails(
    base(),
    [{ op: "set_token", path: "palette.accentInk", value: "#E0A43C" }],
    "unreadable accent"
  );
  assert.equal(result.reason, "invalid_result");
  assert.ok(
    (result as { issues: Array<{ path: string }> }).issues.some((i) => i.path.includes("accentInk")),
    "the failure should name the offending field"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Every operation type
// ─────────────────────────────────────────────────────────────────────────────

ok("set_copy edits every copy target it claims to support", () => {
  const spec = applyOk(base(), [
    { op: "set_copy", target: { field: "hero.headline" }, value: "Line one.\nLine two." },
    { op: "set_copy", target: { field: "hero.eyebrow" }, value: "Since 2019" },
    { op: "set_copy", target: { field: "hero.body" }, value: "A short introduction." },
    { op: "set_copy", target: { field: "hero.primaryCta" }, value: "Reserve a chair" },
    { op: "set_copy", target: { field: "section.title", sectionId: "services" }, value: "What we do" },
    { op: "set_copy", target: { field: "section.sub", sectionId: "services" }, value: "Plain and simple." },
    { op: "set_copy", target: { field: "hours.note", sectionId: "hours" }, value: "Closed on public holidays." },
    { op: "set_copy", target: { field: "nav.cta" }, value: "Reserve" },
    { op: "set_copy", target: { field: "seo.title" }, value: "A new page title" }
  ]);

  const hero = section(spec, "hero") as any;
  assert.equal(hero.headline, "Line one.\nLine two.");
  assert.equal(hero.eyebrow, "Since 2019");
  assert.equal(hero.primaryCta.label, "Reserve a chair");
  assert.equal(section(spec, "services").heading.title, "What we do");
  assert.equal((section(spec, "hours") as any).note, "Closed on public holidays.");
  assert.equal(spec.nav.cta.label, "Reserve");
  assert.equal(spec.meta.seo.title, "A new page title");
});

ok("an empty value clears an optional field but is refused on a required one", () => {
  const cleared = applyOk(base(), [
    { op: "set_copy", target: { field: "hero.eyebrow" }, value: "" }
  ]);
  assert.equal((section(cleared, "hero") as any).eyebrow, undefined);

  const result = applyFails(
    base(),
    [{ op: "set_copy", target: { field: "hero.headline" }, value: "   " }],
    "empty headline"
  );
  assert.match((result as { message: string }).message, /cannot be empty/);
});

ok("set_token moves each family of bounded design token", () => {
  const spec = applyOk(base(), [
    { op: "set_token", path: "density", value: "compact" },
    { op: "set_token", path: "chrome.cta", value: "pill" },
    { op: "set_token", path: "art.treatment", value: "clean" },
    { op: "set_token", path: "geometry.radius", value: 18 },
    { op: "set_token", path: "typography.display", value: "serif" },
    { op: "set_token", path: "hero.height", value: 520 }
  ]);
  assert.equal(spec.design.density, "compact");
  assert.equal(spec.design.chrome.cta, "pill");
  assert.equal(spec.design.art.treatment, "clean");
  assert.equal(spec.design.geometry.radius, 18);
  assert.equal(spec.design.typography.display, "serif");
  assert.equal(spec.design.hero.height, 520);
});

ok("set_layout and set_presentation only accept values the section supports", () => {
  const spec = applyOk(base(), [
    { op: "set_layout", sectionId: "services", layout: "edge" },
    { op: "set_presentation", sectionId: "services", presentation: "cards" },
    { op: "set_presentation", sectionId: "hero", presentation: "split" }
  ]);
  assert.equal((section(spec, "services") as any).layout, "edge");
  assert.equal((section(spec, "services") as any).presentation, "cards");
  assert.equal((section(spec, "hero") as any).variant, "split");

  const wrong = applyFails(
    base(),
    [{ op: "set_presentation", sectionId: "services", presentation: "mosaic" }],
    "gallery presentation on a services section"
  );
  assert.match((wrong as { message: string }).message, /can be rows, cards, editorial, packages/);
});

ok("reorder_sections moves sections and preserves the schema's constraints", () => {
  const spec = applyOk(base(), [
    { op: "reorder_sections", order: ["hero", "book-strip", "team", "services", "hours", "booking", "contact"] }
  ]);
  assert.deepEqual(
    spec.sections.map((s) => s.id),
    ["hero", "book-strip", "team", "services", "hours", "booking", "contact"]
  );

  const partial = applyFails(
    base(),
    [{ op: "reorder_sections", order: ["hero", "services"] }],
    "partial order"
  );
  assert.match((partial as { message: string }).message, /every section exactly once/);

  const dropped = applyFails(
    base(),
    [{ op: "reorder_sections", order: ["services", "hero", "book-strip", "team", "hours", "booking", "booking"] }],
    "repeated section"
  );
  assert.ok((dropped as { message: string }).message.length > 0);

  // A reorder that puts something before the hero is refused by the validator.
  const heroMoved = applyFails(
    base(),
    [{ op: "reorder_sections", order: ["services", "hero", "book-strip", "team", "hours", "booking", "contact"] }],
    "hero not first"
  );
  assert.equal(heroMoved.reason, "invalid_result");
});

ok("add_section inserts a valid section and refuses a duplicate id", () => {
  const storySection = {
    id: "story",
    type: "story" as const,
    layout: "stack" as const,
    heading: { eyebrow: "Our story", title: "Twelve years behind the chair" },
    presentation: "column" as const,
    body: "We opened with two chairs and a waiting list.",
    stats: []
  };
  const spec = applyOk(base(), [{ op: "add_section", section: storySection as any, index: 3 }]);
  assert.equal(spec.sections[3].id, "story");
  assert.equal(spec.sections.length, 8);

  const duplicate = applyFails(
    spec,
    [{ op: "add_section", section: storySection as any }],
    "duplicate id"
  );
  assert.match((duplicate as { message: string }).message, /already exists/);
});

ok("a section can never be inserted before the hero", () => {
  const spec = applyOk(base(), [
    {
      op: "add_section",
      index: 0,
      section: {
        id: "story",
        type: "story",
        layout: "stack",
        heading: {},
        presentation: "column",
        body: "Something.",
        stats: []
      } as any
    }
  ]);
  assert.equal(spec.sections[0].id, "hero", "the hero must still open the page");
  assert.equal(spec.sections[1].id, "story");
});

ok("remove_section repairs navigation and call-to-action references", () => {
  const spec = applyOk(base(), [{ op: "remove_section", sectionId: "services" }]);
  assert.ok(!spec.sections.some((s) => s.id === "services"), "the section is gone");
  assert.ok(!spec.nav.items.includes("services"), "the nav item was left behind");

  // The hero's secondary CTA pointed at #services; it must have been retargeted.
  const hero = section(spec, "hero") as any;
  assert.notEqual(hero.secondaryCta.target.sectionId, "services");
  assert.ok(validateSiteSpec(spec).ok, "the repaired spec should be valid");
});

ok("removing the section a CTA depends on retargets rather than dangling", () => {
  const spec = applyOk(base(), [{ op: "remove_section", sectionId: "booking" }]);
  const validated = validateSiteSpec(spec);
  assert.ok(validated.ok, JSON.stringify(validated.ok ? [] : validated.issues));
});

ok("bind_asset pins an image by id, and unbind_asset returns it to generated art", () => {
  const assetId = "aaaaaaaa-1111-4111-8111-000000000001";
  const bound = applyOk(base(), [
    { op: "bind_asset", slot: { kind: "hero" }, assetId, alt: "Our shop front", fallbackSeed: 2 }
  ]);
  const media = (section(bound, "hero") as any).media;
  assert.equal(media.kind, "asset");
  assert.equal(media.assetId, assetId);
  assert.equal(media.alt, "Our shop front");
  assert.equal(media.fallbackSeed, 2, "a pinned asset must carry a fallback");

  const unbound = applyOk(bound, [{ op: "unbind_asset", slot: { kind: "hero" }, seed: 0 }]);
  assert.equal((section(unbound, "hero") as any).media.kind, "generated");
});

ok("binding into a gallery slot that does not exist is refused", () => {
  const lumi = validateSiteSpec(JSON.parse(JSON.stringify(LUMI_SPEC)));
  assert.ok(lumi.ok);
  const result = applyFails(
    lumi.spec,
    [
      {
        op: "bind_asset",
        slot: { kind: "gallery", index: 9 },
        assetId: "aaaaaaaa-1111-4111-8111-000000000001",
        alt: "A set",
        fallbackSeed: 0
      }
    ],
    "gallery index out of range"
  );
  assert.match((result as { message: string }).message, /no image at that position/);
});

ok("set_terminology, set_nav and set_footer change presentation vocabulary only", () => {
  const spec = applyOk(base(), [
    { op: "set_terminology", key: "primaryAction", value: "Reserve" },
    { op: "set_terminology", key: "services", value: "The list" },
    { op: "set_nav", items: ["services", "hours"] },
    { op: "set_footer", presentation: "minimal" }
  ]);
  assert.equal(spec.terminology.primaryAction, "Reserve");
  assert.equal(spec.terminology.services, "The list");
  assert.deepEqual(spec.nav.items, ["services", "hours"]);
  assert.equal(spec.footer.presentation, "minimal");

  const badNav = applyFails(base(), [{ op: "set_nav", items: ["hero"] }], "nav to the hero");
  assert.match((badNav as { message: string }).message, /not something the navigation can link to/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Invalid targets and malformed operations
// ─────────────────────────────────────────────────────────────────────────────

ok("an unknown operation name is refused before anything is applied", () => {
  const result = applyFails(base(), [{ op: "delete_everything" }], "unknown op");
  assert.equal(result.reason, "invalid_op");
});

ok("an operation naming a section that does not exist is refused", () => {
  for (const op of [
    { op: "set_layout", sectionId: "nowhere", layout: "wide" },
    { op: "set_presentation", sectionId: "nowhere", presentation: "cards" },
    { op: "remove_section", sectionId: "nowhere" },
    { op: "set_copy", target: { field: "section.title", sectionId: "nowhere" }, value: "x" }
  ]) {
    const result = applyFails(base(), [op], JSON.stringify(op.op));
    assert.equal(result.reason, "unapplicable");
  }
});

ok("there is no operation that accepts a free-form path", () => {
  // The model cannot say "set spec.design.palette.accent" — it must name a
  // token from the closed list. A path outside that list is refused by shape.
  const result = applyFails(
    base(),
    [{ op: "set_token", path: "meta.businessId", value: "anything" }],
    "arbitrary path"
  );
  assert.equal(result.reason, "invalid_op");
});

ok("a token value of the wrong kind is refused", () => {
  const enumResult = applyFails(
    base(),
    [{ op: "set_token", path: "density", value: "enormous" }],
    "unknown density"
  );
  assert.match((enumResult as { message: string }).message, /not a usable value/);

  const numeric = applyFails(
    base(),
    [{ op: "set_token", path: "geometry.radius", value: "18px" }],
    "css string as a number"
  );
  assert.match((numeric as { message: string }).message, /not a usable value/);
});

ok("out-of-range token values are caught by the Stage 1 validator", () => {
  const result = applyFails(
    base(),
    [{ op: "set_token", path: "geometry.sectionPad", value: 4000 }],
    "oversized padding"
  );
  assert.equal(result.reason, "invalid_result");
});

ok("copy cannot smuggle CSS, markup or a link into the spec as structure", () => {
  // It is stored as text and escaped at render time (proved in the renderer
  // suite). What matters here is that it never becomes structure.
  const spec = applyOk(base(), [
    { op: "set_copy", target: { field: "section.title", sectionId: "team" }, value: "<script>alert(1)</script>" }
  ]);
  assert.equal(section(spec, "team").heading.title, "<script>alert(1)</script>");
  assert.ok(validateSiteSpec(spec).ok, "it is text, so the spec is still valid");
});

// ─────────────────────────────────────────────────────────────────────────────
// Operational truth belongs to Business
// ─────────────────────────────────────────────────────────────────────────────

ok("a price that contradicts the business record is refused and routed", () => {
  const spec = base();
  // The canonical skin fade is €12.
  const ops: SiteSpecOp[] = [
    { op: "set_copy", target: { field: "hero.headline" }, value: "Haircuts from €4." }
  ];
  const decision = authorizeOps(ops, { spec, business: FADE_BUSINESS });
  assert.equal(decision.authorized.length, 0, "the edit should not be authorized");
  assert.equal(decision.rejected.length, 1);
  assert.equal(decision.rejected[0].reason, "operational_fact");
  assert.match(decision.rejected[0].message, /€4/);
  assert.match(decision.rejected[0].message, /Services in your Business settings/);
});

ok("a price that matches the business record is allowed, with a staleness warning", () => {
  const decision = authorizeOps(
    [{ op: "set_copy", target: { field: "hero.headline" }, value: "Skin fades from €12." }],
    { spec: base(), business: FADE_BUSINESS }
  );
  assert.equal(decision.authorized.length, 1, "a true price should be allowed");
  assert.equal(decision.warnings.length, 1);
  assert.equal(decision.warnings[0].kind, "stale_fact");
});

ok("durations, opening times and phone numbers are held to the same rule", () => {
  const spec = base();
  const cases: Array<[string, string]> = [
    ["Every cut takes 5 minutes.", "duration"],
    ["Open until 23:00 every night.", "opening time"],
    ["Call us on +383 44 000 000.", "phone number"]
  ];
  for (const [value, kind] of cases) {
    const decision = authorizeOps(
      [{ op: "set_copy", target: { field: "section.sub", sectionId: "services" }, value }],
      { spec, business: FADE_BUSINESS }
    );
    assert.equal(decision.rejected.length, 1, `"${value}" should be refused`);
    assert.match(decision.rejected[0].message, new RegExp(kind));
  }
});

ok("ordinary copy passes the operational-fact check untouched", () => {
  const spec = base();
  for (const value of [
    "Sharp fades, booked in seconds.",
    "No consultation fee, no upsell.",
    "Two minutes from the square.",
    "Four barbers, twelve years between them."
  ]) {
    const decision = authorizeOps(
      [{ op: "set_copy", target: { field: "section.sub", sectionId: "services" }, value }],
      { spec, business: FADE_BUSINESS }
    );
    assert.equal(decision.rejected.length, 0, `"${value}" should not be refused`);
  }
});

ok("the fact checker recognises canonical values for a different business", () => {
  // Lens & Light prices are "from €900" etc — a €900 claim is true for them and
  // false for the barbershop. The check is against the business, not a list.
  assert.equal(
    checkCopyForOperationalFacts("Weddings from €900.", LENS_BUSINESS, "en").verdict,
    "matches_canonical"
  );
  assert.equal(
    checkCopyForOperationalFacts("Weddings from €900.", FADE_BUSINESS, "en").verdict,
    "contradicts"
  );
});

ok("the hero cannot be removed through the authorization layer either", () => {
  const decision = authorizeOps([{ op: "remove_section", sectionId: "hero" }], {
    spec: base(),
    business: FADE_BUSINESS
  });
  assert.equal(decision.authorized.length, 0);
  assert.equal(decision.rejected[0].reason, "not_permitted");
});

ok("authorization refuses an unknown section before it reaches the applier", () => {
  const decision = authorizeOps([{ op: "set_layout", sectionId: "nowhere", layout: "wide" }], {
    spec: base(),
    business: FADE_BUSINESS
  });
  assert.equal(decision.rejected[0].reason, "unknown_target");
});

ok("a mixed batch authorizes the safe operations and refuses only the unsafe one", () => {
  const decision = authorizeOps(
    [
      { op: "set_token", path: "density", value: "spacious" },
      { op: "set_copy", target: { field: "hero.headline" }, value: "Cuts for €3." },
      { op: "set_layout", sectionId: "services", layout: "wide" }
    ],
    { spec: base(), business: FADE_BUSINESS }
  );
  assert.equal(decision.authorized.length, 2, "the safe operations should survive");
  assert.equal(decision.rejected.length, 1);
  assert.equal(decision.rejected[0].index, 1, "the rejection should say which operation");
});

// ─────────────────────────────────────────────────────────────────────────────
// "Make it feel more premium" — a broad request stays inside its lane
// ─────────────────────────────────────────────────────────────────────────────

ok("a broad style request cannot remove services, change prices, or publish", () => {
  const spec = base();
  const premium: SiteSpecOp[] = [
    { op: "set_token", path: "density", value: "spacious" },
    { op: "set_token", path: "typography.display", value: "serif-display" },
    { op: "set_token", path: "geometry.radius", value: 0 },
    { op: "set_presentation", sectionId: "services", presentation: "editorial" }
  ];
  const decision = authorizeOps(premium, { spec, business: FADE_BUSINESS });
  assert.equal(decision.rejected.length, 0);

  const next = applyOk(spec, decision.authorized);
  assert.equal(next.sections.length, spec.sections.length, "no section was removed");
  assert.deepEqual(
    (section(next, "services") as any).selection,
    (section(spec, "services") as any).selection,
    "the services shown were changed by a style request"
  );
  // There is no publish operation at all — the type system prevents it.
  assert.ok(!premium.some((op) => (op as { op: string }).op.includes("publish")));
});

ok("`put services above the gallery` is a reorder, not a regeneration", () => {
  const lumi = validateSiteSpec(JSON.parse(JSON.stringify(LUMI_SPEC)));
  assert.ok(lumi.ok);
  const before = lumi.spec.sections.map((s) => s.id);
  const reordered = applyOk(lumi.spec, [
    { op: "reorder_sections", order: ["hero", "services", "gallery", "booking", "hours", "contact"] }
  ]);
  const after = reordered.sections.map((s) => s.id);
  assert.deepEqual([...after].sort(), [...before].sort(), "a reorder must not add or drop sections");
  assert.ok(after.indexOf("services") < after.indexOf("gallery"));
  // Everything except order is untouched.
  assert.deepEqual(
    section(reordered, "services"),
    section(lumi.spec, "services"),
    "the section itself was rewritten instead of moved"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

ok("a change summary is derived from the operations, not from model prose", () => {
  assert.equal(
    describeOps([{ op: "set_copy", target: { field: "hero.headline" }, value: "x" }]),
    "Rewrote the headline"
  );
  assert.equal(describeOps([{ op: "reorder_sections", order: ["hero"] }]), "Reordered the page");
  assert.equal(
    describeOps([{ op: "set_token", path: "palette.background", value: "#000000" }]),
    "Changed the background colour"
  );
  assert.match(
    describeOps([
      { op: "set_copy", target: { field: "hero.headline" }, value: "x" },
      { op: "set_copy", target: { field: "hero.body" }, value: "y" }
    ]),
    /2 pieces of copy/
  );
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
