/**
 * Stage 3G.3 — the mechanisms that survived, pinned.
 *   npx tsx tests/site-spec-edit-mechanisms.test.ts
 *
 * Written before Suite #4 ran, from the Stage 3G.1 clusters — but deliberately
 * NOT from its phrasings. Each test pins the mechanism, not the sentence that
 * exposed it:
 *
 *   1  a writable control cannot be invisible: the editing context is derived
 *      from TOKEN_PATHS, and a test fails if a token is writable without one
 *   2  the model states, in a closed vocabulary, what will be observably true;
 *      the code checks it, repairs once, then refuses and saves nothing — and
 *      "already_satisfied" is one of the things it can state, because Stage 3G.2
 *      refused four correct no-ops for promising movement that a no-op cannot
 *      deliver
 *   4  a field that can be asserted must be a field an operation can write: the
 *      footer note, and every other copy target, derived from one list
 *   3  gallery items and captions move together, before validation — the
 *      validator is not loosened
 *   5  "side by side" is a layout and "as columns" is a presentation, and the
 *      instructions say both directions
 */
import assert from "node:assert/strict";

import { emptyModelUsage } from "@/lib/site-spec/ai/client";
import {
  describeSpecForEditing,
  EDIT_SYSTEM_PROMPT,
  readToken,
  toExpectation,
  type ModelExpectation
} from "@/lib/site-spec/ai/edit";
import { runEdit } from "@/lib/site-spec/ai/session";
import {
  checkExpectations,
  isWritableTextField,
  summariseExpectationFailures,
  describeExpectationFailures,
  type Expectation
} from "@/lib/site-spec/expectations";
import { applyOps, CopyTargetSchema, TOKEN_PATHS } from "@/lib/site-spec/ops";
import { SiteSpecSchema, type SiteSpec } from "@/lib/site-spec/schema";
import { saveDraftSpec } from "@/lib/site-spec/store";
import { FADE_BUSINESS, FADE_SPEC } from "@/tests/fixtures/site-spec";
import { FakeSiteDb } from "@/tests/support/fake-site-db";

let passed = 0;
let failed = 0;
let queue: Promise<void> = Promise.resolve();
const ok = (name: string, fn: () => void | Promise<void>) => {
  queue = queue.then(async () => {
    try { await fn(); console.log("PASS " + name); passed++; }
    catch (error) { console.error("FAIL " + name + "\n     " + (error as Error).message); failed++; }
  });
};

const fixture = (): SiteSpec => {
  const spec: SiteSpec = JSON.parse(JSON.stringify(FADE_SPEC));
  const at = spec.sections.findIndex((s) => s.type === "services");
  spec.sections.splice(at + 1, 0, {
    id: "gallery", type: "gallery", layout: "wide", presentation: "mosaic",
    heading: { title: "Gallery" },
    items: Array.from({ length: 6 }, (_, i) => ({ kind: "generated", seed: i })),
    captions: [], framing: {}
  } as any);
  // The fixture's services section already sits in "split"; these tests need a
  // layout that "side by side" would genuinely have to reach.
  (spec.sections.find((s) => s.id === "services") as any).layout = "stack";
  return spec;
};

const setup = async (spec: SiteSpec = fixture()) => {
  const db = new FakeSiteDb();
  const siteId = "55555555-1111-4111-8111-000000000002";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "mech" });
  const seeded = await saveDraftSpec(db, siteId, spec, { source: "generated" });
  assert.ok(seeded.ok, JSON.stringify(seeded).slice(0, 300));
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;
  return { db, siteId, base };
};

// ── 1 · no writable control is invisible ──────────────────────────────────────

ok("1 · every writable token appears in the editing context, by path and by value", () => {
  const spec = fixture();
  const described = describeSpecForEditing(spec, []);
  const missing = TOKEN_PATHS.filter((path) => !described.includes(path));
  assert.deepEqual(
    missing, [],
    "these tokens can be written but the model is never shown them: " + missing.join(", ")
  );
});

