import { GenerationSiteDocumentSchema, type GenerationSiteDocument, type SkeletonSiteDocument } from "@/lib/builder/generation/schemas/site";
import {
  SectionContentSchemaByType,
  type SectionType,
  type StrictSection
} from "@/lib/builder/generation/schemas/sections";
import { BANNED_PHRASE_LABELS } from "@/lib/builder/generation/bannedCopy";
import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import type { GenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationIntake } from "@/lib/builder/generation/types";

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const trimChars = (value: string, max: number) => value.slice(0, max).trim();

const ensureWordRange = (value: string, min: number, max: number) => {
  const tokens = words(value);
  if (tokens.length < min) {
    const filler = ["for", "your", "local", "needs", "today"];
    while (tokens.length < min) {
      tokens.push(filler[(tokens.length - min + filler.length) % filler.length]);
    }
  }
  if (tokens.length > max) {
    tokens.splice(max);
  }
  return tokens.join(" ");
};

const ctaLabelByIntent: Record<GenerationIntake["ctaIntent"], string> = {
  contact: "Contact Us",
  call: "Call Now",
  quote: "Get a Quote",
  reserve: "Reserve Now",
  buy: "Buy Now",
  demo: "Book a Demo"
};

const ctaHrefByIntent: Record<GenerationIntake["ctaIntent"], string> = {
  contact: "#contact",
  call: "tel:+10000000000",
  quote: "#contact",
  reserve: "#contact",
  buy: "#contact",
  demo: "#contact"
};

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const compactLocation = (location?: string | null) => {
  if (!location) return "your area";
  return location.split(",")[0]?.trim() || "your area";
};

const primaryService = (intake: GenerationIntake) => {
  const raw = intake.services[0] ?? intake.businessType;
  return toTitleCase(raw.replace(/\s+/g, " ").trim());
};

const serviceBenefitLine = (intake: GenerationIntake) => {
  const industry = intake.businessType.toLowerCase();
  if (industry.includes("clinic") || industry.includes("dental") || industry.includes("medical")) {
    return "clear treatment steps, transparent recommendations, and appointments that start on time";
  }
  if (industry.includes("restaurant") || industry.includes("cafe") || industry.includes("hospitality")) {
    return "fast reservations, clear menu guidance, and a welcoming visit from arrival through checkout";
  }
  if (industry.includes("consulting") || industry.includes("agency") || industry.includes("software")) {
    return "practical strategy, concise updates, and measurable milestones your team can track";
  }
  if (
    industry.includes("home") ||
    industry.includes("plumbing") ||
    industry.includes("hvac") ||
    industry.includes("electrical") ||
    industry.includes("landscaping")
  ) {
    return "prompt scheduling, clear scope before work starts, and clean handoff at completion";
  }
  return "clear communication, realistic timelines, and dependable follow-through at every step";
};

const fallbackContent = (sectionType: SectionType, intake: GenerationIntake, variant: string) => {
  const serviceTitle = primaryService(intake);
  const location = compactLocation(intake.location);
  const target = intake.targetCustomer ?? "local customers";
  const benefitLine = serviceBenefitLine(intake);
  const headline = ensureWordRange(
    `${serviceTitle} in ${location} You Can Book Today`,
    5,
    10
  );
  const subhead = ensureWordRange(
    `${intake.businessName} helps ${target} with ${serviceTitle.toLowerCase()}, ${benefitLine}, and clear next steps from first call to completion.`,
    14,
    28
  );

  switch (sectionType) {
    case "hero":
      return {
        headline: trimChars(headline, 60),
        subhead: trimChars(subhead, 160),
        primaryCta: {
          label: ctaLabelByIntent[intake.ctaIntent],
          href: ctaHrefByIntent[intake.ctaIntent],
          action: intake.ctaIntent
        },
        image: {
          slotId: "hero-main",
          query: `${intake.businessType} ${serviceTitle} ${location} storefront`,
          alt: `${intake.businessName} ${serviceTitle} hero image`
        }
      };
    case "about":
      return {
        title: trimChars(`Why ${intake.businessName}`, 56),
        body: trimChars(
          `${intake.businessName} supports ${target} in ${location} with ${serviceTitle.toLowerCase()} focused on ${benefitLine}. We explain options clearly, confirm scope early, and keep communication simple.`,
          260
        )
      };
    case "services":
      return {
        title: "What We Offer",
        items: (intake.services.length ? intake.services : ["Consultation", "Delivery", "Support"])
          .slice(0, 3)
          .map((item) => ({
            title: trimChars(ensureWordRange(toTitleCase(item), 2, 5), 40),
            body: trimChars(
              ensureWordRange(
                `${toTitleCase(item)} with clear scope, proactive updates, and practical timing for ${target} in ${location}.`,
                10,
                20
              ),
              140
            )
          }))
      };
    case "testimonials":
      return {
        title: "Client Feedback",
        items: [
          {
            quote: trimChars(
              ensureWordRange(
                "Verified client feedback highlights clear communication, punctual delivery, and outcomes aligned with the agreed scope.",
                12,
                28
              ),
              220
            ),
            name: "Verified Customer",
            role: location
          }
        ]
      };
    case "gallery":
      return {
        title: "Recent Work",
        items: Array.from({ length: 3 }).map((_, index) => ({
          slotId: `gallery-${index + 1}`,
          query: `${intake.businessType} ${serviceTitle} ${location} project photo`,
          alt: `${intake.businessName} project ${index + 1}`
        }))
      };
    case "pricing":
      return {
        title: "Pricing Options",
        plans: [
          { name: "Starter", price: "Custom Quote", description: "Scope-based estimate after a short requirements call." },
          { name: "Standard", price: "Custom Quote", description: "Expanded support package with documented deliverables." }
        ]
      };
    case "faq":
      return {
        title: "Common Questions",
        items: [
          {
            question: trimChars(ensureWordRange(`How soon can we start ${serviceTitle.toLowerCase()}`, 5, 12), 110),
            answer: trimChars(
              ensureWordRange(
                "Most requests can start within a few business days once scope, scheduling, and contact details are confirmed together.",
                12,
                35
              ),
              240
            )
          },
          {
            question: trimChars(ensureWordRange("Do you offer options for different budgets and goals", 5, 12), 110),
            answer: trimChars(
              ensureWordRange(
                "Yes, scope and delivery are adjusted to match your priorities, timeline, and constraints before work begins.",
                12,
                35
              ),
              240
            )
          }
        ]
      };
    case "cta":
      return {
        title: trimChars(
          ensureWordRange(`Start ${serviceTitle} With ${intake.businessName}`, 3, 8),
          70
        ),
        body: trimChars(
          ensureWordRange(
            `Share your goals and timeline, and we will map the most practical next step for ${serviceTitle.toLowerCase()}.`,
            10,
            22
          ),
          170
        ),
        primaryCta: {
          label: ctaLabelByIntent[intake.ctaIntent],
          href: ctaHrefByIntent[intake.ctaIntent],
          action: intake.ctaIntent
        }
      };
    case "contact":
      return {
        title: "Contact",
        body: "Send a few details and we will follow up with clear next steps.",
        ...(intake.location ? { address: intake.location } : {})
      };
    case "footer":
      return {
        line: trimChars(
          ensureWordRange(`Serving ${location} with reliable ${serviceTitle}`, 3, 10),
          80
        )
      };
    default:
      return {};
  }
};

