import { SkeletonSiteDocumentSchema, type SkeletonSiteDocument } from "@/lib/builder/generation/schemas/site";
import { getTemplateById } from "@/lib/builder/generation/templates/registry";
import type { GenerationIntake, GenerationPlan } from "@/lib/builder/generation/types";

const stableSectionId = (pageId: string, type: string, index: number) => `${pageId}-${String(index + 1).padStart(2, "0")}-${type}`;

export function buildSkeleton(plan: GenerationPlan, intake: GenerationIntake): SkeletonSiteDocument {
  const template = getTemplateById(plan.templateId);
  if (!template) {
    throw new Error(`Unknown template: ${plan.templateId}`);
  }

  const orderedTypes = plan.sectionOrder.length ? plan.sectionOrder : template.defaultSectionOrder;
  const pageId = "page-home";

  const sectionOrder = orderedTypes.slice(0, 10);
  const sections = sectionOrder.map((type, index) => ({
    sectionId: stableSectionId(pageId, type, index),
    type,
    variant: plan.variants[type] ?? template.allowedVariants[type][0] ?? "A",
    enabled: true,
    spacingProfile: plan.spacingProfile,
    alignmentProfile: plan.alignmentProfile,
    tokenSetId: plan.tokenSetId,
    content: null
  }));

  const skeleton = {
    templateId: plan.templateId as any,
    toneProfile: intake.toneProfile,
    tokenSetId: plan.tokenSetId,
    spacingProfile: plan.spacingProfile,
    alignmentProfile: plan.alignmentProfile,
    pages: [
      {
        pageId,
        slug: "home",
        title: "Home",
        sections
      }
    ]
  };

  return SkeletonSiteDocumentSchema.parse(skeleton);
}
