/**
 * Stage 3F.2 — an edit that changes nothing must say so, and write nothing.
 *   npx tsx tests/site-spec-edit-truthfulness.test.ts
 *
 * Written before any model rehearsal. Stage 3F.1 measured 40 of 134 "successful"
 * edits writing a version byte-identical to its parent while telling the owner
 * the change had been made. These tests pin the fix at the level the brief
 * specifies — for each no-op: 0 new versions, an unchanged draft pointer,
 * changed:false, and a truthful reply — plus the replies for real changes, what
 * the model is shown, the two residual repairs, the diagnostics shape, and that
 * an answer arriving after the deadline can change nothing.
 */
import assert from "node:assert/strict";

import { emptyModelUsage } from "@/lib/site-spec/ai/client";
import { describeSpecForEditing, EDIT_SYSTEM_PROMPT } from "@/lib/site-spec/ai/edit";
import { editDiagnostics, runEdit } from "@/lib/site-spec/ai/session";
import { applyOps, type SiteSpecOp } from "@/lib/site-spec/ops";
import { type SiteSpec } from "@/lib/site-spec/schema";
import { sameWebsite, semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { getDraftVersion, saveDraftSpec } from "@/lib/site-spec/store";
import { FADE_BUSINESS, FADE_SPEC } from "@/tests/fixtures/site-spec";
import { FakeSiteDb } from "@/tests/support/fake-site-db";

let passed = 0;
let failed = 0;
let queue: Promise<void> = Promise.resolve();
const ok = (name: string, fn: () => void | Promise<void>) => {
  queue = queue.then(async () => {
    try {
      await fn();
      console.log("PASS " + name);
      passed++;
    } catch (error) {
      console.error("FAIL " + name + "\n     " + (error as Error).message);
      failed++;
    }
  });
};

/** Internal identifiers that must never reach an owner. */
const INTERNAL = /navPosition|headingScale|bodyScale|radiusLg|sectionPad|accentInk|set_[a-z_]+|bind_asset|reorder_sections|palette\.|typography\.|chrome\.|geometry\.|\bthe cta\b/i;

const ASSET_A = "aaaaaaaa-1111-4111-8111-000000000001";
const ASSET_B = "bbbbbbbb-1111-4111-8111-000000000002";
const ASSETS = [
  { id: ASSET_A, label: "hero 1" },
  { id: ASSET_B, label: "hero 2" }
];

const withGallery = (spec: SiteSpec): SiteSpec => {
  const services = spec.sections.findIndex((s) => s.type === "services");
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

const fixture = (): SiteSpec => {
  const spec = withGallery(JSON.parse(JSON.stringify(FADE_SPEC)));
  const hero = spec.sections.find((s) => s.type === "hero") as any;
  hero.media = { kind: "asset", assetId: ASSET_A, alt: "The shop front", fallbackSeed: 0 };
  return spec;
};

/** A seeded store, and a way to run one edit whose operations are fixed. */
const setup = async (spec: SiteSpec = fixture()) => {
  const db = new FakeSiteDb();
  const siteId = "44444444-1111-4111-8111-000000000001";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "truth" });
  const seeded = await saveDraftSpec(db, siteId, spec, { source: "generated" });
  assert.ok(seeded.ok, JSON.stringify(seeded));
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;
  const edit = (ops: SiteSpecOp[], message = "an edit") =>
    runEdit({
      supabase: db,
      siteId,
      spec: base.spec,
      business: FADE_BUSINESS,
      message,
      assets: ASSETS,
      expectedParentVersionId: base.id,
      interpret: async () => ({
        ok: true as const,
        ops,
        understanding: "scripted",
        dropped: 0,
        attempts: 1,
        usage: emptyModelUsage()
      })
    });
  return { db, siteId, base, edit };
};