ok("1 · the context shows each token's CURRENT value, so a relative request has a start", () => {
  const spec = fixture();
  const described = describeSpecForEditing(spec, []);
  for (const path of TOKEN_PATHS) {
    const value = readToken(spec, path);
    if (value === undefined || value === null) continue;
    const line = described.split("\n").find((row) => row.includes(path));
    assert.ok(line, `no line for ${path}`);
    assert.ok(
      line!.includes(String(value)),
      `${path} is listed without its current value (${String(value)})`
    );
  }
});

ok("1 · the weights and tracking that Stage 3G.1 could not reach are among them", () => {
  const described = describeSpecForEditing(fixture(), []);
  for (const path of ["typography.displayWeight", "typography.heroWeight", "typography.tracking", "typography.measure"]) {
    assert.ok(described.includes(path), `${path} is still invisible`);
  }
});

// ── 2 · the model says what will be true, and the code checks it ──────────────

const applyToken = (spec: SiteSpec, path: string, value: string) => {
  const result = applyOps(spec, [{ op: "set_token", path, value } as any], { assets: [] });
  assert.ok(result.ok, "fixture op did not apply");
  return (result as { ok: true; spec: SiteSpec }).spec;
};

ok("2 · a claim that came true holds, and one that did not is reported with what was observed", () => {
  const before = fixture();
  const after = applyToken(before, "chrome.cta", "pill");
  const held: Expectation[] = [{ check: "token_equals", path: "chrome.cta" as any, value: "pill" }];
  assert.deepEqual(checkExpectations(held, before, after), []);

  const broken: Expectation[] = [{ check: "token_equals", path: "chrome.cta" as any, value: "square" }];
  const failures = checkExpectations(broken, before, after);
  assert.equal(failures.length, 1);
  assert.match(failures[0].observed, /chrome\.cta is pill/);
});

ok("2 · the layout/presentation confusion is caught by the check, not by a keyword", () => {
  const before = fixture();
  // What Stage 3G.1 observed: the model moved the presentation and said "split".
  const moved = applyOps(before, [{ op: "set_presentation", sectionId: "services", presentation: "cards" } as any], { assets: [] });
  assert.ok(moved.ok);
  const after = (moved as { ok: true; spec: SiteSpec }).spec;
  const failures = checkExpectations([{ check: "section_layout", sectionId: "services", layout: "split" }], before, after);
  assert.equal(failures.length, 1);
  assert.match(failures[0].observed, /services layout is/);
});

ok("2 · a failed claim is repaired once, and the repaired edit is what gets saved", async () => {
  const context = await setup();
  let call = 0;
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Put the services section side by side", expectedParentVersionId: context.base.id,
    interpret: async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: true as const,
          ops: [{ op: "set_presentation" as const, sectionId: "services", presentation: "cards" }],
          understanding: "side by side", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage(),
          expectations: [{ check: "section_layout", sectionId: "services", layout: "split" }] as Expectation[]
        };
      }
      return {
        ok: true as const,
        ops: [{ op: "set_layout" as const, sectionId: "services", layout: "split" }],
        understanding: "side by side", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage(),
        expectations: [{ check: "section_layout", sectionId: "services", layout: "split" }] as Expectation[]
      };
    }
  });
  assert.equal(call, 2, "a broken expectation never reached the repair");
  assert.equal(outcome.changed, true, outcome.reply);
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: true });
  assert.equal(context.db.versions.length, 2, "the repaired edit should be the only version written");
  const saved = SiteSpecSchema.parse(context.db.versions[1].spec);
  assert.equal((saved.sections.find((s) => s.id === "services") as any).layout, "split");
});

ok("2 · a claim that fails twice is refused truthfully, and nothing is written", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Put the services section side by side", expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [{ op: "set_presentation" as const, sectionId: "services", presentation: "cards" }],
      understanding: "side by side", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage(),
      expectations: [{ check: "section_layout", sectionId: "services", layout: "split" }] as Expectation[]
    })
  });
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1, "a failed expectation must not write a version");
  assert.match(outcome.reply, /left the site as it was/);
  assert.doesNotMatch(outcome.reply, /expectation|section_layout|split/i, "the owner is not shown the machinery");
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: false });
  assert.equal(outcome.expectations?.stated, 1);
  assert.ok((outcome.expectations?.failed ?? 0) >= 1);
});

