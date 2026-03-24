import { regenerateSingleSectionContent } from "@/lib/builder/generation/fill";
import type { GenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationSiteDocument } from "@/lib/builder/generation/schemas/site";
import type { StrictSection } from "@/lib/builder/generation/schemas/sections";
import type { GenerationIntake } from "@/lib/builder/generation/types";
import { validateSiteDocument, type SiteValidationResult } from "@/lib/builder/generation/validate";

const REQUIRED_TYPES = new Set(["hero", "footer", "contact"]);

const mapSections = (
  doc: GenerationSiteDocument,
  updater: (section: StrictSection) => StrictSection
): GenerationSiteDocument => {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => updater(section))
    }))
  };
};

const sectionById = (doc: GenerationSiteDocument, sectionId: string): StrictSection | null => {
  for (const page of doc.pages) {
    const section = page.sections.find((candidate) => candidate.sectionId === sectionId);
    if (section) return section;
  }
  return null;
};

const stripOptionalBlocks = (section: StrictSection): StrictSection => {
  if (section.type === "hero") {
    return {
      ...section,
      content: {
        ...section.content,
        secondaryCta: undefined,
        image: undefined
      }
    };
  }
  if (section.type === "cta") {
    return {
      ...section,
      content: {
        ...section.content,
        secondaryCta: undefined
      }
    };
  }
  return section;
};

const sectionHasErrors = (validation: SiteValidationResult, sectionId: string) => {
  return Boolean(validation.errorsBySectionId[sectionId]?.length);
};

export async function regenerateFailingSections(
  document: GenerationSiteDocument,
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any,
  initialValidation: SiteValidationResult
): Promise<{ document: GenerationSiteDocument; regensCount: number }> {
  let next = document;
  let regensCount = 0;

  const failingSectionIds = Object.keys(initialValidation.errorsBySectionId);
  for (const sectionId of failingSectionIds) {
    const current = sectionById(next, sectionId);
    if (!current) continue;

    let fixed = false;
    let attempt = 0;
    let workingSection: StrictSection = current as StrictSection;
    const errorHints = initialValidation.errorsBySectionId[sectionId].map((issue) => issue.message);

    while (attempt < 2) {
      attempt += 1;
      try {
        const regeneratedContent = await regenerateSingleSectionContent(
          workingSection,
          intake,
          policy,
          openai,
          errorHints
        );
        workingSection = {
          ...workingSection,
          content: regeneratedContent as any
        } as StrictSection;
        next = mapSections(next, (section) => (section.sectionId === sectionId ? workingSection : section));
        regensCount += 1;
        const validation = validateSiteDocument(next);
        if (!sectionHasErrors(validation, sectionId)) {
          fixed = true;
          break;
        }
      } catch (error) {
        console.warn("[GEN] regenerate section failed", sectionId, error);
      }
    }

    if (fixed) continue;

    workingSection = stripOptionalBlocks({
      ...workingSection,
      variant: "A"
    } as StrictSection);

    next = mapSections(next, (section) => (section.sectionId === sectionId ? workingSection : section));
    let validation = validateSiteDocument(next);
    if (!sectionHasErrors(validation, sectionId)) {
      continue;
    }

    if (!REQUIRED_TYPES.has(workingSection.type)) {
      workingSection = { ...workingSection, enabled: false } as StrictSection;
      next = mapSections(next, (section) => (section.sectionId === sectionId ? workingSection : section));
      validation = validateSiteDocument(next);
      if (!sectionHasErrors(validation, sectionId)) {
        continue;
      }
    }
  }

  return { document: next, regensCount };
}