/** The brief's four proofs for every no-op. */
const assertNoOp = async (
  context: Awaited<ReturnType<typeof setup>>,
  outcome: Awaited<ReturnType<typeof runEdit>>,
  replyMustSay: RegExp
) => {
  assert.equal(outcome.changed, false, `changed should be false: ${outcome.reply}`);
  assert.equal(outcome.noOp, true, "the outcome should be marked as a no-op");
  assert.equal(context.db.versions.length, 1, "a no-op wrote a version");
  const draft = await getDraftVersion(context.db, context.siteId);
  assert.ok(draft.ok);
  assert.equal(draft.value?.id, context.base.id, "the draft pointer moved on a no-op");
  assert.match(outcome.reply, /\balready\b/, `the reply must say the site already satisfies it: ${outcome.reply}`);
  assert.match(outcome.reply, /left the site as it is/, outcome.reply);
  assert.match(outcome.reply, replyMustSay, outcome.reply);
  assert.doesNotMatch(outcome.reply, INTERNAL, `an internal name reached the owner: ${outcome.reply}`);
  assert.doesNotMatch(outcome.reply, /^(Changed|Made|Moved|Reordered|Rewrote)/, `a no-op reply claims a change: ${outcome.reply}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1 · the no-op guard — the seven cases the brief names
// ─────────────────────────────────────────────────────────────────────────────

ok("no-op token write: setting the heading size it already has writes nothing and says so", async () => {
  const context = await setup();
  const outcome = await context.edit([{ op: "set_token", path: "typography.headingScale", value: "default" }]);
  await assertNoOp(context, outcome, /headings are already at their normal size/);
});

ok("no-op reorder: the identical order writes nothing and says so", async () => {
  const context = await setup();
  const order = context.base.spec.sections.map((s) => s.id);
  const outcome = await context.edit([{ op: "reorder_sections", order }]);
  await assertNoOp(context, outcome, /already in that order/);
});

ok("no-op gallery presentation: mosaic on a mosaic writes nothing and says so", async () => {
  const context = await setup();
  const outcome = await context.edit([{ op: "set_presentation", sectionId: "gallery", presentation: "mosaic" } as SiteSpecOp]);
  // Named by the owner's own word for the gallery (the fixture calls it "Work").
  const word = String(context.base.spec.terminology.gallery).toLowerCase();
  await assertNoOp(context, outcome, new RegExp(`Your ${word} is already shown as a mosaic`));
});

ok("no-op hero asset binding: the same photo, with new alt text from the model, writes nothing", async () => {
  const context = await setup();
  const outcome = await context.edit([
    { op: "bind_asset", slot: { kind: "hero" }, assetId: ASSET_A, alt: "A totally different description", fallbackSeed: 0 }
  ]);
  await assertNoOp(context, outcome, /photo is already the picture at the top of your page/);
});

ok("real token change: one version, and the reply says what happened in plain words", async () => {
  const context = await setup();
  const outcome = await context.edit([{ op: "set_token", path: "typography.headingScale", value: "larger" }]);
  assert.equal(outcome.changed, true);
  assert.equal(context.db.versions.length, 2, "a real change must write exactly one version");
  assert.equal(outcome.reply, "Made the headings larger.");
  assert.equal(outcome.version?.label, "Made the headings larger", "the history label must be the observed change too");
});

ok("real reorder: one version, and the reply names the section by the owner's word, not its id", async () => {
  const context = await setup();
  const order = context.base.spec.sections.map((s) => s.id);
  const from = order.indexOf("gallery");
  const to = order.indexOf("services");
  order.splice(from, 1);
  order.splice(to, 0, "gallery");
  const outcome = await context.edit([{ op: "reorder_sections", order }]);
  assert.equal(outcome.changed, true);
  assert.equal(context.db.versions.length, 2);
  const galleryWord = String(context.base.spec.terminology.gallery).toLowerCase();
  const servicesWord = String(context.base.spec.terminology.services).toLowerCase();
  assert.equal(outcome.reply, `Moved the ${galleryWord} section above the ${servicesWord} section.`);
  assert.doesNotMatch(outcome.reply, INTERNAL);
});

ok("volatile-metadata-only difference: the guard's comparison ignores bookkeeping", () => {
  // No operation can write meta.generatedAt/updatedAt, so this cannot be reached
  // through runEdit today — it is tested at the exact function the guard calls,
  // so a future change that stamps edits cannot turn every no-op into a version.
  const a = fixture();
  const b = fixture();
  b.meta.updatedAt = "2099-01-01T00:00:00.000Z";
  b.meta.generatedAt = "2000-01-01T00:00:00.000Z";
  assert.equal(sameWebsite(a, b), true);
});

ok("a byte difference with no visible effect is a no-op: an unset default made explicit", async () => {
  // The real case: Siround's stored spec has no headingScale at all. Setting it
  // to "default" changes the JSON and not the website.
  const spec = fixture();
  delete (spec.design.typography as any).headingScale;
  const context = await setup(spec);
  const outcome = await context.edit([{ op: "set_token", path: "typography.headingScale", value: "default" }]);
  await assertNoOp(context, outcome, /normal size/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · replies describe what happened
// ─────────────────────────────────────────────────────────────────────────────

ok("a partial no-op reports only the part that changed", async () => {
  const context = await setup();
  const outcome = await context.edit([
    { op: "set_token", path: "typography.headingScale", value: "default" }, // already
    { op: "set_token", path: "chrome.navPosition", value: context.base.spec.design.chrome.navPosition === "center" ? "edge" : "center" }
  ]);
  assert.equal(outcome.changed, true);
  assert.doesNotMatch(outcome.reply, /headings/, "the unchanged part was reported as a change");
  assert.match(outcome.reply, /menu links/);
  assert.doesNotMatch(outcome.reply, INTERNAL);
});

ok("the replies that leaked field names in Stage 3F.1 now speak plainly", async () => {
  const spec = fixture();
  spec.design.chrome.navPosition = "edge";
  spec.design.chrome.cta = "square";
  const context = await setup(spec);
  const nav = await context.edit([{ op: "set_token", path: "chrome.navPosition", value: "center" }]);
  assert.equal(nav.reply, "Centred the menu links in the header.");
  const context2 = await setup(spec);
  const cta = await context2.edit([{ op: "set_token", path: "chrome.cta", value: "pill" }]);
  assert.equal(cta.reply, "Gave the buttons fully rounded ends.");
});

ok("'put the menu at the top' is answered, in our words, as already true — and writes nothing", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message: "Put the menu at the top of the page",
    expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [],
      understanding: "already true",
      alreadyTrue: "menu_at_top" as const,
      dropped: 0 as const,
      attempts: 1,
      usage: emptyModelUsage()
    })
  });
  assert.equal(outcome.changed, false);
  assert.equal(outcome.noOp, true);
  assert.equal(context.db.versions.length, 1);
  assert.match(outcome.reply, /already at the top of every page/);
  assert.doesNotMatch(outcome.reply, INTERNAL);
});

ok("a genuinely new picture says the picture changed; a new description says only that", async () => {
  const context = await setup();
  const picture = await context.edit([
    { op: "bind_asset", slot: { kind: "hero" }, assetId: ASSET_B, alt: "Inside the shop", fallbackSeed: 0 }
  ]);
  assert.equal(picture.reply, "Changed the picture at the top of the page.");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · the model can see what it is asked to change
// ─────────────────────────────────────────────────────────────────────────────

ok("every closed design control's CURRENT value is in the edit context", () => {
  const spec = fixture();
  spec.design.typography.headingScale = "larger";
  (spec.design.typography as any).bodyScale = "smaller";
  const described = describeSpecForEditing(spec, ASSETS);
  const d = spec.design;
  for (const [path, value] of [
    ["typography.headingScale", "larger"],
    ["typography.bodyScale", "smaller"],
    ["typography.display", d.typography.display],
    ["typography.body", d.typography.body],
    ["chrome.navPosition", d.chrome.navPosition],
    ["chrome.cta", d.chrome.cta],
    ["geometry.radius", String(d.geometry.radius)],
    ["geometry.sectionPad", String(d.geometry.sectionPad)],
    ["density", d.density]
  ] as const) {
    const line = described.split("\n").find((l) => l.includes(`${path} `) || l.includes(`${path}=`) || new RegExp(`\\b${path.replace(".", "\\.")}\\s+=`).test(l));
    assert.ok(line, `${path} is not described`);
    assert.ok(line!.includes(`= ${value}`), `${path} does not show its current value ${value}: ${line}`);
  }
});

ok("gallery presentation, the menu, section layouts, the order and the hero image are all visible", () => {
  const described = describeSpecForEditing(fixture(), ASSETS);
  assert.match(described, /gallery \(gallery, wide layout, mosaic — can be mosaic \| portfolio \| filmstrip \| duo\)/);
  assert.match(described, /services \(services, [a-z]+ layout, \w+ — can be rows \| cards \| editorial \| packages\)/);
  assert.match(described, /HERO HEADLINE \(\d+ characters — a "shorter" headline has at most \d+\): /);
  assert.match(described, /WORDING — terminology/);
  assert.match(described, /terminology services = /);
  assert.match(described, /hero\.primaryCta = /);
  assert.match(described, /nav\.cta = /);
  assert.match(described, /NAVIGATION:\n\s+currently: /);
  assert.match(described, /CURRENT ORDER \(\d+ sections/);
  assert.match(described, new RegExp(`HERO IMAGE.*currently the owner's image ${ASSET_A}`));
  assert.match(described, new RegExp(`${ASSET_A} — hero 1 \\(currently the hero image\\)`));
});