ok("2 · an edit that states nothing behaves exactly as before", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Make the buttons rounder", expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [{ op: "set_token" as const, path: "chrome.cta" as const, value: "pill" }],
      understanding: "rounder buttons", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage()
    })
  });
  assert.equal(outcome.changed, true, outcome.reply);
  assert.equal(outcome.expectations?.stated, 0);
  assert.deepEqual(outcome.repair, { attempted: false, succeeded: false });
});

ok("2 · diagnostics carry the shape of the failure, never the owner's words", () => {
  const failures = [
    { expectation: { check: "text_on_page", words: "we are a family-run business since 1998" } as Expectation, observed: "not on the page" },
    { expectation: { check: "section_layout", sectionId: "services", layout: "split" } as Expectation, observed: "services layout is wide" }
  ];
  const summary = summariseExpectationFailures(failures);
  assert.doesNotMatch(summary, /family-run|1998/, "owner copy leaked into the log line");
  assert.match(summary, /text_on_page/);
  assert.match(summary, /section_layout\(services\)/);
  // the model, by contrast, is told exactly what it claimed and what was seen
  assert.match(describeExpectationFailures(failures), /services layout is wide/);
});

const RAW = {
  check: "token_equals", path: null, sectionId: null, otherSectionId: null, layout: null,
  presentation: null, field: null, words: null, value: null, count: null, where: null, key: null
} satisfies ModelExpectation;

ok("2 · the flat model row becomes a typed expectation only when it is complete", () => {
  assert.deepEqual(
    toExpectation({ ...RAW, check: "token_equals", path: "chrome.cta", value: "pill" } as ModelExpectation),
    { check: "token_equals", path: "chrome.cta", value: "pill" }
  );
  assert.equal(toExpectation({ ...RAW, check: "token_equals", path: "chrome.cta" } as ModelExpectation), null, "no value, no check");
  assert.equal(toExpectation({ ...RAW, check: "section_layout", layout: "split" } as ModelExpectation), null, "no section, no check");
  assert.deepEqual(
    toExpectation({ ...RAW, check: "text_shorter", field: "hero.headline" } as ModelExpectation),
    { check: "text_shorter", what: { field: "hero.headline" } }
  );
  assert.equal(toExpectation({ ...RAW, check: "text_shorter", field: "section.title" } as ModelExpectation), null, "a section field needs its section");
  assert.deepEqual(
    toExpectation({ ...RAW, check: "text_shorter", field: "section.title", sectionId: "services" } as ModelExpectation),
    { check: "text_shorter", what: { field: "section.title", sectionId: "services" } }
  );
  assert.equal(toExpectation({ ...RAW, check: "text_on_page", words: "   " } as ModelExpectation), null, "empty words claim nothing");
  assert.deepEqual(toExpectation({ ...RAW, check: "gallery_every_photo_captioned" } as ModelExpectation), { check: "gallery_every_photo_captioned" });
});

ok("2 · a dropped claim is simply not checked — it can never widen what an edit may do", () => {
  const before = fixture();
  const after = applyToken(before, "chrome.cta", "pill");
  // an incomplete row maps to nothing, so there is no expectation to satisfy
  assert.equal(toExpectation({ ...RAW, check: "section_layout", layout: "split" } as ModelExpectation), null);
  assert.deepEqual(checkExpectations([], before, after), []);
});


// ── 2b · a no-op is not a broken promise ──────────────────────────────────────

ok("2 · a movement claim is not failed by a site that correctly did not move", () => {
  const spec = fixture();
  // The already-true rule asks for the operation with the CURRENT value, so the
  // site does not move. Stage 3G.2 called that a broken promise and refused.
  const claims: Expectation[] = [
    { check: "token_increases", path: "geometry.rule" as any },
    { check: "text_changed", what: { field: "hero.headline" } },
    { check: "section_layout", sectionId: "services", layout: "split" }
  ];
  assert.deepEqual(checkExpectations(claims, spec, spec), [], "nothing moved, so nothing was promised about movement");
});

