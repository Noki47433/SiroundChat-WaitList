import { z } from "zod";
import { TOKEN_SET_IDS, type TokenSetId, type SpacingProfile } from "@/lib/builder/design/tokens";
import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import type { GenerationPolicy } from "@/lib/builder/generation/policy";
import { SectionTypeSchema, type SectionType } from "@/lib/builder/generation/schemas/sections";
import {
  getTemplateById,
  pickTemplateForNiche,
  TEMPLATE_IDS,
  TEMPLATE_REGISTRY,
  type TemplateDefinition
} from "@/lib/builder/generation/templates/registry";
import type { GenerationIntake, GenerationPlan } from "@/lib/builder/generation/types";

const PlanSchema = z
  .object({
    templateId: z.enum(TEMPLATE_IDS),
    sectionOrder: z.array(SectionTypeSchema).min(1).max(10),
    variants: z.record(SectionTypeSchema, z.string()),
    tokenSetId: z.enum(TOKEN_SET_IDS),
    spacingProfile: z.enum(["compact", "normal", "balanced"]),
    alignmentProfile: z.enum(["left", "center"])
  })
  .strict();

const baseVariantForType = (template: TemplateDefinition, type: SectionType) => {
  const list = template.allowedVariants[type];
  return list[0] ?? "A";
};

const isImageDependentHeroVariant = (template: TemplateDefinition, variant: string) => {
  const slots = template.requiredImageSlots.hero?.[variant] ?? [];
  return slots.length > 0;
};

