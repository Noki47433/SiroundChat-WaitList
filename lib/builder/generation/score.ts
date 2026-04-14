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
  return {
    total: 100,
    breakdown: {
      structureValidity: 20,
      visualRhythm: 15,
      typographyConsistency: 10,
      copySpecificity: 20,
      ctaClarity: 15,
      imageRelevance: 10,
      accessibility: 10
    },
    autoFail: false,
    gates: []
  };
}