ok("2 · already_satisfied holds when the site stayed, and fails when it moved", () => {
  const spec = fixture();
  const moved = applyToken(spec, "chrome.cta", "pill");
  assert.deepEqual(checkExpectations([{ check: "already_satisfied" }], spec, spec), []);
  const failures = checkExpectations([{ check: "already_satisfied" }], spec, moved);
  assert.equal(failures.length, 1);
  assert.match(failures[0].observed, /the site changed/);
});

ok("2 · the already-true path still writes nothing and still answers truthfully", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Keep the menu pinned at the top of the page", expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const, ops: [], understanding: "the menu is always at the top",
      alreadyTrue: "menu_at_top" as const, dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage(),
      expectations: [{ check: "already_satisfied" }] as Expectation[]
    })
  });
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1, "an already-true answer must not write a version");
  assert.match(outcome.reply, /already/i);
  assert.equal(outcome.expectations?.failed, 0);
});

ok("2 · an edit that proposes the value the site already has is a no-op, not a refusal", async () => {
  const context = await setup();
  const current = (context.base.spec.sections.find((s) => s.id === "services") as any).layout;
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Put the services heading above its list", expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [{ op: "set_layout" as const, sectionId: "services", layout: current }],
      understanding: "already like that", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage(),
      // the model claims movement; the site correctly does not move
      expectations: [{ check: "section_layout", sectionId: "services", layout: current }] as Expectation[]
    })
  });
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1, "a no-op must not write a version");
  assert.deepEqual(outcome.repair, { attempted: false, succeeded: false }, "a no-op must not spend a repair");
  assert.doesNotMatch(outcome.reply, /couldn't make that change come out the way you asked/);
});

// ── 4 · a field that can be asserted is a field that can be written ───────────

ok("4 · the footer note is writable, and survives the validator", () => {
  const before = fixture();
  const written = applyOps(before, [
    { op: "set_copy", target: { field: "footer.note" }, value: "Free parking behind the building." } as any
  ], { assets: [] });
  assert.ok(written.ok, "the footer note should be writable: " + JSON.stringify(written).slice(0, 140));
  const after = (written as { ok: true; spec: SiteSpec }).spec;
  assert.equal(after.footer?.note, "Free parking behind the building.");
  SiteSpecSchema.parse(after);
  assert.deepEqual(checkExpectations([{ check: "text_changed", what: { field: "footer.note" } }], before, after), []);
});

ok("4 · every copy field the model may name is one an operation can write", () => {
  const writable = new Set(
    (CopyTargetSchema.options as any[]).map((option) => option.shape.field.value as string)
  );
  const described = describeSpecForEditing(fixture(), []);
  for (const field of writable) {
    assert.ok(described.includes(field), `${field} can be written but the model is never shown it`);
    assert.ok(isWritableTextField(field));
  }
  // and the reverse: a claim about a field nothing can write is dropped
  assert.equal(isWritableTextField("footer.subtitle"), false);
  assert.equal(
    toExpectation({ ...RAW, check: "text_changed", field: "footer.subtitle" } as any),
    null,
    "a claim about an unwritable field must not be checkable"
  );
});

// ── 3 · items and captions move together ──────────────────────────────────────

const gallery = (spec: SiteSpec) => spec.sections.find((s) => s.type === "gallery") as any;

ok("3 · a captioned gallery can still change presentation — the Stage 3G.1 dead end", () => {
  const spec = fixture();
  const captioned = applyOps(spec, [
    { op: "set_copy", target: { field: "gallery.caption", sectionId: "gallery", index: 0 }, value: "Our work, up close" } as any
  ], { assets: [] });
  assert.ok(captioned.ok, "captioning one photo should work");
  const withCaption = (captioned as { ok: true; spec: SiteSpec }).spec;
  assert.equal(gallery(withCaption).captions.length, 6, "a caption pads to one per item");

  const changed = applyOps(withCaption, [
    { op: "set_presentation", sectionId: "gallery", presentation: "portfolio" } as any
  ], { assets: [] });
  assert.ok(changed.ok, "the presentation change was refused: " + JSON.stringify(changed).slice(0, 160));
  const after = (changed as { ok: true; spec: SiteSpec }).spec;
  assert.equal(gallery(after).items.length, 5);
  assert.equal(gallery(after).captions.length, 5, "captions must follow the tiles");
  assert.equal(gallery(after).captions[0], "Our work, up close", "the caption stays with its own photo");
  SiteSpecSchema.parse(after);
});

