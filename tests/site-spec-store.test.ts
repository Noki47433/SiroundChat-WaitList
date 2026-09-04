/**
 * Persistence, versioning, publishing and restoration.
 *   npx tsx tests/site-spec-store.test.ts
 *
 * The behaviour under test is the one the audit found missing: a draft that can
 * change without changing the live website, a history that can be gone back to,
 * and a publish that promotes a version rather than writing content.
 */
import assert from "node:assert/strict";

import type { SiteSpec } from "@/lib/site-spec/schema";
import {
  getDraftVersion,
  getPublishedVersion,
  getSiteSpecState,
  listVersions,
  loadPublishedSpecBySlug,
  publishSite,
  restoreVersion,
  saveDraftSpec,
  undoLastChange,
  unpublishSite
} from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => Promise<void> | void) => {
  const run = async () => {
    try {
      await fn();
      console.log("PASS " + name);
      passed++;
    } catch (error) {
      console.error("FAIL " + name + "\n     " + (error as Error).message);
      failed++;
    }
  };
  queue = queue.then(run);
};
let queue: Promise<void> = Promise.resolve();

const SITE_ID = "cccccccc-1111-4111-8111-000000000001";
const OTHER_SITE_ID = "cccccccc-1111-4111-8111-000000000002";

const setup = () => {
  const db = new FakeSiteDb();
  db.addSite({ id: SITE_ID, business_id: FADE_SPEC.meta.businessId, slug: "prishtina-fade" });
  db.addSite({ id: OTHER_SITE_ID, business_id: FADE_SPEC.meta.businessId, slug: "other-site" });
  return db;
};

/** A spec that differs from the fixture in exactly one visible way. */
const withHeadline = (headline: string): SiteSpec => {
  const next = JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
  (next.sections[0] as { headline: string }).headline = headline;
  return next;
};

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; [k: string]: unknown }): T => {
  assert.ok(result.ok, `expected success, got ${JSON.stringify(result)}`);
  return (result as { ok: true; value: T }).value;
};

// ─────────────────────────────────────────────────────────────────────────────
// Drafts
// ─────────────────────────────────────────────────────────────────────────────

ok("a new site starts with no draft and nothing published", async () => {
  const db = setup();
  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.draftVersionId, null);
  assert.equal(state.publishedVersionId, null);
  assert.equal(state.hasUnpublishedChanges, false);
  assert.equal(unwrap(await getDraftVersion(db, SITE_ID)), null);
});

ok("saving a draft creates version 1 and points the draft at it", async () => {
  const db = setup();
  const version = unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC, { source: "generated" }));
  assert.equal(version.versionNumber, 1);
  assert.equal(version.source, "generated");
  assert.equal(version.parentVersionId, null);

  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.draftVersionId, version.id);
  assert.equal(state.publishedVersionId, null);
});

ok("each save appends a version and chains to its parent", async () => {
  const db = setup();
  const first = unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC, { source: "generated" }));
  const second = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Second.")));
  const third = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Third.")));

  assert.deepEqual(
    [first.versionNumber, second.versionNumber, third.versionNumber],
    [1, 2, 3],
    "version numbers must be monotonic"
  );
  assert.equal(second.parentVersionId, first.id);
  assert.equal(third.parentVersionId, second.id);

  const { versions } = unwrap(await listVersions(db, SITE_ID));
  assert.deepEqual(
    versions.map((v) => v.versionNumber),
    [3, 2, 1],
    "history should read newest first"
  );
});

ok("an invalid spec never reaches the database", async () => {
  const db = setup();
  const broken = JSON.parse(JSON.stringify(FADE_SPEC));
  broken.design.palette.accent = "not-a-colour";

  const result = await saveDraftSpec(db, SITE_ID, broken);
  assert.equal(result.ok, false);
  assert.equal((result as { reason: string }).reason, "invalid_spec");
  assert.equal(db.versions.length, 0, "a rejected spec was still written");
});

ok("version numbering is per site, not global", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, FADE_SPEC);
  await saveDraftSpec(db, SITE_ID, withHeadline("Two."));
  const other = unwrap(await saveDraftSpec(db, OTHER_SITE_ID, FADE_SPEC));
  assert.equal(other.versionNumber, 1, "the second site should start at 1");
});

// ─────────────────────────────────────────────────────────────────────────────
// Draft vs published — the whole point
// ─────────────────────────────────────────────────────────────────────────────