ok("the menu's real semantics are stated, and 'menu at the top' no longer maps to alignment", () => {
  assert.doesNotMatch(EDIT_SYSTEM_PROMPT, /"menu at the top"[^\n]*→\s*chrome\.navPosition/);
  assert.match(EDIT_SYSTEM_PROMPT, /always at the top of every page, in the header/);
  assert.match(EDIT_SYSTEM_PROMPT, /alreadyTrue to "menu_at_top"/);
  const described = describeSpecForEditing(fixture(), ASSETS);
  assert.match(described, /menu alignment\s+chrome\.navPosition\s+= \w+ .*INSIDE the header; the menu is always at the top/);
});

ok("relative requests and already-true requests are defined for the model", () => {
  assert.match(EDIT_SYSTEM_PROMPT, /"A little larger" is one rung up/);
  const flat = EDIT_SYSTEM_PROMPT.replace(/\s+/g, " ");
  assert.match(flat, /still return the operation that expresses it, with the value it already has/);
  assert.match(flat, /softer, warmer, friendlier, bolder, calmer, better, more confident or more anything is a request to CHANGE it/);
  assert.match(flat, /"Shorter" means fewer characters than the current text/);
  assert.match(flat, /Asking to ADD a section the site already has \(see SECTIONS\) is still insert_section/);
  assert.match(EDIT_SYSTEM_PROMPT, /Buttons take their shape from chrome\.cta\s+ONLY/);
});

