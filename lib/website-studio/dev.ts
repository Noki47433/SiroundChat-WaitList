import type { SiteDocument } from "@/lib/website-builder/types";
import type { StudioGenerationSpec } from "@/lib/website-studio/schema";

type StudioVariationDocument = Pick<SiteDocument, "theme" | "pages" | "siteBrief">;

const shouldLogVariationSnapshot = () =>
  process.env.NODE_ENV !== "production" || process.env.SIROUNDCHAT_STUDIO_DEBUG_VARIATION === "1";

export const buildStudioVariationSnapshot = ({
  spec,
  document
}: {
  spec: StudioGenerationSpec;
  document: StudioVariationDocument;
}) => ({
  businessName: spec.business.name,
  styleMode: spec.theme.styleMode,
  archetypeKey: document.siteBrief?.designDNA?.archetypeKey ?? null,
  layoutDNA: document.siteBrief?.designDNA?.layoutDNA ?? null,
  palette: {
    primary: document.theme.primary,
    secondary: document.theme.secondary,
    background: document.theme.bg
  },
  typography: {
    heading: document.theme.fontHeading ?? null,
    body: document.theme.fontBody ?? null,
    h1: document.theme.textStyles?.h1 ?? null,
    bodyText: document.theme.textStyles?.body ?? null
  },
  sections: document.pages.flatMap((page) =>
    page.sections
      .filter((section) => section.enabled)
      .map((section) => ({
        id: section.id,
        type: section.type,
        variant: section.variant,
        alignment: section.style.alignment,
        spacing: section.style.spacing,
        background: section.style.background.type,
        buttonStyle: section.style.buttonStyle,
        hasColorOverride: Boolean(section.style.colorOverride),
        contentStyleKeys: Object.keys(section.contentStyles ?? {}),
        imageCount: section.images?.length ?? 0
      }))
  )
});

export const logStudioVariationSnapshot = (
  label: string,
  payload: {
    spec: StudioGenerationSpec;
    document: StudioVariationDocument;
  }
) => {
  if (!shouldLogVariationSnapshot()) return;
  console.info(`[studio:variation] ${label}`, buildStudioVariationSnapshot(payload));
};
