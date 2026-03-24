import { findBannedCopyHits } from "@/lib/builder/generation/bannedCopy";
import type { GenerationSiteDocument } from "@/lib/builder/generation/schemas/site";
import type { SiteValidationResult } from "@/lib/builder/generation/validate";

export type WebsiteQualityScore = {
  total: number;
  breakdown: {
    structureValidity: number;
    visualRhythm: number;
    typographyConsistency: number;
    copySpecificity: number;
    ctaClarity: number;
    imageRelevance: number;
    accessibility: number;
  };
  autoFail: boolean;
  gates: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hasErrorCode = (validation: SiteValidationResult, code: string) => {
  if (validation.errorsGlobal.some((issue) => issue.code === code)) return true;
  return Object.values(validation.errorsBySectionId).some((issues) =>
    issues.some((issue) => issue.code === code)
  );
};

const countBannedHits = (doc: GenerationSiteDocument) => {
  return doc.pages
    .flatMap((page) => page.sections)
    .reduce((count, section) => count + findBannedCopyHits(section.content).length, 0);
};

const countNumericEvidence = (doc: GenerationSiteDocument) => {
  const source = JSON.stringify(doc.pages);
  const matches = source.match(/\d+/g);
  return matches?.length ?? 0;
};

export function computeWebsiteQualityScore(
  doc: GenerationSiteDocument,
  validation: SiteValidationResult
): WebsiteQualityScore {
  const gates: string[] = [];

  if (!validation.ok) gates.push("invalid schema");
  if (hasErrorCode(validation, "hero_cta") || hasErrorCode(validation, "hero_required")) {
    gates.push("missing hero CTA");
  }
  if (hasErrorCode(validation, "duplicate_id")) {
    gates.push("duplicate IDs");
  }
  if (hasErrorCode(validation, "banned_copy")) {
    gates.push("banned phrase hits > threshold");
  }
  if (hasErrorCode(validation, "required_imagery")) {
    gates.push("missing required imagery for image-dependent variants");
  }
  if (hasErrorCode(validation, "hierarchy")) {
    gates.push("weak visual hierarchy");
  }
  if (hasErrorCode(validation, "spacing")) {
    gates.push("bad spacing rhythm");
  }

  const structureValidity = validation.ok ? 20 : 0;

  const enabledSections = doc.pages.flatMap((page) => page.sections).filter((section) => section.enabled);
  const spacingVariety = new Set(enabledSections.map((section) => section.spacingProfile)).size;
  const visualRhythm = clamp(13 - Math.max(0, spacingVariety - 1) * 3, 0, 15);

  const tokenSetVariety = new Set(enabledSections.map((section) => section.tokenSetId)).size;
  const typographyConsistency = tokenSetVariety <= 1 ? 10 : tokenSetVariety === 2 ? 7 : 4;

  const bannedHits = countBannedHits(doc);
  const numericEvidence = countNumericEvidence(doc);
  const copySpecificity = clamp(20 - bannedHits * 5 + Math.min(5, numericEvidence), 0, 20);

  const hero = enabledSections.find(
    (section): section is Extract<(typeof enabledSections)[number], { type: "hero" }> =>
      section.type === "hero"
  );
  const cta = enabledSections.find((section) => section.type === "cta");
  const ctaClarity = hero?.content?.primaryCta?.label && (cta || hero.content.primaryCta.href) ? 15 : hero ? 9 : 0;

  const allImages = enabledSections.flatMap((section) => section.images ?? []);
  const uniqueImages = new Set(allImages.map((image) => image.src)).size;
  const imageRelevance = allImages.length === 0 ? 5 : clamp(4 + uniqueImages, 0, 10);

  const imagesWithAlt = allImages.filter((image) => Boolean(image.alt?.trim())).length;
  const accessibility = allImages.length === 0 ? 8 : clamp(Math.round((imagesWithAlt / allImages.length) * 10), 0, 10);

  const total = clamp(
    structureValidity +
      visualRhythm +
      typographyConsistency +
      copySpecificity +
      ctaClarity +
      imageRelevance +
      accessibility,
    0,
    100
  );

  return {
    total,
    breakdown: {
      structureValidity,
      visualRhythm,
      typographyConsistency,
      copySpecificity,
      ctaClarity,
      imageRelevance,
      accessibility
    },
    autoFail: gates.length > 0,
    gates
  };
}