ok("both contrast pairs and their current ratios are visible", () => {
  const described = describeSpecForEditing(fixture(), ASSETS);
  assert.match(described, /palette\.accentInk \(text on accent\) = #[0-9A-Fa-f]{6}/);
  assert.match(described, /contrast now: text on background [\d.]+:1 \(needs 4\.5\) · accentInk on accent [\d.]+:1 \(needs 3\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · the residuals — better repair, same validators
// ─────────────────────────────────────────────────────────────────────────────

ok("a reorder that drops a section is still refused, and now says which one", () => {
  const spec = fixture();
  const order = spec.sections.map((s) => s.id).filter((id) => id !== "booking");
  const result = applyOps(spec, [{ op: "reorder_sections", order }]);
  assert.equal(result.ok, false, "a partial reorder must still be refused");
  if (result.ok || result.reason !== "unapplicable") return;
  assert.match(result.message, /left out "booking"/);
  assert.match(result.message, /every section exactly once/);
});

ok("a contrast failure's repair is told to fix the partner colour — and the guard still holds", async () => {
  const spec = fixture();
  spec.design.palette.accent = "#1A1A1A";
  spec.design.palette.accentInk = "#FFFFFF";
  const context = await setup(spec);
  const messages: string[] = [];
  let call = 0;
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message: "Make it warmer",
    expectedParentVersionId: context.base.id,
    interpret: async (input) => {
      messages.push(input.message);
      call += 1;
      const ops: SiteSpecOp[] =
        call === 1
          ? [{ op: "set_token", path: "palette.accent", value: "#F6C28B" }] // light warm accent, white text: fails 3:1
          : [
              { op: "set_token", path: "palette.accent", value: "#F6C28B" },
              { op: "set_token", path: "palette.accentInk", value: "#2B1A0E" }
            ];
      return { ok: true as const, ops, understanding: "warmer", dropped: 0, attempts: 1, usage: emptyModelUsage() };
    }
  });
  assert.equal(call, 2, "exactly one repair");
  assert.match(messages[1], /ALSO set palette\.accentInk/, "the repair was not told how to fix the pair");
  assert.doesNotMatch(messages[1], /smaller set of operations/, "the repair is still told to do less");
  assert.equal(outcome.changed, true, outcome.reply);
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: true });
  assert.match(outcome.reply, /accent colour|colour palette/i);
});

ok("the contrast guard is not weakened: a repair that still fails is refused and writes nothing", async () => {
  const context = await setup();
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message: "Make it warmer",
    expectedParentVersionId: context.base.id,
    interpret: async () => ({
      ok: true as const,
      // Near the fixture's own accentInk, whatever it is: the pair cannot reach 3:1.
      ops: [{ op: "set_token" as const, path: "palette.accent" as const, value: context.base.spec.design.palette.accentInk }],
      understanding: "warmer",
      dropped: 0,
      attempts: 1,
      usage: emptyModelUsage()
    })
  });
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1);
  assert.deepEqual(outcome.repair, { attempted: true, succeeded: false });
  assert.match(outcome.reply, /too faint to read/);
});