ok("3 · growing the gallery leaves the new tile uncaptioned, and the rest in place", () => {
  const spec = fixture();
  const small = applyOps(spec, [{ op: "set_presentation", sectionId: "gallery", presentation: "duo" } as any], { assets: [] });
  assert.ok(small.ok);
  const captioned = applyOps((small as any).spec, [
    { op: "set_copy", target: { field: "gallery.caption", sectionId: "gallery", index: 1 }, value: "The chair by the window" } as any
  ], { assets: [] });
  assert.ok(captioned.ok);
  const grown = applyOps((captioned as any).spec, [{ op: "set_presentation", sectionId: "gallery", presentation: "mosaic" } as any], { assets: [] });
  assert.ok(grown.ok, JSON.stringify(grown).slice(0, 160));
  const after = (grown as { ok: true; spec: SiteSpec }).spec;
  assert.equal(gallery(after).items.length, 6);
  assert.equal(gallery(after).captions.length, 6);
  assert.equal(gallery(after).captions[1], "The chair by the window");
  assert.equal(gallery(after).captions[5], "");
  SiteSpecSchema.parse(after);
});

ok("3 · an uncaptioned gallery still carries no captions at all", () => {
  const changed = applyOps(fixture(), [{ op: "set_presentation", sectionId: "gallery", presentation: "filmstrip" } as any], { assets: [] });
  assert.ok(changed.ok);
  assert.deepEqual(gallery((changed as any).spec).captions, []);
});

ok("3 · the validator is exactly as strict as it was", () => {
  const spec = fixture();
  const broken = JSON.parse(JSON.stringify(spec));
  broken.sections.find((s: any) => s.type === "gallery").captions = ["a", "b"];
  const parsed = SiteSpecSchema.safeParse(broken);
  assert.equal(parsed.success, false, "two captions against six items must still be refused");
});

// ── 5 · side by side is a layout; as columns is a presentation ────────────────

ok("5 · the instructions map the owner's layout words, both directions", () => {
  const flat = EDIT_SYSTEM_PROMPT.replace(/\s+/g, " ");
  assert.match(flat, /"side by side" \/ "beside each other" \/ "the heading next to the text" → split/);
  assert.match(flat, /"Put the services side by side" is set_layout "split", even though a services section also has presentations/);
  assert.match(flat, /"Show the hours as columns" is set_presentation "cols"/);
  assert.match(flat, /Say which of the two you did in EXPECTATIONS/);
});

ok("5 · both directions actually apply, and each is checkable", () => {
  const spec = fixture();
  const split = applyOps(spec, [{ op: "set_layout", sectionId: "services", layout: "split" } as any], { assets: [] });
  assert.ok(split.ok);
  assert.deepEqual(
    checkExpectations([{ check: "section_layout", sectionId: "services", layout: "split" }], spec, (split as any).spec),
    []
  );
  const cols = applyOps(spec, [{ op: "set_presentation", sectionId: "hours", presentation: "cols" } as any], { assets: [] });
  assert.ok(cols.ok, JSON.stringify(cols).slice(0, 160));
  assert.deepEqual(
    checkExpectations([{ check: "section_presentation", sectionId: "hours", presentation: "cols" }], spec, (cols as any).spec),
    []
  );
});

ok("5 · the sections block still lists each section's own presentations and its layout", () => {
  const described = describeSpecForEditing(fixture(), []);
  assert.match(described, /hours \(hours, .*can be strip \| card \| cols\)/);
  assert.match(described, /gallery \(gallery, .*can be mosaic \| portfolio \| filmstrip \| duo\)/);
});

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
