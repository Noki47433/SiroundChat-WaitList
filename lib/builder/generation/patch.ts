import { SectionContentSchemaByType, SectionTypeSchema, type StrictSection } from "@/lib/builder/generation/schemas/sections";
import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import type { GenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationIntake } from "@/lib/builder/generation/types";
import type { SiteSection } from "@/lib/website-builder/types";

const PatchEnvelopeSchema = {
  hero: SectionContentSchemaByType.hero,
  about: SectionContentSchemaByType.about,
  services: SectionContentSchemaByType.services,
  testimonials: SectionContentSchemaByType.testimonials,
  gallery: SectionContentSchemaByType.gallery,
  pricing: SectionContentSchemaByType.pricing,
  faq: SectionContentSchemaByType.faq,
  cta: SectionContentSchemaByType.cta,
  contact: SectionContentSchemaByType.contact,
  footer: SectionContentSchemaByType.footer
} as const;

type SupportedSectionType = keyof typeof PatchEnvelopeSchema;

const supportedTypeSet = new Set(SectionTypeSchema.options as string[]);

const spacingFromLegacy = (value: SiteSection["style"]["spacing"]) => {
  if (value === "compact") return "compact" as const;
  if (value === "normal") return "normal" as const;
  return "balanced" as const;
};

const toStrictSection = (section: SiteSection): StrictSection | null => {
  if (!supportedTypeSet.has(section.type)) return null;
  const type = section.type as SupportedSectionType;

  const base = {
    sectionId: section.id,
    type,
    variant: section.variant,
    enabled: section.enabled,
    spacingProfile: spacingFromLegacy(section.style.spacing),
    alignmentProfile: section.style.alignment,
    tokenSetId: "service-clean" as const,
    images: (section.images ?? []).map((image) => ({
      slot: image.slot,
      src: image.src,
      alt: image.alt ?? "Section image",
      width: image.width,
      height: image.height,
      query: image.query
    }))
  };

  if (type === "hero") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        headline: String((section.content as any)?.headline ?? ""),
        subhead: String((section.content as any)?.subheadline ?? ""),
        primaryCta: {
          label: String((section.content as any)?.ctaLabel ?? "Contact Us"),
          href: String((section.content as any)?.ctaHref ?? "#contact"),
          action: "contact"
        }
      }
    } as StrictSection;
  }

  if (type === "about") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "About"),
        body: String((section.content as any)?.body ?? "")
      }
    } as StrictSection;
  }

  if (type === "services") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Services"),
        items: Array.isArray((section.content as any)?.items) ? (section.content as any).items : []
      }
    } as StrictSection;
  }

  if (type === "testimonials") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Testimonials"),
        items: Array.isArray((section.content as any)?.items) ? (section.content as any).items : []
      }
    } as StrictSection;
  }

  if (type === "gallery") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Gallery"),
        items: Array.isArray((section.content as any)?.items) ? (section.content as any).items : []
      }
    } as StrictSection;
  }

  if (type === "pricing") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Pricing"),
        plans: Array.isArray((section.content as any)?.plans) ? (section.content as any).plans : []
      }
    } as StrictSection;
  }

  if (type === "faq") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "FAQ"),
        items: Array.isArray((section.content as any)?.items) ? (section.content as any).items : []
      }
    } as StrictSection;
  }

  if (type === "cta") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Ready to start?"),
        body: String((section.content as any)?.body ?? ""),
        primaryCta: {
          label: String((section.content as any)?.ctaLabel ?? "Contact Us"),
          href: String((section.content as any)?.ctaHref ?? "#contact"),
          action: "contact"
        }
      }
    } as StrictSection;
  }

  if (type === "contact") {
    return {
      ...base,
      type,
      variant: (section.variant as any) ?? "A",
      content: {
        title: String((section.content as any)?.title ?? "Contact"),
        body: String((section.content as any)?.body ?? ""),
        email: (section.content as any)?.email,
        phone: (section.content as any)?.phone,
        address: (section.content as any)?.address
      }
    } as StrictSection;
  }

  return {
    ...base,
    type: "footer",
    variant: (section.variant as any) ?? "A",
    content: {
      line: String((section.content as any)?.text ?? "")
    }
  } as StrictSection;
};

const mergePatchIntoLegacyContent = (section: SiteSection, strictPatch: any) => {
  if (section.type === "hero") {
    return {
      ...section.content,
      headline: strictPatch.headline,
      subheadline: strictPatch.subhead,
      ctaLabel: strictPatch.primaryCta?.label,
      ctaHref: strictPatch.primaryCta?.href
    };
  }
  if (section.type === "cta") {
    return {
      ...section.content,
      title: strictPatch.title,
      body: strictPatch.body,
      ctaLabel: strictPatch.primaryCta?.label,
      ctaHref: strictPatch.primaryCta?.href
    };
  }
  if (section.type === "footer") {
    return {
      ...section.content,
      text: strictPatch.line
    };
  }
  return {
    ...section.content,
    ...strictPatch
  };
};

export async function buildSectionPatch(
  section: SiteSection,
  instruction: string,
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any
): Promise<Record<string, unknown> | null> {
  const strictSection = toStrictSection(section);
  if (!strictSection) return null;

  const sectionSchema = PatchEnvelopeSchema[strictSection.type];
  const prompt = [
    "Edit one website section.",
    "Return JSON only.",
    `sectionType: ${strictSection.type}`,
    `variant: ${strictSection.variant}`,
    `instruction: ${instruction}`,
    `businessSummary: ${intake.businessName} | ${intake.businessType} | ${intake.description}`,
    `toneProfile: ${intake.toneProfile}`,
    `currentContent: ${JSON.stringify(strictSection.content)}`
  ].join("\n");

  const patched = await runStrictJsonWithRetry(openai, {
    schema: sectionSchema as any,
    userPrompt: prompt,
    systemPrompt: "You return strict JSON patches for a single section.",
    temperature: policy.fillTemperature,
    label: `patch-${strictSection.type}`
  });

  if (!patched) return null;
  return mergePatchIntoLegacyContent(section, patched);
}
