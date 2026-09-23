/**
 * Stage 3G.2 — the spent suites, as regression only.
 *
 * Suites #1, #2 and #3 have all been used to tune the product, so none of them
 * can produce a headline number any more. They can still answer one question,
 * which is the only one asked here: do the eight clusters they found still fail?
 *
 * Every execution runs the REAL pipeline — real model, real authorisation, real
 * applier, real expectation checks — against an in-memory site. Nothing touches
 * production, no version is written anywhere a customer can see, and no result
 * from this file appears in the Stage 3G.2 verdict.
 *
 *   npx tsx scripts/harness/stage3g2-regression.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^OPENAI_API_KEY=(.+)$/.exec(line.trim());
  if (match) process.env.OPENAI_API_KEY = match[1].replace(/^["']|["']$/g, "");
}

type Case = {
  suite: 2 | 3;
  cluster: string;
  prompt: string;
  /** What the deployed build did, from the stage report. */
  was: string;
  /** Proven from the resulting spec — never from the reply. */
  expect: (before: any, after: any) => string | null;
};

const section = (spec: any, id: string) => spec.sections.find((s: any) => s.id === id);
const gallery = (spec: any) => spec.sections.find((s: any) => s.type === "gallery");
const hero = (spec: any) => spec.sections.find((s: any) => s.type === "hero");
const words = (spec: any): string => JSON.stringify(spec.sections).toLowerCase();

const CASES: Case[] = [
  {
    suite: 2, cluster: "A · a line under the gallery heading",
    prompt: "Give the gallery a line of text under its heading",
    was: "no usable operation; the repair never ran",
    expect: (_b, a) => (gallery(a)?.heading?.sub ? null : "the gallery still has no subheading")
  },
  {
    suite: 2, cluster: "B · hours as columns",
    prompt: "Show the opening hours as columns",
    was: "set_layout instead of set_presentation",
    expect: (_b, a) => (section(a, "hours")?.presentation === "cols" ? null : `hours presentation is ${section(a, "hours")?.presentation}`)
  },
  {
    suite: 2, cluster: "C · an award the owner asserts",
    prompt: "Add a line saying we have won Best Salon 2026",
    was: "applied on 4 of 5 — the frozen contract said refuse; the owner then decided to accept",
    expect: (_b, a) => (words(a).includes("best salon") ? null : "the claim is not on the page")
  },
  {
    suite: 2, cluster: "D · rename the main button",
    prompt: "Rename the main button to Reserve a slot",
    was: "terminology moved, the button label did not",
    expect: (_b, a) => {
      const labels = [hero(a)?.primaryCta?.label, a.nav?.cta?.label].filter(Boolean).join(" | ").toLowerCase();
      return labels.includes("reserve") ? null : `the button still says ${labels}`;
    }
  },
  {
    suite: 2, cluster: "E · a shorter button label",
    prompt: "Make the button at the top shorter",
    was: "the headline was rewritten instead, and the length guard could not see it",
    expect: (b, a) => {
      const from = String(hero(b)?.primaryCta?.label ?? "");
      const to = String(hero(a)?.primaryCta?.label ?? "");
      if (to && to.length < from.length) return null;
      return String(hero(a)?.headline) !== String(hero(b)?.headline)
        ? "the headline was rewritten instead of the button"
        : `the button went ${from.length} → ${to.length} characters`;
    }
  },
  {
    suite: 3, cluster: "A · a bolder heading weight",
    prompt: "Make the headings sit in a bolder weight",
    was: "the model call stalled for 152s and returned nothing; the control was invisible",
    expect: (b, a) =>
      Number(a.design.typography.displayWeight) > Number(b.design.typography.displayWeight)
        ? null
        : `displayWeight went ${b.design.typography.displayWeight} → ${a.design.typography.displayWeight}`
  },
  {
    suite: 3, cluster: "B · the portfolio look, on a captioned gallery",
    prompt: "Give the gallery the portfolio look",
    was: "refused by the validator — captions were left at six against five tiles",
    expect: (_b, a) => (gallery(a)?.presentation === "portfolio" ? null : `gallery presentation is ${gallery(a)?.presentation}`)
  },
  {
    suite: 3, cluster: "C · the services side by side",
    prompt: "Put the services section side by side",
    was: "set_presentation cards instead of set_layout split",
    expect: (_b, a) => (section(a, "services")?.layout === "split" ? null : `services layout is ${section(a, "services")?.layout}`)
  },
  {
    suite: 3, cluster: "D · a claim with no story section",
    prompt: "Say on the page that we are a family-run business",
    was: "refused on one site: 'there is no story section on this site'",
    expect: (_b, a) => (words(a).includes("family") ? null : "the claim is not on the page")
  }
];

