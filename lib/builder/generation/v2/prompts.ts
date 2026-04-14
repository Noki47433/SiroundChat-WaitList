import type { ArchitectureCandidate, SectionDraft, TemplateGenerationInput } from "@/lib/builder/generation/v2/types";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);

export const INDUSTRY_V2_SYSTEM_PROMPT = `You are the SiroundChat local-business website generator.

Your job is to rewrite website section copy so it feels like a real launch-worthy starter site for a small business owner.

Hard rules:
- Respect the business industry, archetype, and section purpose.
- Never use SaaS copy on local business websites.
- Never fabricate named testimonials, patient stories, or listings that imply real inventory if none were provided.
- Headings must feel brand-specific, short, and useful.
- Supporting copy must be concise, concrete, and conversion-aware.
- Keep the JSON shape exactly the same. Do not add or remove sections.
- Rewrite only the copy. Do not alter URLs, ids, or image references.
- Return one valid JSON object only.`;

export const buildIndustryV2UserPrompt = (args: {
  input: TemplateGenerationInput;
  architecture: ArchitectureCandidate;
  draftSections: SectionDraft[];
}) => {
  const { input, architecture, draftSections } = args;
  return [
    "Rewrite the section copy for this site draft.",
    "",
    "Business context:",
    stringify({
      businessName: input.businessName,
      industry: architecture.industry.label,
      description: input.description,
      audience: architecture.facts.audience,
      coreOffer: architecture.facts.coreOffer,
      services: architecture.facts.topServices,
      proofPoints: architecture.facts.proofPoints,
      location: architecture.facts.locationLabel,
      tone: input.tone,
      language: input.language
    }),
    "",
    "Industry rules:",
    stringify({
      goals: architecture.industry.primaryConversionGoals,
      contentRules: architecture.industry.contentRules,
      trustPatterns: architecture.industry.trustPatterns,
      ctaPatterns: architecture.industry.ctaPatterns,
      mustHaveInformation: architecture.industry.mustHaveInformation,
      avoid: architecture.industry.toneConstraints.avoid
    }),
    "",
    "Brand archetype:",
    stringify({
      label: architecture.archetype.label,
      tone: architecture.archetype.tone,
      mood: architecture.archetype.mood,
      headlineStyle: architecture.archetype.headlineStyle,
      trustStyle: architecture.archetype.trustStyle,
      proofStyle: architecture.archetype.proofStyle,
      contentFlavor: architecture.archetype.contentFlavor
    }),
    "",
    "Layout DNA:",
    stringify({
      label: architecture.layout.label,
      heroVariant: architecture.layout.heroVariant,
      sectionRhythm: architecture.layout.sectionRhythm,
      spacing: architecture.layout.spacing,
      alignment: architecture.layout.alignment,
      imageUsage: architecture.layout.imageUsage,
      ctaPlacement: architecture.layout.ctaPlacement,
      contrastNotes: architecture.layout.contrastNotes
    }),
    "",
    "Draft sections to rewrite:",
    stringify({ sections: draftSections.map((section) => ({ id: section.blueprintId, legacyType: section.legacyType, label: section.label, purpose: section.purpose, conversionRole: section.conversionRole, content: section.content })) }),
    "",
    "Output format:",
    stringify({ sections: draftSections.map((section) => ({ id: section.blueprintId, content: section.content })) }),
    "",
    "Reminder: keep the same keys and overall shape, but improve specificity, personality, and usefulness."
  ].join("\n");
};
