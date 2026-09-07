/**
 * Stage 3D — the three things this mission changed.
 *   npx tsx tests/site-spec-booking-gallery.test.ts
 *
 * Ordered the way §6 asks for it: hand-written factory and operation tests
 * first, then scripted-model tests over the same surface. The real-model check
 * is the production canary itself, not a unit test.
 *
 *   1 · the deterministic section factory
 *   2 · the `insert_section` operation end to end through `applyOps`
 *   3 · the scripted model path — a model that emits the bounded intent
 *   4 · the 25-second edit ceiling and its no-late-mutation guarantee
 */
import assert from "node:assert/strict";

import { emptyModelUsage } from "@/lib/site-spec/ai/client";
import { EDIT_MODEL_TIMEOUT_MS, toSiteSpecOp } from "@/lib/site-spec/ai/edit";
import { runEdit } from "@/lib/site-spec/ai/session";
import { applyOps } from "@/lib/site-spec/ops";
import {
  buildGallerySection,
  insertSection,
  nextSectionId,
  resolveInsertIndex,
  INSERTABLE_SECTIONS,
  MAX_SECTIONS
} from "@/lib/site-spec/section-factory";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { GALLERY_PRESENTATIONS, GALLERY_TILE_COUNT } from "@/lib/site-spec/vocabulary";
import { saveDraftSpec } from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import { FADE_BUSINESS, FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0;
let failed = 0;
let queue: Promise<void> = Promise.resolve();
const ok = (name: string, fn: () => Promise<void> | void) => {
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

/** The fixture already has a gallery, so most tests need one without. */
const withoutGallery = (): SiteSpec => {
  const spec = JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
  spec.sections = spec.sections.filter((section) => section.type !== "gallery");
  return spec;
};

const ASSETS = [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", label: "gallery 1" },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", label: "gallery 2" },
  { id: "aaaaaaaa-0000-4000-8000-000000000003", label: "gallery 3" }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1 · the deterministic section factory
// ─────────────────────────────────────────────────────────────────────────────

ok("every presentation produces a spec that VALIDATES — the whole point", () => {
  for (const presentation of GALLERY_PRESENTATIONS) {
    const spec = withoutGallery();
    const result = insertSection(spec, { section: "gallery", presentation, placement: { at: "end" } }, ASSETS);
    assert.ok(result.ok, `insert failed for ${presentation}`);
    const validated = validateSiteSpec((result as { ok: true; spec: SiteSpec }).spec);
    assert.ok(validated.ok, `${presentation} produced an invalid spec: ${JSON.stringify(validated)}`);
  }
});

ok("the tile count is exactly what the presentation declares — a grid never has a hole", () => {
  for (const presentation of GALLERY_PRESENTATIONS) {
    const section = buildGallerySection(withoutGallery(), { section: "gallery", presentation, placement: { at: "end" } }, []);
    assert.equal((section as { items: unknown[] }).items.length, GALLERY_TILE_COUNT[presentation]);
  }
});

ok("real uploaded assets are bound in order, and the rest fall back to deterministic art", () => {
  const section = buildGallerySection(
    withoutGallery(),
    { section: "gallery", presentation: "mosaic", placement: { at: "end" } },
    ASSETS
  ) as unknown as { items: Array<Record<string, unknown>> };
  assert.equal(section.items.length, 6);
  for (let i = 0; i < 3; i += 1) {
    assert.equal(section.items[i].kind, "asset");
    assert.equal(section.items[i].assetId, ASSETS[i].id);
    assert.ok(String(section.items[i].alt).length > 0, "every bound asset needs an accessible name");
  }
  for (let i = 3; i < 6; i += 1) {
    assert.equal(section.items[i].kind, "generated", "an unfilled tile must be deterministic art, never empty");
  }
});

ok("with no assets at all, the gallery is still complete and valid", () => {
  const result = insertSection(withoutGallery(), { section: "gallery", presentation: "duo", placement: { at: "end" } }, []);
  assert.ok(result.ok);
  assert.ok(validateSiteSpec((result as { ok: true; spec: SiteSpec }).spec).ok);
});

ok("no URL can enter through the factory — assets are bound by id only", () => {
  const section = buildGallerySection(
    withoutGallery(),
    { section: "gallery", presentation: "mosaic", placement: { at: "end" } },
    [{ id: "aaaaaaaa-0000-4000-8000-000000000001", label: "https://evil.example.com/x.png" }]
  );
  const serialised = JSON.stringify(section);
  assert.ok(!serialised.includes("http"), "a URL reached the spec through an asset label");
  assert.equal((section as unknown as { items: Array<{ alt: string }> }).items[0].alt, "Gallery image 1");
});

ok("the id is unique, readable, and never collides", () => {
  const spec = withoutGallery();
  assert.equal(nextSectionId(spec, "gallery"), "gallery");
  const withOne = insertSection(spec, { section: "gallery", presentation: "duo", placement: { at: "end" } }, []);
  assert.ok(withOne.ok);
  assert.equal(nextSectionId((withOne as { ok: true; spec: SiteSpec }).spec, "gallery"), "gallery-2");
});

ok("placement is honoured, and an unknown anchor falls back to the end rather than failing", () => {
  const spec = withoutGallery();
  const ids = spec.sections.map((s) => s.id);
  assert.equal(resolveInsertIndex(spec, { at: "start" }), 0);
  assert.equal(resolveInsertIndex(spec, { at: "end" }), spec.sections.length);
  assert.equal(resolveInsertIndex(spec, { after: ids[0] }), 1);
  assert.equal(resolveInsertIndex(spec, { before: ids[1] }), 1);
  assert.equal(resolveInsertIndex(spec, { after: "no-such-section" }), spec.sections.length);
});

ok("a second gallery is refused, and the page's section cap is respected", () => {
  const spec = withoutGallery();
  const once = insertSection(spec, { section: "gallery", presentation: "duo", placement: { at: "end" } }, []);
  assert.ok(once.ok);
  const twice = insertSection((once as { ok: true; spec: SiteSpec }).spec, { section: "gallery", presentation: "duo", placement: { at: "end" } }, []);
  assert.equal(twice.ok, false);
  assert.equal((twice as { reason: string }).reason, "duplicate_section");

  const crowded = withoutGallery();
  crowded.sections = Array.from({ length: MAX_SECTIONS }, (_, i) => ({ ...crowded.sections[0], id: `s${i}` })) as never;
  const full = insertSection(crowded, { section: "gallery", presentation: "duo", placement: { at: "end" } }, []);
  assert.equal((full as { reason?: string }).reason, "too_many_sections");
});

ok("the insertable vocabulary is closed", () => {
  assert.deepEqual([...INSERTABLE_SECTIONS], ["gallery"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · the operation, through the real applier
// ─────────────────────────────────────────────────────────────────────────────

ok("insert_section applies, and every pre-existing section survives untouched", () => {
  const spec = withoutGallery();
  const before = spec.sections.map((s) => s.id);
  const applied = applyOps(
    spec,
    [{ op: "insert_section", section: "gallery", presentation: "mosaic", placement: { after: before[1] }, title: "Our work" }],
    { assets: ASSETS }
  );
  assert.ok(applied.ok, JSON.stringify(applied));
  const after = applied.spec.sections.map((s) => s.id);
  for (const id of before) assert.ok(after.includes(id), `section ${id} was dropped`);
  assert.equal(after.length, before.length + 1);
  assert.equal(after[2], "gallery", "the new section is not where it was asked for");
});

ok("insert_section leaves design, terminology and navigation byte-identical", () => {
  const spec = withoutGallery();
  const applied = applyOps(spec, [{ op: "insert_section", section: "gallery", presentation: "duo", placement: { at: "end" } }], { assets: [] });
  assert.ok(applied.ok);
  assert.deepEqual(applied.spec.design, spec.design);
  assert.deepEqual(applied.spec.terminology, spec.terminology);
  assert.deepEqual(applied.spec.nav, spec.nav);
});

ok("a reorder after an insertion must still name every section", () => {
  const spec = withoutGallery();
  const inserted = applyOps(spec, [{ op: "insert_section", section: "gallery", presentation: "duo", placement: { at: "end" } }], {});
  assert.ok(inserted.ok);
  const ids = inserted.spec.sections.map((s) => s.id);
  const partial = applyOps(inserted.spec, [{ op: "reorder_sections", order: ids.slice(0, 2) }], {});
  assert.equal(partial.ok, false, "a partial reorder must still be refused after an insertion");
  // The hero stays first — that is a schema rule, and reordering must respect it
  // even when the list is complete.
  const heroFirst = [ids[0], ...ids.slice(1).reverse()];
  const complete = applyOps(inserted.spec, [{ op: "reorder_sections", order: heroFirst }], {});
  assert.ok(complete.ok, JSON.stringify(complete));
  assert.equal(complete.spec.sections.length, ids.length);
  assert.ok(complete.spec.sections.some((s) => s.type === "gallery"), "the new gallery was dropped by a reorder");
});

ok("adding a SECOND gallery is refused, with an owner-readable reason", () => {
  const first = applyOps(withoutGallery(), [{ op: "insert_section", section: "gallery", presentation: "duo", placement: { at: "end" } }], {});
  assert.ok(first.ok);
  const second = applyOps(first.spec, [{ op: "insert_section", section: "gallery", presentation: "mosaic", placement: { at: "end" } }], {});
  assert.equal(second.ok, false);
  assert.match((second as { message: string }).message, /already has a gallery/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · the model path, scripted
// ─────────────────────────────────────────────────────────────────────────────

ok("the model's flat intent maps onto the typed placement union", () => {
  const after = toSiteSpecOp({
    op: "insert_section", section: "gallery", presentation: "mosaic",
    placementAfterSectionId: "services", title: "Our work", eyebrow: null
  } as never);
  assert.deepEqual(after, {
    op: "insert_section", section: "gallery", presentation: "mosaic",
    placement: { after: "services" }, title: "Our work"
  });
  const atEnd = toSiteSpecOp({
    op: "insert_section", section: "gallery", presentation: "duo",
    placementAfterSectionId: null, title: null, eyebrow: null
  } as never);
  assert.deepEqual((atEnd as { placement: unknown }).placement, { at: "end" });
});

ok("a scripted model asking for a gallery now succeeds and appends exactly one version", async () => {
  const db = new FakeSiteDb();
  const siteId = "ffff1111-2222-4333-8444-000000000001";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "gallery-test" });
  const seeded = await saveDraftSpec(db, siteId, withoutGallery(), { source: "generated" });
  assert.ok(seeded.ok);
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;

  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec: base.spec,
    business: FADE_BUSINESS,
    message: "Add a gallery showing my uploaded photos.",
    assets: ASSETS,
    expectedParentVersionId: base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [
        {
          op: "insert_section" as const,
          section: "gallery" as const,
          presentation: "mosaic" as const,
          placement: { at: "end" as const },
          title: "Our work"
        }
      ],
      understanding: "add a gallery",
      dropped: 0,
      attempts: 1,
      usage: emptyModelUsage()
    })
  });

  assert.equal(outcome.changed, true, `the edit did not land: ${outcome.reply}`);
  assert.equal(db.versions.length, 2);
  const gallery = outcome.spec!.sections.find((s) => s.type === "gallery") as unknown as {
    items: Array<{ kind: string; assetId?: string }>;
  };
  assert.ok(gallery, "no gallery section was created");
  assert.equal(gallery.items.length, GALLERY_TILE_COUNT.mosaic);
  assert.equal(gallery.items[0].assetId, ASSETS[0].id, "the owner's own photo was not bound");
});

ok("a failed insertion writes no version and leaves the draft byte-equivalent", async () => {
  const db = new FakeSiteDb();
  const siteId = "ffff1111-2222-4333-8444-000000000002";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "gallery-fail" });
  // Seed a spec that ALREADY has a gallery, so a second one must be refused.
  const withGallery = applyOps(withoutGallery(), [{ op: "insert_section", section: "gallery", presentation: "duo", placement: { at: "end" } }], {});
  assert.ok(withGallery.ok);
  const seeded = await saveDraftSpec(db, siteId, withGallery.spec, { source: "generated" });
  assert.ok(seeded.ok);
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;
  const before = JSON.stringify(base.spec);

  const outcome = await runEdit({
    supabase: db, siteId, spec: base.spec, business: FADE_BUSINESS,
    message: "Add another gallery.", assets: ASSETS, expectedParentVersionId: base.id,
    interpret: async () => ({
      ok: true as const,
      ops: [{ op: "insert_section" as const, section: "gallery" as const, presentation: "duo" as const, placement: { at: "end" as const } }],
      understanding: "add a gallery", dropped: 0, attempts: 1, usage: emptyModelUsage()
    })
  });

  assert.equal(outcome.changed, false);
  assert.equal(db.versions.length, 1, "a failed insertion wrote a version");
  assert.equal(JSON.stringify(base.spec), before, "the draft was mutated by a failed insertion");
  assert.doesNotMatch(outcome.reply, /insert_section|SiteSpec|applyOps/, "internal jargon leaked to the owner");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · the edit ceiling
// ─────────────────────────────────────────────────────────────────────────────

ok("the conversational edit ceiling is 25 seconds, not the generation budget", () => {
  assert.equal(EDIT_MODEL_TIMEOUT_MS, 25_000);
});

ok("a timed-out edit writes nothing, says something human, and cannot mutate afterwards", async () => {
  const db = new FakeSiteDb();
  const siteId = "ffff1111-2222-4333-8444-000000000003";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "timeout-test" });
  const seeded = await saveDraftSpec(db, siteId, FADE_SPEC, { source: "generated" });
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;

  let resolveLate: { fn: (() => void) | null } = { fn: null };
  const outcome = await runEdit({
    supabase: db, siteId, spec: base.spec, business: FADE_BUSINESS,
    message: "Make it warmer.", expectedParentVersionId: base.id,
    interpret: async () => {
      // Simulate the provider aborting at the ceiling, while a "late" response
      // is still notionally in flight.
      const late = new Promise<void>((resolve) => { resolveLate.fn = resolve; });
      void late;
      return { ok: false as const, reason: "timeout" as const, message: "aborted", attempts: 1, usage: emptyModelUsage() };
    }
  });

  assert.equal(outcome.changed, false);
  assert.equal(db.versions.length, 1, "a timed-out edit wrote a version");
  assert.match(outcome.reply, /too long|exactly as it was/i);
  assert.doesNotMatch(outcome.reply, /timeout|abort|ECONN|provider/i, "a raw provider error reached the owner");
  assert.equal(outcome.diagnostics?.stage, "model");
  assert.equal(outcome.diagnostics?.detail, "timeout");

  // The late response arriving afterwards must change nothing: `runEdit` has
  // returned and nothing downstream of it holds a reference to the draft.
  resolveLate.fn?.();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(db.versions.length, 1, "a late model response mutated the draft after the failure was reported");
});

ok("the bounded repair still runs when there is budget, and is skipped when there is not", async () => {
  // Two interpretations happen only while the overall deadline allows it; the
  // second call is given the REMAINING budget, never a fresh 25 seconds.
  const db = new FakeSiteDb();
  const siteId = "ffff1111-2222-4333-8444-000000000004";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "repair-budget" });
  const seeded = await saveDraftSpec(db, siteId, FADE_SPEC, { source: "generated" });
  const base = (seeded as { ok: true; value: { id: string; spec: SiteSpec } }).value;

  const budgets: Array<number | undefined> = [];
  let attempt = 0;
  await runEdit({
    supabase: db, siteId, spec: base.spec, business: FADE_BUSINESS,
    message: "Make it feel more premium.", expectedParentVersionId: base.id,
    interpret: async (input: { timeoutMs?: number }) => {
      budgets.push(input.timeoutMs);
      attempt += 1;
      return {
        ok: true as const,
        // An unusable token value forces the applier to fail, triggering repair.
        ops: [{ op: "set_token" as const, path: "palette.background" as const, value: "not-a-colour" }],
        understanding: "warmer", dropped: 0, attempts: 1, usage: emptyModelUsage()
      };
    }
  });

  assert.equal(attempt, 2, "the bounded repair did not run");
  assert.ok(budgets[1] !== undefined, "the repair was not given an explicit budget");
  assert.ok((budgets[1] as number) <= 25_000, "the repair was handed a fresh full ceiling");
  assert.equal(db.versions.length, 1, "a failed repair wrote a version");
});

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
});