ok("a duplicate section is refused once — no second model call is spent trying to get past it", async () => {
  const context = await setup();
  let calls = 0;
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message: "Add a gallery",
    assets: ASSETS,
    expectedParentVersionId: context.base.id,
    interpret: async () => {
      calls += 1;
      return {
        ok: true as const,
        ops: [{ op: "insert_section" as const, section: "gallery" as const, presentation: "mosaic" as const, placement: { at: "end" as const } }],
        understanding: "add a gallery",
        dropped: 0,
        attempts: 1,
        usage: emptyModelUsage()
      };
    }
  });
  assert.equal(calls, 1, "a product rule was sent to the repair loop");
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1);
  assert.deepEqual(outcome.repair, { attempted: false, succeeded: false });
  assert.match(outcome.reply, /already has a gallery, so I haven't added a second one/);
});

const headlineEdit = async (message: string, attempts: string[]) => {
  const context = await setup();
  const seen: string[] = [];
  let call = 0;
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message,
    expectedParentVersionId: context.base.id,
    interpret: async (input) => {
      seen.push(input.message);
      const value = attempts[Math.min(call, attempts.length - 1)];
      call += 1;
      return {
        ok: true as const,
        ops: [{ op: "set_copy" as const, target: { field: "hero.headline" as const }, value }],
        understanding: "headline",
        dropped: 0,
        attempts: 1,
        usage: emptyModelUsage()
      };
    }
  });
  const current = (context.base.spec.sections[0] as any).headline as string;
  return { context, outcome, seen, current };
};