const SECTION_LIMITS = `
Copy limits:
- Hero headline: 5-10 words and <= 60 chars
- Hero subhead: 14-28 words and <= 160 chars
- Service item title: 2-5 words
- Service item body: 10-20 words
- Testimonial quote: 12-28 words
- CTA title: 3-8 words
- CTA body: 10-22 words
- FAQ question: 5-12 words
- FAQ answer: 12-35 words
- Footer line: <= 10 words
`;

async function generateSectionContent(
  openai: any,
  intake: GenerationIntake,
  policy: GenerationPolicy,
  sectionType: SectionType,
  variant: string,
  schema: any,
  errorHints: string[] = []
) {
  const prompt = [
    "Generate content for one website section.",
    `businessSummary: ${intake.businessName} | ${intake.businessType} | ${intake.description}`,
    `toneProfile: ${intake.toneProfile}`,
    `sectionType: ${sectionType}`,
    `variant: ${variant}`,
    `location: ${intake.location ?? ""}`,
    `targetCustomer: ${intake.targetCustomer ?? ""}`,
    `services: ${JSON.stringify(intake.services)}`,
    `proofAssetsCount: ${intake.proofAssets.length}`,
    SECTION_LIMITS,
    `requiredKeysSchema: ${JSON.stringify(schema.shape ?? {})}`,
    `bannedPhrases: ${JSON.stringify(BANNED_PHRASE_LABELS)}`,
    "Never fabricate hours, pricing specifics, or testimonials.",
    "Use concrete service/location terms from the input, not vague marketing language.",
    "If unknown, omit optional fields.",
    "Return JSON only."
  ]
    .concat(errorHints.length ? [`Fix these validation errors: ${errorHints.join(" | ")}`] : [])
    .join("\n");

  return runStrictJsonWithRetry(openai, {
    schema,
    userPrompt: prompt,
    systemPrompt: "You are a strict section content generator.",
    temperature: policy.fillTemperature,
    label: `fill-${sectionType}`
  });
}

export async function fillSkeletonSections(
  skeleton: SkeletonSiteDocument,
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any
): Promise<GenerationSiteDocument> {
  const pages = [];

  for (const page of skeleton.pages) {
    const sections: StrictSection[] = [];
    for (const section of page.sections) {
      const sectionSchema = SectionContentSchemaByType[section.type];
      const defaultContent = fallbackContent(section.type, intake, section.variant);

      if (section.type === "testimonials" && intake.proofAssets.length === 0) {
        sections.push({
          ...section,
          enabled: false,
          content: sectionSchema.parse(defaultContent)
        } as StrictSection);
        continue;
      }

      const aiContent = await generateSectionContent(
        openai,
        intake,
        policy,
        section.type,
        section.variant,
        sectionSchema
      );
      const content = sectionSchema.parse(aiContent ?? defaultContent);
      sections.push({
        ...section,
        content
      } as StrictSection);
    }

    pages.push({
      ...page,
      sections
    });
  }

  return GenerationSiteDocumentSchema.parse({
    ...skeleton,
    toneProfile: intake.toneProfile,
    pages
  });
}

export async function regenerateSingleSectionContent(
  section: StrictSection,
  intake: GenerationIntake,
  policy: GenerationPolicy,
  openai: any,
  errors: string[]
) {
  const schema = SectionContentSchemaByType[section.type];
  const fallback = fallbackContent(section.type, intake, section.variant);
  const generated = await generateSectionContent(
    openai,
    intake,
    policy,
    section.type,
    section.variant,
    schema,
    errors
  );
  return schema.parse(generated ?? fallback);
}
