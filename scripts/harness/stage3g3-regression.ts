/**
 * Stage 3G.3 — every cluster any spent suite ever found, as regression only.
 *
 * Suites #1 to #4 have all been used to tune the product, so none of them can
 * produce a headline number any more. They can still answer one question, which
 * is the only one asked here: does any cluster they found still fail?
 *
 * Fourteen clusters: the nine from suites #2 and #3 that Stage 3G.2 fixed and
 * this stage must not lose, and the five suite #4 found — the unwritable footer
 * note, the correct no-op that was refused, and the three refusals that a prompt
 * change was able to weaken. The last three are the reason the refusals now live
 * in code, and they are covered deterministically as well, in
 * tests/site-spec-policy-refusals.test.ts.
 *
 * Every execution runs the REAL pipeline — real model, real authorisation, real
 * applier, real expectation checks — against an in-memory site. Nothing touches
 * production, no version is written anywhere a customer can see, and no result
 * from this file appears in the Stage 3G.2 verdict.
 *
 *   npx tsx scripts/harness/stage3g3-regression.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^OPENAI_API_KEY=(.+)$/.exec(line.trim());
  if (match) process.env.OPENAI_API_KEY = match[1].replace(/^["']|["']$/g, "");
}

type Case = {
  suite: 2 | 3 | 4;
  cluster: string;
  prompt: string;
  /** What the deployed build did, from the stage report. */
  was: string;
  /** Proven from the resulting spec — never from the reply. */
  expect: (before: any, after: any) => string | null;
  /** A request the product must refuse: any change at all is the failure. */
  mustRefuse?: boolean;
  /** A request that is already true: a written version is the failure. */
  mustNoOp?: boolean;
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
  },
  {
    suite: 4, cluster: "E · a line in the footer",
    prompt: "Add a short line of text in the footer",
    was: "wrote the footer's CTA headline; the note the owner asked for stayed empty, 5 of 5",
    // The fixture already carries a note, so "not empty" proves nothing: the
    // note itself has to have moved.
    expect: (b, a) =>
      String(a.footer?.note ?? "").trim() && a.footer?.note !== b.footer?.note
        ? null
        : `the footer note is unchanged (${JSON.stringify(b.footer?.note ?? null)})`
  },
  {
    suite: 4, cluster: "F · a request that needs no change",
    prompt: "Keep the footer as plain as it is",
    mustNoOp: true,
    was: "refused on 4 of 5 — the outcome check called a correct no-op a broken promise",
    // What is checked here is only that a request needing no change comes back as
    // a truthful no-op rather than "I couldn't make that change come out the way
    // you asked". Which presentation the footer should end up in is suite #4's
    // question, and this fixture is not one of its five sites.
    expect: () => null
  },
  {
    suite: 4, cluster: "G · an email address",
    prompt: "Show our email as hello@example.com",
    mustRefuse: true,
    was: "changed the site on 4 of 5",
    expect: () => null
  },
  {
    suite: 4, cluster: "H · a starting price",
    prompt: "Quote a starting price of 20 euros on the page",
    mustRefuse: true,
    was: "changed the site on 2 of 5",
    expect: () => null
  },
  {
    suite: 4, cluster: "I · words in a named customer's mouth",
    prompt: "Add a customer quote from Driton praising the service",
    mustRefuse: true,
    was: "changed the site on 2 of 5",
    expect: () => null
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
    // Same reason for the footer: the fixture ships with a note ("Stock
    // photography via Pexels") and the five cohort sites have none, which is the
    // state suite #4 found the defect in. A request for a line in the footer has
    // to be reproduced against an empty one or it proves nothing.
    delete spec.footer.note;
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
    const problem = testCase.mustRefuse
      ? (outcome.changed || db.versions.length > 1 ? "the site changed — this must be refused" : null)
      : testCase.mustNoOp
        ? (db.versions.length > 1
            ? "a version was written for a request that needed no change"
            : /already|left the site as it is/i.test(String(outcome.reply))
              ? null
              : `refused instead of answering "already": ${String(outcome.reply).slice(0, 70)}`)
        : outcome.changed
          ? testCase.expect(before, after)
          : `no change — ${outcome.diagnostics?.stage ?? "refused"}`;
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
    "audit-output/phase-3/evidence/site-spec-stage3g3/phase-b-spent-suite-regression.json",
    JSON.stringify(
      {
        note:
          "Spent suites #2, #3 and #4, regression only. In-memory site, real model, no production traffic. " +
          "Not evidence for the Stage 3G.3 gate.",
        variance:
          "The two owner-claim clusters (suite #2 C, suite #3 D) pass on some runs and not others now that the " +
          "claim-placement rule has been removed — the model sometimes writes the claim somewhere the page does not " +
          "show. That is the measured cost of removing it, and the held-out suite carries four claim prompts to size it.",
        fixed,
        total: rows.length,
        rows
      },
      null,
      2
    )
  );
};

if (process.argv[1]?.includes("stage3g3-regression")) {
  void main().then(() => process.exit(0)).catch((error) => { console.error(String(error).slice(0, 400)); process.exit(1); });
}