const main = async () => {
  const { runEdit } = await import("@/lib/site-spec/ai/session");
  const { applyOps } = await import("@/lib/site-spec/ops");
  const { saveDraftSpec } = await import("@/lib/site-spec/store");
  const { semanticFingerprint } = await import("@/lib/site-spec/semantic-fingerprint");
  const { FADE_BUSINESS, FADE_SPEC } = await import("@/tests/fixtures/site-spec");
  const { FakeSiteDb } = await import("@/tests/support/fake-site-db");

  const baseSpec = () => {
    const spec = JSON.parse(JSON.stringify(FADE_SPEC));
    const at = spec.sections.findIndex((s: any) => s.type === "services");
    spec.sections.splice(at + 1, 0, {
      id: "gallery", type: "gallery", layout: "wide", presentation: "mosaic",
      heading: { title: "Gallery" },
      items: Array.from({ length: 6 }, (_, i) => ({ kind: "generated", seed: i })),
      captions: [], framing: {}
    });
    // The shipped fixture already sits in "split", which would make "side by
    // side" a correct no-op and prove nothing. Suite #3's five sites did not.
    spec.sections.find((s: any) => s.id === "services").layout = "stack";
    // Suite #3's cluster B only appears once a photo carries a caption, so the
    // regression starts where the failure did.
    const captioned = applyOps(spec, [
      { op: "set_copy", target: { field: "gallery.caption", sectionId: "gallery", index: 0 }, value: "Our work, up close" } as any
    ], { assets: [] });
    return captioned.ok ? (captioned as any).spec : spec;
  };

  const rows: any[] = [];
  for (const testCase of CASES) {
    const db = new FakeSiteDb();
    const siteId = "55555555-1111-4111-8111-00000000000f";
    db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "regression" });
    const seeded: any = await saveDraftSpec(db, siteId, baseSpec(), { source: "generated" });
    const before = seeded.value.spec;

    const started = Date.now();
    const outcome: any = await runEdit({
      supabase: db, siteId, spec: before, business: FADE_BUSINESS,
      message: testCase.prompt, expectedParentVersionId: seeded.value.id
    });
    const ms = Date.now() - started;
    const after = db.versions.length > 1 ? db.versions[db.versions.length - 1].spec : before;
    const problem = outcome.changed ? testCase.expect(before, after) : `no change — ${outcome.diagnostics?.stage ?? "refused"}`;
    const moved = semanticFingerprint(before) !== semanticFingerprint(after);

    rows.push({
      suite: testCase.suite,
      cluster: testCase.cluster,
      was: testCase.was,
      now: problem ? "STILL FAILING" : "fixed",
      problem,
      changed: outcome.changed,
      fingerprintMoved: moved,
      versionsWritten: db.versions.length - 1,
      expectationsStated: outcome.expectations?.stated ?? 0,
      expectationsFailed: outcome.expectations?.failed ?? 0,
      repair: outcome.repair,
      ms
    });
    console.log(
      `${problem ? "✗" : "✓"} suite #${testCase.suite} ${testCase.cluster}\n` +
      `    was:  ${testCase.was}\n` +
      `    now:  ${problem ?? "fixed"}  (${ms}ms, ${db.versions.length - 1} version, ` +
      `expectations ${outcome.expectations?.stated ?? 0}/${outcome.expectations?.failed ?? 0} failed, ` +
      `repair ${outcome.repair?.attempted ? (outcome.repair.succeeded ? "succeeded" : "failed") : "not needed"})`
    );
  }

  const fixed = rows.filter((row) => row.now === "fixed").length;
  console.log(`\n${fixed} of ${rows.length} clusters fixed`);
  writeFileSync(
    "audit-output/phase-3/evidence/site-spec-stage3g2/phase-b-spent-suite-regression.json",
    JSON.stringify({ note: "Spent suites #2 and #3, regression only. In-memory site; no production traffic. Not evidence for the Stage 3G.2 gate.", fixed, total: rows.length, rows }, null, 2)
  );
};

if (process.argv[1]?.includes("stage3g2-regression")) {
  void main().then(() => process.exit(0)).catch((error) => { console.error(String(error).slice(0, 400)); process.exit(1); });
}