ok("the published site does not change when the draft does", async () => {
  const db = setup();
  const published = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Live headline.")));
  unwrap(await publishSite(db, SITE_ID));

  // Three more edits, none of them published.
  await saveDraftSpec(db, SITE_ID, withHeadline("Draft one."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Draft two."));
  const latestDraft = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Draft three.")));

  const live = unwrap(await getPublishedVersion(db, SITE_ID));
  assert.ok(live);
  assert.equal(live.id, published.id, "the published pointer moved on its own");
  assert.equal(
    (live.spec.sections[0] as { headline: string }).headline,
    "Live headline.",
    "the live site changed while only the draft was edited"
  );

  const draft = unwrap(await getDraftVersion(db, SITE_ID));
  assert.equal(draft?.id, latestDraft.id);
  assert.equal((draft!.spec.sections[0] as { headline: string }).headline, "Draft three.");

  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.hasUnpublishedChanges, true);
});

ok("what the public route serves is the published version, never the draft", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, withHeadline("Live headline."));
  unwrap(await publishSite(db, SITE_ID));
  await saveDraftSpec(db, SITE_ID, withHeadline("Unpublished work in progress."));

  const served = await loadPublishedSpecBySlug(db, "prishtina-fade");
  assert.ok(served, "the published site should be servable");
  assert.equal(
    (served!.spec.sections[0] as { headline: string }).headline,
    "Live headline.",
    "the public route served draft content"
  );
});

ok("an unpublished site is not servable at all", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, FADE_SPEC);
  assert.equal(await loadPublishedSpecBySlug(db, "prishtina-fade"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Publishing
// ─────────────────────────────────────────────────────────────────────────────

ok("publishing promotes the draft and records when", async () => {
  const db = setup();
  const draft = unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));
  const result = unwrap(await publishSite(db, SITE_ID));

  assert.equal(result.publishedVersion.id, draft.id);
  assert.ok(result.publishedAt, "publish should record a timestamp");

  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.publishedVersionId, draft.id);
  assert.equal(state.hasUnpublishedChanges, false);
});

ok("publishing writes no content — the version is unchanged by it", async () => {
  const db = setup();
  unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));
  const before = JSON.stringify(db.versions);
  unwrap(await publishSite(db, SITE_ID));
  assert.equal(JSON.stringify(db.versions), before, "publishing mutated version history");
});

ok("a site with no draft cannot be published", async () => {
  const db = setup();
  const result = await publishSite(db, SITE_ID);
  assert.equal(result.ok, false);
  assert.equal((result as { reason: string }).reason, "not_found");
});

ok("an invalid stored version cannot be published", async () => {
  const db = setup();
  unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));
  // Simulate a row written under an older schema, or by another path.
  (db.versions[0].spec as { version: number }).version = 99;

  const result = await publishSite(db, SITE_ID);
  assert.equal(result.ok, false, "an unreadable version was published");
  assert.equal((result as { reason: string }).reason, "invalid_spec");
  assert.equal(db.sites[0].published_version_id, null, "the live pointer moved anyway");
});

ok("a version belonging to another site cannot be published", async () => {
  const db = setup();
  const foreign = unwrap(await saveDraftSpec(db, OTHER_SITE_ID, FADE_SPEC));
  unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));

  const result = await publishSite(db, SITE_ID, foreign.id);
  assert.equal(result.ok, false, "a foreign version was published");
});

ok("an older version can be published without disturbing the draft", async () => {
  const db = setup();
  const first = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("One.")));
  const latest = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Two.")));

  unwrap(await publishSite(db, SITE_ID, first.id));
  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.publishedVersionId, first.id);
  assert.equal(state.draftVersionId, latest.id, "publishing an older version moved the draft");
});

ok("unpublishing takes the site down without losing the draft or the history", async () => {
  const db = setup();
  const draft = unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));
  unwrap(await publishSite(db, SITE_ID));
  unwrap(await unpublishSite(db, SITE_ID));

  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.publishedVersionId, null);
  assert.equal(state.draftVersionId, draft.id);
  assert.equal(await loadPublishedSpecBySlug(db, "prishtina-fade"), null);
  assert.equal(unwrap(await listVersions(db, SITE_ID)).versions.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Restoration — deterministic Undo
// ─────────────────────────────────────────────────────────────────────────────

ok("restoring a version reproduces its spec exactly", async () => {
  const db = setup();
  const original = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("The good one.")));
  await saveDraftSpec(db, SITE_ID, withHeadline("A regrettable edit."));
  await saveDraftSpec(db, SITE_ID, withHeadline("An even worse one."));

  const restored = unwrap(await restoreVersion(db, SITE_ID, original.id));
  assert.deepEqual(
    restored.spec,
    original.spec,
    "the restored spec is not byte-identical to the version restored"
  );
  assert.equal(restored.source, "restore");
  assert.equal(restored.restoredFromVersionId, original.id);
});

