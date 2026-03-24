import { readFile } from "node:fs/promises";
import path from "node:path";
import { SPACING_PROFILE_IDS, TOKEN_SET_IDS, spacingProfiles } from "../lib/builder/design/tokens";
import { applyDeterministicImages } from "../lib/builder/generation/images";
import { buildGenerationPlanCandidates } from "../lib/builder/generation/plan";
import { getGenerationPolicy } from "../lib/builder/generation/policy";
import { regenerateFailingSections } from "../lib/builder/generation/regenerateSection";
import { computeWebsiteQualityScore } from "../lib/builder/generation/score";
import { buildSkeleton } from "../lib/builder/generation/structure";
import type { GenerationIntake } from "../lib/builder/generation/types";
import { validateSiteDocument } from "../lib/builder/generation/validate";
import { fillSkeletonSections } from "../lib/builder/generation/fill";

const FIXTURES = ["service.json", "restaurant.json", "consulting.json"] as const;

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const disableOptionalFailingSections = (siteDoc: any, failingSectionIds: string[]) => {
  const required = new Set(["hero", "contact", "footer"]);
  return {
    ...siteDoc,
    pages: siteDoc.pages.map((page: any) => ({
      ...page,
      sections: page.sections.map((section: any) => {
        if (!failingSectionIds.includes(section.sectionId)) return section;
        if (required.has(section.type)) return section;
        return { ...section, enabled: false };
      })
    }))
  };
};

async function runFixture(filename: string) {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "generation", filename);
  const raw = await readFile(filePath, "utf8");
  const intake = JSON.parse(raw) as GenerationIntake;

  const policy = getGenerationPolicy(intake.businessType, intake.subtype, intake.ctaIntent);
  const candidates = await buildGenerationPlanCandidates(
    intake,
    policy,
    null,
    policy.conversion_first ? 2 : 3
  );
  assert(candidates.length > 0, `[${filename}] no plan candidates generated`);
  assert(candidates.length <= 3, `[${filename}] candidate count exceeded max`);

  const plan = candidates[0];
  const skeleton = buildSkeleton(plan, intake);
  let generated = await fillSkeletonSections(skeleton, intake, policy, null);

  let validation = validateSiteDocument(generated);
  if (!validation.ok && Object.keys(validation.errorsBySectionId).length > 0) {
    const regen = await regenerateFailingSections(generated, intake, policy, null, validation);
    generated = regen.document;
    validation = validateSiteDocument(generated);
  }

  generated = await applyDeterministicImages(generated, intake);
  validation = validateSiteDocument(generated);
  if (!validation.ok) {
    generated = disableOptionalFailingSections(generated, Object.keys(validation.errorsBySectionId));
    validation = validateSiteDocument(generated);
  }

  const score = computeWebsiteQualityScore(generated, validation);
  const allSections = generated.pages.flatMap((page) => page.sections);
  const enabledSections = generated.pages.map((page) => page.sections.filter((section) => section.enabled).length);

  const ids = allSections.map((section) => section.sectionId);
  const uniqueIds = new Set(ids);

  assert(ids.length === uniqueIds.size, `[${filename}] duplicate section IDs detected`);
  assert(enabledSections.every((count) => count <= 10), `[${filename}] sections > 10 on a page`);
  assert(
    allSections.some(
      (section) => section.type === "hero" && section.enabled && section.content?.primaryCta?.label
    ),
    `[${filename}] missing hero CTA`
  );
  assert(
    allSections.every((section) => ["py-8", "py-12", "py-16"].includes(spacingProfiles[section.spacingProfile])),
    `[${filename}] spacing cap violated`
  );
  assert(
    allSections.every(
      (section) =>
        TOKEN_SET_IDS.includes(section.tokenSetId) &&
        SPACING_PROFILE_IDS.includes(section.spacingProfile)
    ),
    `[${filename}] found tokens outside allowlist`
  );
  assert(
    generated.pages.every((page) => page.sections.find((section) => section.enabled)?.type === "hero"),
    `[${filename}] enabled sections do not start with hero`
  );
  assert(score.total >= 55, `[${filename}] quality score too low (${score.total})`);

  return {
    fixture: filename,
    templateId: generated.templateId,
    candidates: candidates.map((candidate) => candidate.templateId),
    validationOk: validation.ok,
    score: score.total
  };
}

async function main() {
  const results = [];
  for (const fixture of FIXTURES) {
    results.push(await runFixture(fixture));
  }
  console.log("Generation pipeline checks passed.");
  results.forEach((result) => {
    console.log(
      `- ${result.fixture}: template=${result.templateId}, candidates=${result.candidates.join(",")}, validationOk=${result.validationOk}, score=${result.score}`
    );
  });
}

main().catch((error) => {
  console.error("Generation pipeline checks failed.");
  console.error(error);
  process.exit(1);
});
