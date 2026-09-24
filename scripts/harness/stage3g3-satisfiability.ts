/**
 * Was every prompt in suite #5 answerable on the five sites it was run against?
 *   npx tsx scripts/harness/stage3g3-satisfiability.ts
 *
 * Run AFTER the measurement, because the measurement is what raised the
 * question. Fourteen of suite #5's thirty-four hard failures turned out to be
 * requests about a section that does not exist on any of the five businesses —
 * the suite's predicates were written against the development fixture, which has
 * a contact section, and the cohort has none.
 *
 * The outcomes stand exactly as the frozen contract classified them; nothing
 * here reclassifies anything (R8). What this file produces is the check that
 * should have run BEFORE the freeze, so suite #6 cannot repeat it: for every
 * prompt, at every baseline, can the post-condition be reached at all?
 */
import { writeFileSync } from "node:fs";

import { HELD_OUT_PROMPTS } from "./stage3g3-heldout";
import { COHORT, admin } from "./stage3f1-cohort";

const db = admin();

/** What a prompt needs the site to have before it can possibly be satisfied. */
const REQUIRES: Array<{ match: RegExp; needs: string; present: (spec: any) => boolean }> = [
  {
    match: /contact block|contact details/i,
    needs: "a contact section",
    present: (spec) => spec.sections.some((s: any) => s.type === "contact")
  },
  {
    match: /line under the booking heading/i,
    needs: "a booking subheading with text in it",
    present: (spec) => Boolean(spec.sections.find((s: any) => s.type === "booking")?.heading?.sub)
  },
  {
    match: /gallery/i,
    needs: "a gallery section",
    present: (spec) => spec.sections.some((s: any) => s.type === "gallery")
  },
  {
    match: /team/i,
    needs: "a team section",
    present: (spec) => spec.sections.some((s: any) => s.type === "team")
  },
  {
    match: /opening hours/i,
    needs: "an hours section",
    present: (spec) => spec.sections.some((s: any) => s.type === "hours")
  },
  {
    match: /services/i,
    needs: "a services section",
    present: (spec) => spec.sections.some((s: any) => s.type === "services")
  },
  {
    match: /own photographs|gallery photo/i,
    needs: "at least one uploaded image",
    present: (spec) => JSON.stringify(spec).includes('"kind":"asset"')
  }
];

const main = async () => {
  const specs: Array<{ n: number; slug: string; spec: any }> = [];
  for (const entry of COHORT) {
    const { data } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
    specs.push({ n: entry.n, slug: entry.slug, spec: data!.spec });
  }

  const rows = HELD_OUT_PROMPTS.filter((p) => !p.mustRefuse).map((prompt) => {
    const requirements = REQUIRES.filter((r) => r.match.test(prompt.text));
    const unsatisfiable = specs
      .filter((site) => requirements.some((r) => !r.present(site.spec)))
      .map((site) => ({
        site: `#${site.n} ${site.slug}`,
        missing: requirements.filter((r) => !r.present(site.spec)).map((r) => r.needs)
      }));
    return { prompt: prompt.text, needs: requirements.map((r) => r.needs), unsatisfiableOn: unsatisfiable };
  });

  const broken = rows.filter((r) => r.unsatisfiableOn.length);
  for (const row of broken) {
    console.log(`  ✗ ${row.prompt}`);
    console.log(`      needs ${row.needs.join(", ")} — missing on ${row.unsatisfiableOn.length}/5 sites`);
  }
  const affected = broken.reduce((n, r) => n + r.unsatisfiableOn.length, 0);
  console.log(`\n  ${broken.length} of ${rows.length} answerable prompts cannot be satisfied on at least one site (${affected} prompt/site pairs)`);

  writeFileSync(
    "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3g3/phase-g-satisfiability.json",
    JSON.stringify(
      {
        note:
          "Run after the measurement. It reclassifies nothing — the frozen contract's outcomes stand (R8). " +
          "This is the check that should have run before the freeze, and must run before suite #6 is frozen.",
        promptsChecked: rows.length,
        promptsUnsatisfiableSomewhere: broken.length,
        promptSitePairsAffected: affected,
        rows: broken
      },
      null,
      2
    )
  );
};

if (process.argv[1]?.includes("stage3g3-satisfiability")) void main().then(() => process.exit(0));