const dedupe = <T,>(value: T[]) => {
  const seen = new Set<T>();
  return value.filter((entry) => {
    if (seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
};

const relativeLuminance = (hex: string) => {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const channels = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16) / 255);
  const adjusted = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * adjusted[0] + 0.7152 * adjusted[1] + 0.0722 * adjusted[2];
};

const canAssureImageContrast = (tokenSetId: TokenSetId) => {
  const lookup: Record<TokenSetId, string> = {
    "service-clean": "#0F172A",
    "restaurant-warm": "#7C2D12",
    "consulting-sharp": "#111827",
    "studio-editorial": "#1F2937",
    "clinic-calm": "#0F766E",
    "fitness-boost": "#1E1B4B",
    "legal-trust": "#1F2937",
    "home-trades": "#1E3A8A"
  };
  const luminance = relativeLuminance(lookup[tokenSetId]);
  return luminance < 0.4;
};

const TOKEN_AFFINITY_BY_NICHE: Array<{ includes: string[]; tokenSetId: TokenSetId }> = [
  { includes: ["restaurant", "cafe", "hospitality"], tokenSetId: "restaurant-warm" },
  { includes: ["clinic", "dental", "medical"], tokenSetId: "clinic-calm" },
  { includes: ["portfolio", "fashion", "studio", "creative"], tokenSetId: "studio-editorial" },
  { includes: ["consulting", "agency", "software"], tokenSetId: "consulting-sharp" },
  { includes: ["legal", "law", "attorney"], tokenSetId: "legal-trust" },
  { includes: ["plumbing", "hvac", "electrical", "landscaping", "home"], tokenSetId: "home-trades" }
];

const detectNicheTokenAffinity = (intake: GenerationIntake): TokenSetId | null => {
  const haystack = `${intake.businessType} ${intake.subtype ?? ""}`.toLowerCase();
  for (const entry of TOKEN_AFFINITY_BY_NICHE) {
    if (entry.includes.some((token) => haystack.includes(token))) {
      return entry.tokenSetId;
    }
  }
  return null;
};

const chooseSpacingProfile = (policy: GenerationPolicy): SpacingProfile => {
  if (policy.conversion_first) return "compact";
  if (policy.brand_editorial) return "balanced";
  return "normal";
};

const chooseAlignment = (policy: GenerationPolicy): "left" | "center" => {
  return policy.conversion_first ? "left" : "center";
};

const rankPlan = (
  plan: GenerationPlan,
  template: TemplateDefinition,
  intake: GenerationIntake,
  policy: GenerationPolicy
) => {
  let score = 0;
  const includes = new Set(plan.sectionOrder);
  const tokenAffinity = detectNicheTokenAffinity(intake);

  if (includes.has("hero")) score += 8;
  if (includes.has("services")) score += 6;
  if (includes.has("cta")) score += 5;
  if (includes.has("contact")) score += 8;
  if (includes.has("footer")) score += 8;
  if (includes.has("about")) score += 3;
  if (includes.has("faq")) score += 2;
  if (includes.has("testimonials")) score += intake.proofAssets.length > 0 ? 2 : -2;

  if (plan.sectionOrder[0] === "hero") score += 6;
  if (plan.sectionOrder.length <= 8) score += 2;

  if (policy.conversion_first) {
    if (plan.spacingProfile === "compact") score += 4;
    if (plan.alignmentProfile === "left") score += 3;
    if (plan.variants.hero === "A") score += 5;
    if (plan.variants.cta === "A") score += 2;
    if (plan.variants.contact === "A") score += 2;
  }

  if (policy.brand_editorial) {
    if (plan.spacingProfile === "balanced") score += 4;
    if (!policy.conversion_first && plan.alignmentProfile === "center") score += 2;
    if (intake.photosAvailable && plan.variants.hero && isImageDependentHeroVariant(template, plan.variants.hero)) {
      score += 4;
    }
  }

  if (!intake.photosAvailable && plan.variants.hero && isImageDependentHeroVariant(template, plan.variants.hero)) {
    score -= 8;
  }

  if (tokenAffinity && plan.tokenSetId === tokenAffinity) score += 5;
  if (!tokenAffinity && plan.tokenSetId === template.defaultTokenSetId) score += 2;

  return score;
};

const signature = (plan: GenerationPlan) =>
  JSON.stringify({
    templateId: plan.templateId,
    sectionOrder: plan.sectionOrder,
    variants: plan.variants,
    tokenSetId: plan.tokenSetId,
    spacingProfile: plan.spacingProfile,
    alignmentProfile: plan.alignmentProfile
  });

const deterministicDefaultPlan = (
  intake: GenerationIntake,
  policy: GenerationPolicy,
  template = pickTemplateForNiche(intake.businessType, intake.subtype)
): GenerationPlan => {
  const sectionOrder = dedupe(template.defaultSectionOrder).slice(0, 10);
  const variants = sectionOrder.reduce<Partial<Record<SectionType, string>>>((acc, type) => {
    acc[type] = baseVariantForType(template, type);
    return acc;
  }, {});

  if (policy.brand_editorial && intake.photosAvailable) {
    if ((template.allowedVariants.hero as string[]).includes("B")) {
      variants.hero = "B";
    }
  }

  if (policy.conversion_first) {
    variants.hero = "A";
    variants.services = "A";
    variants.cta = "A";
    variants.contact = "A";
  }

  if (!intake.photosAvailable && variants.hero && isImageDependentHeroVariant(template, variants.hero)) {
    variants.hero = "A";
  }

  const tokenSetId = template.defaultTokenSetId;
  if (variants.hero && isImageDependentHeroVariant(template, variants.hero) && !canAssureImageContrast(tokenSetId)) {
    variants.hero = "A";
  }

  const spacingProfile = chooseSpacingProfile(policy);
  const alignmentProfile = chooseAlignment(policy);

  return {
    templateId: template.templateId,
    sectionOrder,
    variants,
    tokenSetId,
    spacingProfile,
    alignmentProfile
  };
};

const normalizePlan = (
  plan: GenerationPlan,
  intake: GenerationIntake,
  policy: GenerationPolicy
): GenerationPlan => {
  const template = getTemplateById(plan.templateId) ?? pickTemplateForNiche(intake.businessType, intake.subtype);
  const sectionOrder = dedupe(plan.sectionOrder).filter((type) => template.defaultSectionOrder.includes(type)).slice(0, 10);
  const finalOrder = sectionOrder.length ? sectionOrder : template.defaultSectionOrder.slice(0, 10);

  const nextVariants = finalOrder.reduce<Partial<Record<SectionType, string>>>((acc, type) => {
    const allowed = template.allowedVariants[type] as string[];
    const requested = plan.variants[type];
    acc[type] = requested && allowed.includes(requested) ? requested : baseVariantForType(template, type);
    return acc;
  }, {});

  if (!intake.photosAvailable && nextVariants.hero && isImageDependentHeroVariant(template, nextVariants.hero)) {
    nextVariants.hero = "A";
  }

  if (policy.conversion_first) {
    nextVariants.hero = "A";
    nextVariants.services = "A";
    nextVariants.cta = "A";
    nextVariants.contact = "A";
  }

  if (nextVariants.hero && isImageDependentHeroVariant(template, nextVariants.hero) && !canAssureImageContrast(plan.tokenSetId)) {
    nextVariants.hero = "A";
  }

  return {
    ...plan,
    templateId: template.templateId,
    tokenSetId: TOKEN_SET_IDS.includes(plan.tokenSetId) ? plan.tokenSetId : template.defaultTokenSetId,
    spacingProfile: plan.spacingProfile,
    alignmentProfile: plan.alignmentProfile,
    sectionOrder: finalOrder,
    variants: nextVariants
  };
};

const buildTemplateCandidates = (intake: GenerationIntake, policy: GenerationPolicy): GenerationPlan[] => {
  const haystack = `${intake.businessType} ${intake.subtype ?? ""}`.toLowerCase();
  const primary = pickTemplateForNiche(intake.businessType, intake.subtype);
  const matched = TEMPLATE_REGISTRY.filter((template) =>
    template.allowedNiches.some((niche) => haystack.includes(niche.toLowerCase()))
  );
  const backups = TEMPLATE_REGISTRY.filter((template) => template.templateId !== primary.templateId).slice(0, 2);

  const templates = dedupe([
    primary,
    ...matched,
    ...backups
  ]).slice(0, 4);

  return templates.map((template) =>
    deterministicDefaultPlan(intake, policy, template)
  );
};

async function buildAiPlanCandidate(
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any
): Promise<GenerationPlan | null> {
  const fallback = deterministicDefaultPlan(intake, policy);
  const selectedTemplate = getTemplateById(fallback.templateId);
  if (!selectedTemplate) return null;

  const prompt = [
    "Plan a deterministic website generation configuration.",
    "Use allowlists only. Return JSON only.",
    `businessType: ${intake.businessType}`,
    `subtype: ${intake.subtype ?? ""}`,
    `location: ${intake.location ?? ""}`,
    `toneProfile: ${intake.toneProfile}`,
    `ctaIntent: ${intake.ctaIntent}`,
    `photosAvailable: ${String(intake.photosAvailable)}`,
    `proofAssetsCount: ${intake.proofAssets.length}`,
    `conversion_first: ${String(policy.conversion_first)}`,
    `brand_editorial: ${String(policy.brand_editorial)}`,
    `allowedTemplates: ${JSON.stringify(TEMPLATE_IDS)}`,
    `selectedTemplateDefault: ${selectedTemplate.templateId}`,
    `allowedSectionOrder: ${JSON.stringify(selectedTemplate.defaultSectionOrder)}`,
    `allowedVariants: ${JSON.stringify(selectedTemplate.allowedVariants)}`,
    `allowedTokenSetIds: ${JSON.stringify(TOKEN_SET_IDS)}`,
    "If photosAvailable is false, avoid image-dependent hero variants.",
    "If conversion_first is true, do not force stylistic variety.",
    "Output schema: {templateId,sectionOrder,variants,tokenSetId,spacingProfile,alignmentProfile}"
  ].join("\n");

  const generated = await runStrictJsonWithRetry(openai, {
    schema: PlanSchema,
    userPrompt: prompt,
    systemPrompt: "You are a strict JSON planner for website generation.",
    temperature: policy.planTemperature,
    label: "plan"
  });

  if (!generated) return null;
  return normalizePlan(generated, intake, policy);
}

export async function buildGenerationPlanCandidates(
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any,
  maxCandidates = 3
): Promise<GenerationPlan[]> {
  const candidates: GenerationPlan[] = [];
  const candidateSet = new Set<string>();

  const pushCandidate = (candidate: GenerationPlan | null) => {
    if (!candidate) return;
    const normalized = normalizePlan(candidate, intake, policy);
    const key = signature(normalized);
    if (candidateSet.has(key)) return;
    candidateSet.add(key);
    candidates.push(normalized);
  };

  pushCandidate(await buildAiPlanCandidate(intake, policy, openai));
  buildTemplateCandidates(intake, policy).forEach((candidate) => pushCandidate(candidate));
  pushCandidate(deterministicDefaultPlan(intake, policy));

  const ranked = candidates
    .map((candidate) => {
      const template = getTemplateById(candidate.templateId) ?? pickTemplateForNiche(intake.businessType, intake.subtype);
      return {
        candidate,
        score: rankPlan(candidate, template, intake, policy)
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);

  return ranked.slice(0, Math.max(1, Math.min(4, maxCandidates)));
}

export async function buildGenerationPlan(
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any
): Promise<GenerationPlan> {
  const [top] = await buildGenerationPlanCandidates(intake, policy, openai, 1);
  return top ?? deterministicDefaultPlan(intake, policy);
}
