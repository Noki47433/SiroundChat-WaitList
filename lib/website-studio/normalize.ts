import type { SiteDocument } from "@/lib/website-builder/types";
import {
  STUDIO_SPEC_VERSION,
  StudioGenerationSpecSchema,
  type StudioGenerationSpec,
  type StudioProviderMetadata,
  type StudioRefinementPlan,
  type StudioSiteBriefMetadata
} from "@/lib/website-studio/schema";
import {
  buildRestaurantStudioSpecFromGenerationPayload,
  type LegacyStudioGenerationPayload
} from "@/lib/website-studio/spec-builder";

export const parseStudioGenerationSpec = (value: unknown): StudioGenerationSpec | null => {
  const parsed = StudioGenerationSpecSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const resolveStudioGenerationSpec = (
  payload: LegacyStudioGenerationPayload & { studioSpec?: unknown }
): StudioGenerationSpec => {
  return parseStudioGenerationSpec(payload.studioSpec) ?? buildRestaurantStudioSpecFromGenerationPayload(payload);
};

export const attachStudioMetadataToSiteDocument = (
  document: SiteDocument,
  spec: StudioGenerationSpec,
  provider: StudioProviderMetadata
): SiteDocument => {
  const existingStudio = document.siteBrief?.studio;
  const existingRefinements = existingStudio?.refinements ?? [];
  const studio: StudioSiteBriefMetadata = {
    version: STUDIO_SPEC_VERSION,
    vertical: "restaurant",
    generationSpec: spec,
    provider,
    refinements: existingRefinements,
    storedAt: new Date().toISOString()
  };

  return {
    ...document,
    siteBrief: {
      ...(document.siteBrief ?? {}),
      studio
    }
  };
};

export const appendStudioRefinementToSiteDocument = (
  document: SiteDocument,
  refinement: StudioRefinementPlan
): SiteDocument => {
  const existingStudio = document.siteBrief?.studio;
  if (!existingStudio) {
    return document;
  }

  const refinements = [...(existingStudio.refinements ?? []), refinement].slice(-25);
  return {
    ...document,
    siteBrief: {
      ...(document.siteBrief ?? {}),
      studio: {
        ...existingStudio,
        refinements,
        storedAt: new Date().toISOString()
      }
    }
  };
};
