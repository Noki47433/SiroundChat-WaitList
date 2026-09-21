/**
 * Stage 3F.2 · Phase A — the semantic fingerprint, pinned before it is used.
 *   npx tsx tests/site-spec-semantic-fingerprint.test.ts
 *
 * Every rule in lib/site-spec/semantic-fingerprint.ts has a test here, written
 * before the edit pipeline or the measurement harness depends on it. If the
 * canonical form ever drifts, the product's no-op guard and the measurement's
 * verdict drift together — which is the point of sharing it — but this file is
 * what notices.
 */
import assert from "node:assert/strict";

import {
  VOLATILE_SPEC_PATHS,
  sameWebsite,
  semanticFingerprint,
  semanticForm
} from "@/lib/site-spec/semantic-fingerprint";
import type { SiteSpec } from "@/lib/site-spec/schema";
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

ok("the same spec fingerprints the same, every time", () => {
  assert.equal(semanticFingerprint(base()), semanticFingerprint(base()));
  assert.match(semanticFingerprint(base()), /^[0-9a-f]{64}$/);
});

ok("volatile bookkeeping alone does not change the fingerprint", () => {
  const a = base();
  const b = base();
  b.meta.generatedAt = "2001-01-01T00:00:00.000Z";
  b.meta.updatedAt = "2099-12-31T23:59:59.000Z";
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), "the fixture did not actually differ");
  assert.equal(semanticFingerprint(a), semanticFingerprint(b));
  assert.equal(sameWebsite(a, b), true);
});

ok("exactly the declared volatile paths are removed, and nothing else from meta", () => {
  assert.deepEqual([...VOLATILE_SPEC_PATHS], ["meta.generatedAt", "meta.updatedAt"]);
  const form = semanticForm(base()) as any;
  assert.equal(form.meta.generatedAt, undefined);
  assert.equal(form.meta.updatedAt, undefined);
  assert.ok(form.meta.seo, "SEO is what a search result shows — it must stay");
  assert.ok(form.meta.businessId, "businessId must stay");
});

ok("key order does not matter", () => {
  const a = base();
  const reversed = (value: any): any =>
    Array.isArray(value)
      ? value.map(reversed)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reversed(value[key])]))
        : value;
  const b = reversed(a);
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), "the reversal did not reorder anything");
  assert.equal(semanticFingerprint(a), semanticFingerprint(b));
});

ok("an unset schema default and the explicit default are the same website", () => {
  const a = base();
  const b = base();
  delete (a.design.typography as any).headingScale;
  (b.design.typography as any).headingScale = "default";
  assert.equal(semanticFingerprint(a), semanticFingerprint(b));
});

ok("array order is meaning: swapping two sections is a different website", () => {
  const a = base();
  const b = base();
  const [x, y] = [b.sections[1], b.sections[2]];
  b.sections[1] = y;
  b.sections[2] = x;
  assert.notEqual(semanticFingerprint(a), semanticFingerprint(b));
});

ok("a one-rung token change is a different website", () => {
  const a = base();
  const b = base();
  (b.design.typography as any).headingScale = "larger";
  assert.notEqual(semanticFingerprint(a), semanticFingerprint(b));
});

ok("a one-character copy change is a different website", () => {
  const a = base();
  const b = base();
  const hero = b.sections.find((section) => section.type === "hero") as any;
  hero.headline = hero.headline + ".";
  assert.notEqual(semanticFingerprint(a), semanticFingerprint(b));
});

ok("the menu order is meaning", () => {
  const a = base();
  const b = base();
  b.nav.items = [...b.nav.items].reverse();
  assert.notEqual(JSON.stringify(a.nav.items), JSON.stringify(b.nav.items), "fixture nav too short to reverse");
  assert.notEqual(semanticFingerprint(a), semanticFingerprint(b));
});

ok("fingerprinting never mutates the caller's spec", () => {
  const a = base();
  const before = JSON.stringify(a);
  semanticFingerprint(a);
  assert.equal(JSON.stringify(a), before);
});

ok("an unparseable value still fingerprints, deterministically", () => {
  assert.equal(semanticFingerprint({ nonsense: true }), semanticFingerprint({ nonsense: true }));
  assert.notEqual(semanticFingerprint({ nonsense: true }), semanticFingerprint({ nonsense: false }));
  assert.equal(semanticFingerprint(null), semanticFingerprint(null));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