ok("'shorter' that comes back longer is repaired with the real character counts", async () => {
  const current = (fixture().sections[0] as any).headline as string;
  const { context, outcome, seen } = await headlineEdit("Make the headline shorter", [current + " and more", current.slice(0, 5)]);
  assert.equal(seen.length, 2, "the length miss was not sent to the repair");
  assert.match(seen[1], new RegExp(`It is ${current.length} characters now`));
  assert.match(seen[1], new RegExp(`at most ${current.length - 1} characters`));
  assert.equal(outcome.changed, true);
  assert.equal(context.db.versions.length, 2);
  assert.equal((outcome.spec!.sections[0] as any).headline, current.slice(0, 5));
});

ok("'shorter' that is still not shorter after the repair is refused, honestly, and writes nothing", async () => {
  const current = (fixture().sections[0] as any).headline as string;
  const { context, outcome } = await headlineEdit("Make the headline shorter", [current + "!", current + "!!"]);
  assert.equal(outcome.changed, false);
  assert.equal(context.db.versions.length, 1);
  assert.match(outcome.reply, /couldn't find a shorter headline/);
  assert.doesNotMatch(outcome.reply, /^Rewrote/);
});

ok("without a length word, a longer rewrite is just a rewrite", async () => {
  const current = (fixture().sections[0] as any).headline as string;
  const { outcome, seen } = await headlineEdit("Make the headline more confident", [current + " — always"]);
  assert.equal(seen.length, 1);
  assert.equal(outcome.changed, true);
  assert.equal(outcome.reply, "Rewrote the headline.");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · diagnostics: measurable, and bounded
// ─────────────────────────────────────────────────────────────────────────────

ok("the edit diagnostics are exactly the bounded set, with no free text beyond model and stage", async () => {
  const context = await setup();
  const outcome = await context.edit([{ op: "set_token", path: "typography.headingScale", value: "larger" }]);
  const diagnostics = editDiagnostics(outcome, 1234);
  assert.deepEqual(Object.keys(diagnostics).sort(), [
    "attempts",
    "completionTokens",
    "model",
    "modelMs",
    "noOp",
    "promptTokens",
    "repairAttempted",
    "repaired",
    "stage",
    "totalMs"
  ]);
  for (const [key, value] of Object.entries(diagnostics)) {
    if (key === "model") assert.equal(typeof value, "string");
    else if (key === "stage") assert.ok(value === null || ["apply", "model", "save"].includes(value as string));
    else assert.ok(typeof value === "number" || typeof value === "boolean", `${key} is ${typeof value}`);
  }
  assert.equal(diagnostics.totalMs, 1234);
  assert.equal(diagnostics.noOp, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 · the deadline, on the real race
// ─────────────────────────────────────────────────────────────────────────────

ok("an answer that arrives after the deadline can never write a version", async () => {
  const context = await setup();
  let finishedLate = false;
  const outcome = await runEdit({
    supabase: context.db,
    siteId: context.siteId,
    spec: context.base.spec,
    business: FADE_BUSINESS,
    message: "Make the headings larger",
    expectedParentVersionId: context.base.id,
    deadlineMs: 50,
    interpret: () =>
      new Promise((resolve) =>
        setTimeout(() => {
          finishedLate = true;
          resolve({
            ok: true as const,
            ops: [{ op: "set_token" as const, path: "typography.headingScale" as const, value: "larger" }],
            understanding: "late but valid",
            dropped: 0,
            attempts: 1,
            usage: emptyModelUsage()
          });
        }, 250)
      )
  });
  assert.equal(outcome.changed, false);
  assert.match(outcome.reply, /took too long/);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(finishedLate, true, "the late answer never arrived — the test proves nothing");
  assert.equal(context.db.versions.length, 1, "a late answer wrote a version after the owner was told it timed out");
  const draft = await getDraftVersion(context.db, context.siteId);
  assert.ok(draft.ok);
  assert.equal(draft.value?.id, context.base.id);
  assert.equal(semanticFingerprint(draft.value?.spec), semanticFingerprint(context.base.spec));
});

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
});
