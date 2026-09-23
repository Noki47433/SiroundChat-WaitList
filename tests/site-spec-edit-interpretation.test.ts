/**
 * Stage 3G.1 — the five interpretation fixes, pinned.
 *   npx tsx tests/site-spec-edit-interpretation.test.ts
 *
 * Written before any model rehearsal, from the Stage 3G failure clusters:
 *
 *   A  operations that cannot be mapped reach the bounded repair instead of
 *      silence (five sites answered "I'm not sure what to change there" to a
 *      request the model had understood, because the repair never ran)
 *   B  presentation and layout are distinguished, and a section's own values are
 *      named, in the instructions the model reads
 *   C  a claim the owner makes about their own business may be written; one put
 *      in a third party's mouth may not
 *   D  terminology does not rewrite existing button labels, and the context says so
 *   E  the "shorter" guard covers button labels, not just headlines and section text
 */
import assert from "node:assert/strict";

import { emptyModelUsage } from "@/lib/site-spec/ai/client";
import { describeSpecForEditing, EDIT_SYSTEM_PROMPT, type ModelEditOp } from "@/lib/site-spec/ai/edit";
import { runEdit } from "@/lib/site-spec/ai/session";
import { type SiteSpec } from "@/lib/site-spec/schema";
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
  return spec;
};

const setup = async (spec: SiteSpec = fixture()) => {
  const db = new FakeSiteDb();
  const siteId = "55555555-1111-4111-8111-000000000001";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "interp" });
  const seeded = await saveDraftSpec(db, siteId, spec, { source: "generated" });
  assert.ok(seeded.ok, JSON.stringify(seeded).slice(0, 300));
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;
  return { db, siteId, base };
};

// ── A · a dropped operation is repaired, not swallowed ────────────────────────

/** What the model sent in Stage 3G: a per-image caption with no index. */
const CAPTION_WITHOUT_INDEX: ModelEditOp = {
  op: "set_copy", field: "gallery.caption", sectionId: "gallery", index: null, value: "Our work, up close"
} as ModelEditOp;

ok("A · operations that cannot be mapped go to the repair, with what was wrong", async () => {
  const context = await setup();
  const seen: string[] = [];
  let call = 0;
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Give the gallery a line of text under its heading", expectedParentVersionId: context.base.id,
    interpret: async (input) => {
      seen.push(input.message);
      call += 1;
      if (call === 1) {
        return { ok: true as const, ops: [], understanding: "add a caption", dropped: 1, droppedOps: [CAPTION_WITHOUT_INDEX], attempts: 1, usage: emptyModelUsage() };
      }
      return {
        ok: true as const,
        ops: [{ op: "set_copy" as const, target: { field: "section.sub" as const, sectionId: "gallery" }, value: "A closer look at our work" }],
        understanding: "a line under the gallery heading", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage()
      };
    }
  });
  assert.equal(call, 2, "an all-dropped interpretation never reached the repair");
  assert.match(seen[1], /gallery\.caption needs "index"/);
  assert.match(seen[1], /section\.sub/);
  assert.equal(outcome.changed, true, outcome.reply);
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: true });
  assert.equal(context.db.versions.length, 2);
});

ok("A · when the repair cannot fix it either, the owner is told plainly and nothing is written", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Give the gallery a line of text under its heading", expectedParentVersionId: context.base.id,
    interpret: async () => ({ ok: true as const, ops: [], understanding: "add a caption", dropped: 1, droppedOps: [CAPTION_WITHOUT_INDEX], attempts: 1, usage: emptyModelUsage() })
  });
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1);
  assert.match(outcome.reply, /not sure what to change/);
  assert.equal(outcome.diagnostics?.detail, "dropped 1 operation(s)");
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: false });
});

ok("A · a genuinely empty interpretation still does not spend a repair", async () => {
  const context = await setup();
  let call = 0;
  await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "asdfghjkl", expectedParentVersionId: context.base.id,
    interpret: async () => { call += 1; return { ok: true as const, ops: [], understanding: "nothing", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage() }; }
  });
  assert.equal(call, 1);
});

// ── B · presentation is not layout ────────────────────────────────────────────

/**
 * Stage 3G.2 amended this rule. It used to end "— never a set_layout", which was
 * one direction only, and suite #3 found the other one: "side by side" is a
 * layout, and the one-way rule sent it to a presentation. The distinction itself
 * is what this test pins; the both-directions wording is pinned in
 * tests/site-spec-edit-mechanisms.test.ts.
 */