ok("restoring appends rather than rewriting — undoing is itself undoable", async () => {
  const db = setup();
  const first = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("One.")));
  const second = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Two.")));

  const restored = unwrap(await restoreVersion(db, SITE_ID, first.id));
  assert.equal(restored.versionNumber, 3, "restore should create a new version, not overwrite");

  const { versions } = unwrap(await listVersions(db, SITE_ID));
  assert.equal(versions.length, 3, "history lost an entry");
  assert.ok(
    versions.some((v) => v.id === second.id),
    "the undone version disappeared from history"
  );

  // ...and the undone edit can be reached again.
  const redone = unwrap(await restoreVersion(db, SITE_ID, second.id));
  assert.equal(
    (redone.spec.sections[0] as { headline: string }).headline,
    "Two.",
    "the undone edit could not be recovered"
  );
});

ok("restoration is deterministic — the same restore twice gives the same spec", async () => {
  const db = setup();
  const original = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Stable.")));
  await saveDraftSpec(db, SITE_ID, withHeadline("Changed."));

  const a = unwrap(await restoreVersion(db, SITE_ID, original.id));
  const b = unwrap(await restoreVersion(db, SITE_ID, original.id));
  assert.deepEqual(a.spec, b.spec);
  assert.notEqual(a.id, b.id, "each restore is still its own version");
});

ok("undo steps back exactly one edit", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, withHeadline("One."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Two."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Three."));

  const undone = unwrap(await undoLastChange(db, SITE_ID));
  assert.equal(
    (undone.spec.sections[0] as { headline: string }).headline,
    "Two.",
    "undo did not land on the previous state"
  );
});

ok("repeated undo walks BACK through history instead of oscillating", async () => {
  // A restore appends a version whose parent is the one it replaced, so naively
  // following parentVersionId twice undoes, then redoes. This is the regression
  // guard for that: three edits, three undos, each landing one step earlier.
  const db = setup();
  await saveDraftSpec(db, SITE_ID, withHeadline("One."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Two."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Three."));

  const headlineOf = (version: { spec: SiteSpec }) =>
    (version.spec.sections[0] as { headline: string }).headline;

  const first = unwrap(await undoLastChange(db, SITE_ID));
  assert.equal(headlineOf(first), "Two.", "the first undo should land on the previous state");

  const second = unwrap(await undoLastChange(db, SITE_ID));
  assert.equal(headlineOf(second), "One.", "the second undo went forwards instead of back");

  const third = await undoLastChange(db, SITE_ID);
  assert.equal(third.ok, false, "there is nothing before the first version");
});

ok("undo on a first version reports that there is nothing to go back to", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, FADE_SPEC);
  const result = await undoLastChange(db, SITE_ID);
  assert.equal(result.ok, false);
});

ok("restoring does not change what is published", async () => {
  const db = setup();
  const live = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Live.")));
  unwrap(await publishSite(db, SITE_ID));
  const edited = unwrap(await saveDraftSpec(db, SITE_ID, withHeadline("Edited.")));

  unwrap(await restoreVersion(db, SITE_ID, edited.id));
  const state = unwrap(await getSiteSpecState(db, SITE_ID));
  assert.equal(state.publishedVersionId, live.id, "a restore changed the live site");
});

ok("a version from another site cannot be restored into this one", async () => {
  const db = setup();
  const foreign = unwrap(await saveDraftSpec(db, OTHER_SITE_ID, FADE_SPEC));
  unwrap(await saveDraftSpec(db, SITE_ID, FADE_SPEC));
  const result = await restoreVersion(db, SITE_ID, foreign.id);
  assert.equal(result.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Reading back
// ─────────────────────────────────────────────────────────────────────────────

ok("an unreadable version is listed as unreadable rather than dropped silently", async () => {
  const db = setup();
  await saveDraftSpec(db, SITE_ID, withHeadline("Readable."));
  await saveDraftSpec(db, SITE_ID, withHeadline("Also readable."));
  (db.versions[0].spec as { version: number }).version = 99;

  const { versions, unreadable } = unwrap(await listVersions(db, SITE_ID));
  assert.equal(versions.length, 1);
  assert.equal(unreadable.length, 1);
  assert.equal(unreadable[0].versionNumber, 1);
  assert.ok(unreadable[0].issues.length > 0, "an unreadable version should say why");
});

// ─────────────────────────────────────────────────────────────────────────────

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
});