ok("B · the instructions distinguish presentation from layout and point at the section's own values", () => {
  const flat = EDIT_SYSTEM_PROMPT.replace(/\s+/g, " ");
  assert.match(flat, /PRESENTATION and LAYOUT are different things/);
  assert.match(flat, /If it is one of the values listed after "can be" for that section, it is a set_presentation/);
  assert.match(flat, /"Show the hours as columns" is set_presentation "cols"/);
  const described = describeSpecForEditing(fixture(), []);
  assert.match(described, /hours \(hours, .*can be strip \| card \| cols\)/);
});

// ── C · whose claim is it ─────────────────────────────────────────────────────

ok("C · the owner's own claims are allowed; invented ones and third-party words are not", () => {
  const flat = EDIT_SYSTEM_PROMPT.replace(/\s+/g, " ");
  assert.match(flat, /a fact the owner states about their OWN business is theirs to state/i);
  assert.match(flat, /Never INVENT a fact to fill space/);
  assert.match(flat, /A testimonial or review from a named customer is not yours to write/);
  // operational truth is untouched by this change
  assert.match(flat, /A request to change a price, a duration, an opening time, an address or a phone number is\s+NOT a website change/);
  assert.match(flat, /Never put a price, duration, opening time, address or phone number into any copy/);
});

// ── D · terminology is not a button label ─────────────────────────────────────

ok("D · the context says terminology does not rewrite an existing button label", () => {
  const described = describeSpecForEditing(fixture(), []);
  assert.match(described, /Terminology is the word the site uses where it generates one; it does NOT rewrite a button label that already exists/);
  assert.match(described, /use set_copy on the field named here/);
  assert.match(described, /hero\.primaryCta = /);
  assert.match(described, /nav\.cta = /);
});

// ── E · "shorter" covers button labels ────────────────────────────────────────

const shorterEdit = async (field: "hero.primaryCta" | "nav.cta", values: string[]) => {
  const context = await setup();
  const seen: string[] = [];
  let call = 0;
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Make the button at the top shorter", expectedParentVersionId: context.base.id,
    interpret: async (input) => {
      seen.push(input.message);
      const value = values[Math.min(call, values.length - 1)];
      call += 1;
      return {
        ok: true as const,
        ops: [{ op: "set_copy" as const, target: { field } as any, value }],
        understanding: "shorten the button", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage()
      };
    }
  });
  return { context, outcome, seen };
};

ok("E · a button label that came back longer is repaired with the real counts", async () => {
  const current = (fixture().sections[0] as any).primaryCta.label as string;
  const { context, outcome, seen } = await shorterEdit("hero.primaryCta", [current + " today", "Go"]);
  assert.equal(seen.length, 2, "the button length miss never reached the repair");
  assert.match(seen[1], new RegExp(`button label to be SHORTER. It is ${current.length} characters now`));
  assert.equal(outcome.changed, true);
  assert.equal((outcome.spec!.sections[0] as any).primaryCta.label, "Go");
  assert.equal(context.db.versions.length, 2);
});

ok("E · a button label still not shorter after the repair is refused, and nothing is written", async () => {
  const current = (fixture().sections[0] as any).primaryCta.label as string;
  const { context, outcome } = await shorterEdit("hero.primaryCta", [current + "!", current + "!!"]);
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1);
  assert.match(outcome.reply, /couldn't find a shorter button label/);
});

ok("E · the menu button is covered too", async () => {
  // The fixture's menu button is already "Book"; give it something to shorten.
  const spec = fixture();
  spec.nav.cta.label = "Book with us";
  const context = await setup(spec);
  let call = 0;
  const seen: string[] = [];
  const outcome = await runEdit({
    supabase: context.db, siteId: context.siteId, spec: context.base.spec, business: FADE_BUSINESS,
    message: "Make the menu button shorter", expectedParentVersionId: context.base.id,
    interpret: async (input) => {
      seen.push(input.message);
      const value = call === 0 ? "Book with us today" : "Book";
      call += 1;
      return {
        ok: true as const,
        ops: [{ op: "set_copy" as const, target: { field: "nav.cta" as const }, value }],
        understanding: "shorten the menu button", dropped: 0, droppedOps: [], attempts: 1, usage: emptyModelUsage()
      };
    }
  });
  assert.equal(seen.length, 2, "the menu button is not covered by the length check");
  assert.match(seen[1], /button label to be SHORTER. It is 12 characters now/);
  assert.equal(outcome.changed, true);
  assert.equal(outcome.spec!.nav.cta.label, "Book");
});

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
});
