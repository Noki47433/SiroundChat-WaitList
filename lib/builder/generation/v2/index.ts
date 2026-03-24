import { z } from "zod";
import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import { BRAND_ARCHETYPES } from "@/lib/builder/generation/v2/archetypes";
import { INDUSTRY_CONFIGS, detectSupportedIndustry } from "@/lib/builder/generation/v2/industry-config";
import { LAYOUT_DNA_REGISTRY } from "@/lib/builder/generation/v2/layout-dna";
import { buildIndustryV2UserPrompt, INDUSTRY_V2_SYSTEM_PROMPT } from "@/lib/builder/generation/v2/prompts";
import { SECTION_DEFINITIONS } from "@/lib/builder/generation/v2/section-definitions";
import { validateIndustrySite } from "@/lib/builder/generation/v2/validate";
import type {
  ArchitectureCandidate,
  BrandArchetypeConfig,
  IndustryFacts,
  LayoutDNA,
  LegacySectionType,
  SectionBlueprintId,
  SectionDraft,
  SectionEmphasis,
  TemplateGenerationInput,
  TemplateGenerationOutput,
  TemplateValidationReport
} from "@/lib/builder/generation/v2/types";
import type { SiteDocument, SiteImage, SiteSection, SiteThemeTokens } from "@/lib/website-builder/types";

const MODEL_REWRITE_SCHEMA = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      content: z.record(z.string(), z.any())
    })
  )
});

const INDUSTRY_TEMPLATE_IDS = {
  barbershop: "barbershop-editorial",
  restaurant: "restaurant-editorial",
  dental_clinic: "dental-assurance",
  real_estate: "real-estate-signature"
} as const;

const INDUSTRY_IMAGES: Record<string, string[]> = {
  barbershop: [
    "https://images.pexels.com/photos/1319461/pexels-photo-1319461.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/3998414/pexels-photo-3998414.jpeg?auto=compress&cs=tinysrgb&w=1600"
  ],
  restaurant: [
    "https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=1600"
  ],
  dental_clinic: [
    "https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/305565/pexels-photo-305565.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/4269697/pexels-photo-4269697.jpeg?auto=compress&cs=tinysrgb&w=1600"
  ],
  real_estate: [
    "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/1396132/pexels-photo-1396132.jpeg?auto=compress&cs=tinysrgb&w=1600"
  ]
};

const DEFAULT_CONTACT_HREF = "#contact";

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const pickBySeed = <T,>(items: T[], seed: string, offset = 0): T => {
  const safeItems = items.length ? items : [items[0] as T];
  return safeItems[(hashString(`${seed}:${offset}`) % safeItems.length + safeItems.length) % safeItems.length];
};

const uniq = <T,>(items: T[]) => Array.from(new Set(items));

const normalizeList = (items: Array<string | null | undefined>) =>
  uniq(
    items
      .map((item) => (item ?? "").trim())
      .filter(Boolean)
  );

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const shortLocation = (address?: string | null) => {
  if (!address?.trim()) return "your area";
  return address.split(",")[0]?.trim() || "your area";
};

const clamp = (value: string, max: number) => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trim()}...`;
};

const sentence = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const pickCtaLabel = (industryId: ArchitectureCandidate["industry"]["id"], primaryGoal: string) => {
  if (industryId === "restaurant") return primaryGoal.includes("reserve") ? "Reserve a table" : "Plan your visit";
  if (industryId === "barbershop") return "Book a cut";
  if (industryId === "dental_clinic") return "Book an assessment";
  if (industryId === "real_estate") return primaryGoal.includes("sell") ? "Ask for a valuation" : "Book a viewing";
  return "Get in touch";
};

const buildTheme = (archetype: BrandArchetypeConfig, input: TemplateGenerationInput): SiteThemeTokens => {
  const primary = input.primaryColor ?? archetype.palette.primary;
  const bg = input.secondaryColor ?? archetype.palette.background;
  const bodyFont = input.fontFamily?.trim() || archetype.fontPair.body;
  const headingFont = input.fontFamily?.trim() || archetype.fontPair.heading;

  return {
    primary,
    secondary: archetype.palette.secondary,
    bg,
    text: archetype.palette.text,
    muted: archetype.palette.muted,
    surface: archetype.palette.surface,
    border: archetype.palette.border,
    buttonText: archetype.palette.buttonText,
    accent: archetype.palette.accent,
    radius: archetype.contrast === "high" ? "lg" : "xl",
    fontHeading: headingFont,
    fontBody: bodyFont,
    pageTransitions: "fade",
    textStyles: {
      h1: {
        size: archetype.density === "airy" ? "4rem" : "3.4rem",
        weight: headingFont.includes("Playfair") ? 700 : 650,
        lineHeight: archetype.density === "airy" ? "1.04" : "1.08",
        letterSpacing: headingFont.includes("Playfair") ? "-0.02em" : "-0.03em"
      },
      h2: {
        size: archetype.density === "airy" ? "2.5rem" : "2.2rem",
        weight: headingFont.includes("Playfair") ? 650 : 620,
        lineHeight: "1.12",
        letterSpacing: "-0.02em"
      },
      h3: {
        size: "1.45rem",
        weight: 600,
        lineHeight: "1.24",
        letterSpacing: "-0.01em"
      },
      body: {
        size: archetype.density === "compact" ? "0.98rem" : "1.04rem",
        weight: 400,
        lineHeight: "1.68",
        letterSpacing: "0"
      },
      caption: {
        size: "0.82rem",
        weight: 500,
        lineHeight: "1.5",
        letterSpacing: "0.16em"
      }
    }
  };
};

const buildFacts = (industryId: keyof typeof INDUSTRY_TEMPLATE_IDS, input: TemplateGenerationInput): IndustryFacts => {
  const topServices = normalizeList([
    ...input.brief.topServices,
    ...(input.services ?? []),
    input.brief.coreOffer
  ]);
  const proofPoints = normalizeList([...input.brief.proofPoints, ...input.proofPoints]);
  const locationLabel = shortLocation(input.contact?.address);

  const defaults: Record<typeof industryId, Partial<IndustryFacts>> = {
    barbershop: {
      topServices: topServices.length ? topServices : ["Skin fades", "Beard detail", "Hot towel finish"],
      menuHighlights: [],
      treatmentHighlights: [],
      listingHighlights: [],
      reservationIntent: "",
      bookingIntent: "Book a cut",
      inquiryIntent: "Ask about availability"
    },
    restaurant: {
      topServices: topServices.length ? topServices : ["Signature plates", "House grill", "Dessert board"],
      menuHighlights: topServices.length ? topServices : ["Chef favorites", "Share plates", "Late dinner specials"],
      treatmentHighlights: [],
      listingHighlights: [],
      reservationIntent: "Reserve a table",
      bookingIntent: "Reserve a table",
      inquiryIntent: "Ask about tonight"
    },
    dental_clinic: {
      topServices: topServices.length ? topServices : ["Preventive care", "Cosmetic treatments", "Restorative dentistry"],
      menuHighlights: [],
      treatmentHighlights: topServices.length ? topServices : ["Exams and hygiene", "Whitening", "Restorative care"],
      listingHighlights: [],
      reservationIntent: "",
      bookingIntent: "Book an assessment",
      inquiryIntent: "Talk to the clinic"
    },
    real_estate: {
      topServices: topServices.length ? topServices : ["Buyer search", "Seller strategy", "Local market guidance"],
      menuHighlights: [],
      treatmentHighlights: [],
      listingHighlights: topServices.length ? topServices : ["City apartments", "Family homes", "Investment properties"],
      reservationIntent: "",
      bookingIntent: "Book a viewing",
      inquiryIntent: "Ask about a property"
    }
  };

  return {
    industryId,
    locationLabel,
    audience: input.brief.audience || input.targetCustomer || `people in ${locationLabel}`,
    coreOffer: input.brief.coreOffer || input.description,
    primaryGoal: input.brief.primaryCtaGoal || "contact",
    topServices: defaults[industryId].topServices as string[],
    proofPoints,
    menuHighlights: defaults[industryId].menuHighlights as string[],
    treatmentHighlights: defaults[industryId].treatmentHighlights as string[],
    listingHighlights: defaults[industryId].listingHighlights as string[],
    reservationIntent: defaults[industryId].reservationIntent as string,
    bookingIntent: defaults[industryId].bookingIntent as string,
    inquiryIntent: defaults[industryId].inquiryIntent as string
  };
};

const toneScore = (archetype: BrandArchetypeConfig, input: TemplateGenerationInput) => {
  const haystack = `${input.tone} ${input.description} ${input.brief.tone} ${input.brief.coreOffer}`.toLowerCase();
  const flavorMatches = archetype.contentFlavor.filter((flavor) => haystack.includes(flavor.toLowerCase())).length;
  const luxuryBoost = haystack.includes("lux") || haystack.includes("premium") ? 2 : 0;
  const calmBoost = haystack.includes("calm") || haystack.includes("friendly") ? 2 : 0;
  const fastBoost = haystack.includes("fast") || haystack.includes("quick") ? 2 : 0;
  let score = flavorMatches * 3;
  if (archetype.id.includes("premium") || archetype.id.includes("luxury")) score += luxuryBoost;
  if (archetype.id.includes("calm") || archetype.id.includes("family")) score += calmBoost;
  if (archetype.id.includes("urban") || archetype.id.includes("fast")) score += fastBoost;
  return score;
};

const buildArchitectureCandidates = (input: TemplateGenerationInput) => {
  const industryId = detectSupportedIndustry(input.industry, input.subtype, input.description);
  if (!industryId) return [] as ArchitectureCandidate[];

  const industry = INDUSTRY_CONFIGS[industryId];
  const facts = buildFacts(industryId, input);
  const archetypes = BRAND_ARCHETYPES
    .filter((item) => item.industryId === industryId)
    .sort((left, right) => toneScore(right, input) - toneScore(left, input));

  const seed = `${input.businessName}:${input.industry}:${input.description}`;
  const layouts = LAYOUT_DNA_REGISTRY.filter((layout) => layout.compatibleIndustries.includes(industryId));

  const candidates = archetypes.flatMap((archetype, archetypeIndex) => {
    const preferredLayouts = layouts.filter((layout) => archetype.preferredLayoutIds.includes(layout.id));
    const layoutPool = preferredLayouts.length ? preferredLayouts : layouts;
    return layoutPool.map((layout, layoutIndex) => {
      const sectionOrder = pickBySeed(industry.preferredSectionStacks, `${seed}:${archetype.id}:${layout.id}`, layoutIndex)
        .filter((sectionId) => industry.allowedSections.includes(sectionId));
      const sections = sectionOrder.map((sectionId) => SECTION_DEFINITIONS[sectionId]);
      const theme = buildTheme(archetype, input);
      const score = 60 + toneScore(archetype, input) + (archetype.preferredLayoutIds.includes(layout.id) ? 8 : 0) + (layoutIndex === 0 ? 3 : 0) + (archetypeIndex === 0 ? 4 : 0);
      return {
        industry,
        archetype,
        layout,
        sections,
        sectionOrder,
        theme,
        facts,
        score
      } satisfies ArchitectureCandidate;
    });
  });

  return candidates.sort((left, right) => right.score - left.score);
};

const sectionAllowed = (candidate: ArchitectureCandidate, blueprintId: SectionBlueprintId, input: TemplateGenerationInput) => {
  const definition = SECTION_DEFINITIONS[blueprintId];
  if (!definition) return false;
  if (!candidate.industry.allowedSections.includes(blueprintId)) return false;
  if (definition.includeRules.requiresProof && candidate.facts.proofPoints.length === 0) return false;
  if (definition.excludeRules?.whenNoProof && candidate.facts.proofPoints.length === 0) return false;
  if (definition.includeRules.requiresAddress && !input.contact?.address) return false;
  if ((definition.includeRules.minServices ?? 0) > candidate.facts.topServices.length) return false;
  return true;
};

const imageForIndustry = (industryId: ArchitectureCandidate["industry"]["id"], seed: string, offset = 0): SiteImage => {
  const images = INDUSTRY_IMAGES[industryId];
  const src = pickBySeed(images, seed, offset);
  return {
    slot: offset === 0 ? "hero" : `gallery-${offset}`,
    src,
    alt: `${toTitleCase(industryId.replaceAll("_", " "))} image ${offset + 1}`,
    width: 1600,
    height: 1100
  };
};

const useUploadedImage = (input: TemplateGenerationInput, offset = 0): SiteImage | null => {
  const image = input.uploadedImages?.[offset];
  if (!image?.src) return null;
  return {
    slot: offset === 0 ? "hero" : `gallery-${offset}`,
    src: image.src,
    alt: image.alt ?? "Uploaded image",
    width: image.width,
    height: image.height
  };
};

const buildProofItems = (candidate: ArchitectureCandidate) => {
  const explicit = candidate.facts.proofPoints.slice(0, 3);
  if (explicit.length >= 3) {
    return explicit.map((point) => ({
      title: clamp(point, 34),
      body: clamp(`Why it matters: ${point}.`, 120)
    }));
  }

  const byIndustry: Record<ArchitectureCandidate["industry"]["id"], Array<{ title: string; body: string }>> = {
    barbershop: [
      { title: "Cuts that hold their shape", body: "Workweek trims, sharp lines, and consistency regulars notice before they sit down." },
      { title: "Booking that respects your time", body: "Clear slots, tight turnaround, and no vague scheduling promises." },
      { title: `Known in ${candidate.facts.locationLabel}`, body: "Positioned as the local chair people trust before weddings, meetings, and weekends out." }
    ],
    restaurant: [
      { title: "Dishes guests mention by name", body: "Lead with the plates and pairings people talk about after the table clears." },
      { title: "A room worth planning around", body: "Atmosphere, timing, and service cues that make the visit feel intentional." },
      { title: `A dining option in ${candidate.facts.locationLabel}`, body: "Helps guests decide quickly whether tonight belongs here." }
    ],
    dental_clinic: [
      { title: "Clear treatment next steps", body: "Patients know what happens first, what can wait, and what each visit is solving." },
      { title: "Calm appointments", body: "Tone and process reduce hesitation before the first call or booking request." },
      { title: "Professional clinic standards", body: "Modern setting, clear recommendations, and a stronger sense of control for patients." }
    ],
    real_estate: [
      { title: `Grounded in ${candidate.facts.locationLabel}`, body: "The site signals market familiarity instead of vague national real-estate language." },
      { title: "Buyer and seller process clarity", body: "People see where the agency adds value before they submit a lead." },
      { title: "Property-fit guidance", body: "Messaging helps leads qualify themselves by budget, area, or property style." }
    ]
  };

  return byIndustry[candidate.industry.id];
};

const buildReviewItems = (candidate: ArchitectureCandidate) => {
  const prefixByIndustry: Record<ArchitectureCandidate["industry"]["id"], string> = {
    barbershop: "Local review summary",
    restaurant: "Guest review summary",
    dental_clinic: "Patient review summary",
    real_estate: "Client feedback summary"
  };

  const explicit = candidate.facts.proofPoints.filter((point) => point.length > 8).slice(0, 2);
  if (explicit.length) {
    return explicit.map((point, index) => ({
      quote: clamp(point, 160),
      name: prefixByIndustry[candidate.industry.id],
      role: index === 0 ? candidate.facts.locationLabel : "Recent feedback themes"
    }));
  }

  const defaultQuotes: Record<ArchitectureCandidate["industry"]["id"], string[]> = {
    barbershop: [
      "People come back for sharp fades, clean timing, and a chair that remembers the standard.",
      "The shop gets described as reliable before workdays and polished before nights out."
    ],
    restaurant: [
      "Guests remember the room, the pace of service, and the dishes that feel worth booking ahead for.",
      "Feedback centers on atmosphere, return visits, and a menu with clear favorites."
    ],
    dental_clinic: [
      "Patients value calm explanations, gentle appointments, and knowing the next step before they leave.",
      "The strongest feedback themes are reassurance, clarity, and professional follow-through."
    ],
    real_estate: [
      "Clients respond to direct advice, local knowledge, and a process that feels easier to navigate.",
      "Feedback tends to reward responsiveness, clear communication, and neighborhood fluency."
    ]
  };

  return defaultQuotes[candidate.industry.id].map((quote, index) => ({
    quote,
    name: prefixByIndustry[candidate.industry.id],
    role: index === 0 ? candidate.facts.locationLabel : "Recent feedback themes"
  }));
};

const buildFallbackSectionContent = (candidate: ArchitectureCandidate, blueprintId: SectionBlueprintId, input: TemplateGenerationInput) => {
  const facts = candidate.facts;
  const business = input.businessName;
  const location = facts.locationLabel;
  const primaryService = facts.topServices[0] ?? facts.coreOffer;
  const ctaLabel = pickCtaLabel(candidate.industry.id, facts.primaryGoal);
  const contactHref = input.contact?.phone ? `tel:${input.contact.phone.replace(/[^\d+]/g, "")}` : DEFAULT_CONTACT_HREF;

  switch (blueprintId) {
    case "hero": {
      const contentByIndustry: Record<
        ArchitectureCandidate["industry"]["id"],
        { kicker: string; headline: string; subheadline: string; highlights: string[] }
      > = {
        barbershop: {
          kicker: `${location} barber shop`,
          headline:
            candidate.archetype.id === "classic_gentleman"
              ? "Traditional cuts, finished right."
              : "Sharp cuts that look considered.",
          subheadline: clamp(
            `${business} is built around ${facts.topServices.slice(0, 2).join(" and ")}. Clear timing, a room with identity, and grooming that feels fresh when you walk back outside.`,
            180
          ),
          highlights: facts.topServices.slice(0, 3)
        },
        restaurant: {
          kicker: `${location} dining`,
          headline:
            candidate.archetype.id === "premium_fine_dining"
              ? "Dinner worth dressing for."
              : "A table people plan their night around.",
          subheadline: clamp(
            `${business} serves ${facts.menuHighlights.slice(0, 3).join(", ")} in a room that makes dinner feel like the main event, not an afterthought.`,
            180
          ),
          highlights: facts.menuHighlights.slice(0, 3)
        },
        dental_clinic: {
          kicker: `${location} dental care`,
          headline:
            candidate.archetype.id === "modern_clinical_precision"
              ? "Dental care explained without guesswork."
              : "A calmer way to book dental care.",
          subheadline: clamp(
            `${business} helps ${facts.audience} with ${facts.treatmentHighlights.slice(0, 3).join(", ")}. The emphasis is clear steps, modern standards, and appointments that feel manageable from the first call.`,
            190
          ),
          highlights: facts.treatmentHighlights.slice(0, 3)
        },
        real_estate: {
          kicker: `${location} property guidance`,
          headline:
            candidate.archetype.id === "luxury_property_advisory"
              ? "Property advice with market gravity."
              : "Local property decisions, made clearer.",
          subheadline: clamp(
            `${business} supports buyers and sellers around ${location} with ${facts.topServices.slice(0, 2).join(" and ")}, sharper market framing, and a direct path to the next conversation.`,
            190
          ),
          highlights: facts.listingHighlights.slice(0, 3)
        }
      };
      return {
        kicker: contentByIndustry[candidate.industry.id].kicker,
        headline: contentByIndustry[candidate.industry.id].headline,
        subheadline: contentByIndustry[candidate.industry.id].subheadline,
        highlights: contentByIndustry[candidate.industry.id].highlights,
        ctaLabel,
        ctaHref: contactHref
      };
    }
    case "signature_services":
      return {
        title: "Cuts people book on purpose",
        items: facts.topServices.slice(0, 3).map((service, index) => ({
          title: service,
          body: [
            "Sharp finish that holds shape through the week.",
            "Built for clean lines, balance, and easy upkeep.",
            "A stronger look without dragging the appointment out."
          ][index] ?? "Clean execution and a result worth rebooking."
        }))
      };
    case "service_pricing":
      return {
        title: "Book by what you want done",
        plans: facts.topServices.slice(0, 3).map((service, index) => ({
          name: service,
          price: ["Quick chair slot", "Detailed finish", "Full appointment"][(index + 1) % 3],
          description: [
            "For regulars keeping their cut dialed in.",
            "For shape, beard detail, and a cleaner finish.",
            "For a full reset before the week or weekend."
          ][index] ?? "Choose the appointment depth that matches the day."
        }))
      };
    case "featured_dishes":
      return {
        title: "What the table tends to order first",
        plans: facts.menuHighlights.slice(0, 3).map((item, index) => ({
          name: item,
          price: ["House favorite", "Chef-led", "Weekend table pick"][index] ?? "Signature",
          description: [
            "The dish or category guests ask about before they sit down.",
            "A strong example of the kitchen's style and balance.",
            "A reliable choice when the goal is dinner, not guesswork."
          ][index] ?? "One of the menu anchors people come back for."
        }))
      };
    case "menu_preview":
      return {
        title: "How the menu is structured",
        items: [
          {
            title: facts.menuHighlights[0] ?? "Small plates",
            body: "A fast read on the flavors, pace, and shareability of the first order."
          },
          {
            title: facts.menuHighlights[1] ?? "Main dishes",
            body: "The plates that make the visit feel worth planning ahead for."
          },
          {
            title: facts.menuHighlights[2] ?? "Drinks and dessert",
            body: "Enough finish and pairing logic to keep the table staying longer."
          }
        ]
      };
    case "treatments_grid":
      return {
        title: "Treatments patients ask about most",
        items: facts.treatmentHighlights.slice(0, 3).map((treatment, index) => ({
          title: treatment,
          body: [
            "Explained clearly so the first appointment feels manageable.",
            "Positioned around outcomes, comfort, and what happens next.",
            "Presented in plain language, not clinic jargon."
          ][index] ?? "Clear treatment guidance without confusion."
        }))
      };
    case "featured_listings":
      return {
        title: "Property demand we see most often",
        plans: facts.listingHighlights.slice(0, 3).map((item, index) => ({
          name: item,
          price: [location, "Strong demand", "Active buyer interest"][index] ?? location,
          description: [
            `Homes and spaces buyers ask for when they want a faster read on ${location}.`,
            "A useful snapshot of the inventory style the agency understands well.",
            "Makes the site feel connected to real local demand, not generic real-estate copy."
          ][index] ?? "A live market category this agency can speak about clearly."
        }))
      };
    case "buyer_seller_services":
      return {
        title: "Where the agency adds real value",
        items: [
          {
            title: "Buyer search strategy",
            body: `Shortlist properties faster with filters that match budget, location, and daily life in ${location}.`
          },
          {
            title: "Seller positioning",
            body: "Frame the property with stronger pricing logic, sharper presentation, and fewer vague listing decisions."
          },
          {
            title: "Negotiation and follow-through",
            body: "Keep the process moving with clearer communication after interest turns serious."
          }
        ]
      };
    case "proof_grid":
      return {
        title:
          candidate.industry.id === "dental_clinic"
            ? "Why patients feel steadier here"
            : candidate.industry.id === "real_estate"
              ? "Why leads trust this agency faster"
              : candidate.industry.id === "restaurant"
                ? "Why guests come back"
                : "Why regulars stay loyal",
        items: buildProofItems(candidate)
      };
    case "review_summary":
      return {
        title:
          candidate.industry.id === "restaurant"
            ? "What guests keep saying"
            : candidate.industry.id === "dental_clinic"
              ? "What patients notice most"
              : candidate.industry.id === "real_estate"
                ? "What clients mention after closing"
                : "What the chair is known for",
        items: buildReviewItems(candidate)
      };
    case "brand_story":
      return {
        title: "Not a rushed chair. Not a generic cut.",
        body: clamp(
          `${business} is positioned for ${facts.audience} who want ${facts.topServices.slice(0, 2).join(" and ")} done with taste, timing, and a room that feels like it has standards. The difference is in the pace, the consistency, and the finish people can feel in the mirror before they leave.`,
          320
        )
      };
    case "atmosphere_story":
      return {
        title: "The room matters as much as the plate.",
        body: clamp(
          `${business} is built for people who want ${facts.menuHighlights.slice(0, 2).join(" and ")} in a setting that feels deliberate. The lighting, table rhythm, and kitchen voice all help dinner feel like a night out instead of a quick stop.`,
          320
        )
      };
    case "clinic_reassurance":
      return {
        title: "A clinic experience that lowers the tension.",
        body: clamp(
          `${business} is structured to reduce uncertainty. Patients get a clearer sense of what treatment means, what can wait, and how to move forward without pressure. That calm matters before the booking ever happens.`,
          320
        )
      };
    case "neighborhood_expertise":
      return {
        title: `Property advice grounded in ${location}.`,
        body: clamp(
          `${business} is not written like a national portal. It is framed around how people actually search, compare, and move in ${location}: what kinds of homes attract interest, where demand is building, and how to qualify a lead before time gets wasted.`,
          320
        )
      };
    case "gallery_showcase":
      return {
        title: candidate.industry.id === "restaurant" ? "Inside the room" : "Work coming out of the chair"
      };
    case "faq":
      return {
        title: candidate.industry.id === "dental_clinic" ? "Questions patients ask before they book" : "Before you book the chair",
        items:
          candidate.industry.id === "dental_clinic"
            ? [
                { question: "What happens at the first visit?", answer: "You get a clear first look, a practical recommendation, and a better sense of what should happen next." },
                { question: "Can we discuss payment before treatment starts?", answer: "Yes. The site sets the expectation that costs and options should feel clear before treatment moves forward." },
                { question: "Do you work with anxious patients?", answer: "The tone and process are designed to make hesitant patients feel informed rather than rushed." }
              ]
            : [
                { question: "Do I need an appointment?", answer: "The page makes booking the main path, while still making it obvious how to reach out about availability." },
                { question: "What should I book for a beard cleanup?", answer: "Choose the service that matches the finish you want and use the CTA to secure a slot instead of guessing." },
                { question: "How do I find the shop?", answer: "Hours, address, and contact details are kept near the bottom so the final step feels easy." }
              ]
      };
    case "booking_cta":
      return {
        title:
          candidate.industry.id === "dental_clinic"
            ? "Book a visit without the uncertainty."
            : "Pick a slot and come in sharp.",
        body:
          candidate.industry.id === "dental_clinic"
            ? "Use the contact details below to ask about treatment, timing, or your first appointment. The goal is clarity before commitment."
            : `Use ${business} when the cut needs to look deliberate, not rushed. The next step should feel as clean as the result.`,
        ctaLabel,
        ctaHref: contactHref
      };
    case "reservation_cta":
      return {
        kicker: "Reservations",
        title: "Choose the night, then let the room do the rest.",
        body: `Use the reservation flow to plan a table at ${business}. Pair it with the menu cues above and the visit becomes an easier yes.`
      };
    case "lead_cta":
      return {
        title: facts.primaryGoal.includes("sell") ? "Ask what the property is worth now." : "Start with one serious property conversation.",
        body: `Use the CTA to ask about ${location}, a property type, or what kind of search or sale support would make the next move easier.`,
        ctaLabel,
        ctaHref: DEFAULT_CONTACT_HREF
      };
    case "contact_hours":
      return {
        title:
          candidate.industry.id === "restaurant"
            ? "Find the table"
            : candidate.industry.id === "real_estate"
              ? "Start the conversation"
              : "Get in touch",
        body: sentence(
          input.contact?.address ? `${business} is based in ${input.contact.address}.` : null,
          input.openingHours ? `Hours: ${input.openingHours}.` : null,
          input.contact?.phone ? `Call ${input.contact.phone} for the fastest reply.` : null,
          candidate.industry.id === "restaurant" ? "Reservations work best when the time is decided early." : null
        ) || `Reach ${business} for the next step.`,
        email: input.contact?.email ?? undefined,
        phone: input.contact?.phone ?? undefined,
        address: input.contact?.address ?? undefined
      };
    case "payment_info":
      return {
        title: "Payment and planning should feel clear.",
        items: [
          { title: "Treatment clarity first", body: "Patients should understand what is recommended before they are asked to commit." },
          { title: "Discuss payment early", body: "The site frames payment and insurance questions as part of the booking conversation, not a surprise later." },
          { title: "Modern clinic expectations", body: "Professional communication and calm next steps do more for trust than exaggerated claims." }
        ]
      };
    case "footer":
      return {
        text: `${business} • ${location}`
      };
    default:
      return {};
  }
};

const BLUEPRINT_VARIANT_OVERRIDES: Partial<
  Record<
    ArchitectureCandidate["industry"]["id"],
    Partial<Record<SectionBlueprintId, string | Partial<Record<string, string>>>>
  >
> = {
  barbershop: {
    hero: {
      bold_urban: "H",
      classic_gentleman: "E"
    },
    signature_services: "D",
    service_pricing: "C",
    proof_grid: "D",
    review_summary: "D",
    brand_story: "D",
    gallery_showcase: "D",
    faq: "C",
    booking_cta: "D",
    contact_hours: "D",
    footer: "C"
  },
  restaurant: {
    hero: {
      premium_fine_dining: "F",
      cozy_family_dining: "F"
    },
    featured_dishes: "D",
    menu_preview: "E",
    atmosphere_story: "E",
    review_summary: "C",
    gallery_showcase: "E",
    reservation_cta: "C",
    contact_hours: "E",
    footer: "C"
  },
  dental_clinic: {
    hero: "E",
    treatments_grid: "F",
    proof_grid: "F",
    review_summary: "E",
    clinic_reassurance: "F",
    faq: "C",
    booking_cta: "E",
    contact_hours: "E",
    payment_info: "F",
    footer: "B"
  },
  real_estate: {
    hero: "G",
    featured_listings: "E",
    buyer_seller_services: "G",
    proof_grid: "G",
    review_summary: "F",
    neighborhood_expertise: "F",
    lead_cta: "F",
    contact_hours: "F",
    footer: "C"
  }
};

const resolveVariant = (candidate: ArchitectureCandidate, legacyType: LegacySectionType, blueprintId: SectionBlueprintId) => {
  const industryOverride = BLUEPRINT_VARIANT_OVERRIDES[candidate.industry.id]?.[blueprintId];
  if (typeof industryOverride === "string") return industryOverride;
  if (industryOverride && typeof industryOverride === "object") {
    const matchedArchetype = industryOverride[candidate.archetype.id];
    if (matchedArchetype) return matchedArchetype;
  }
  const preferred = candidate.layout.sectionVariantBias[legacyType]?.[0];
  if (blueprintId === "hero") return candidate.layout.heroVariant;
  if (preferred) return preferred;
  if (legacyType === "faq") return "A";
  if (legacyType === "footer") return candidate.layout.id === "immersive_stack" ? "B" : "A";
  return "A";
};

const buildSectionStyle = (candidate: ArchitectureCandidate, blueprintId: SectionBlueprintId, emphasis: SectionEmphasis, legacyType: LegacySectionType): SiteSection["style"] => {
  const { theme, layout, archetype } = candidate;
  const base = {
    alignment: layout.alignment,
    spacing: layout.spacing,
    buttonStyle: archetype.ctaStyle,
    background: { type: "plain" as const },
    colorOverride: null as SiteSection["style"]["colorOverride"]
  };

  if (legacyType === "hero" && layout.heroVariant === "B") {
    return {
      ...base,
      alignment: layout.alignment,
      background: { type: "image", overlay: archetype.contrast === "high" ? 0.52 : 0.42, position: "center", size: "cover", repeat: "no-repeat" },
      colorOverride: { text: "#FFF9F1", bg: theme.primary, primary: theme.secondary },
      buttonStyle: archetype.ctaStyle
    };
  }

  if (legacyType === "hero" && layout.heroVariant === "C") {
    return {
      ...base,
      background: {
        type: "gradient",
        angle: 135,
        stops: [
          { color: theme.surface, position: 0 },
          { color: theme.bg, position: 100 }
        ]
      }
    };
  }

  if (legacyType === "hero" && layout.heroVariant === "D") {
    return {
      ...base,
      alignment: "center",
      background: {
        type: "gradient",
        angle: 180,
        stops: [
          { color: `${theme.secondary}22`, position: 0 },
          { color: theme.bg, position: 100 }
        ]
      }
    };
  }

  if (blueprintId === "reservation_cta") {
    return {
      ...base,
      background: {
        type: "gradient",
        angle: 135,
        stops: [
          { color: `${theme.secondary}33`, position: 0 },
          { color: theme.surface, position: 100 }
        ]
      },
      buttonStyle: "solid"
    };
  }

  if (emphasis === "brand") {
    return {
      ...base,
      background: {
        type: "gradient",
        angle: 135,
        stops: [
          { color: theme.primary, position: 0 },
          { color: theme.accent ?? theme.secondary, position: 100 }
        ]
      },
      colorOverride: {
        bg: theme.primary,
        text: "#FFF9F1",
        primary: theme.secondary
      },
      buttonStyle: archetype.ctaStyle === "outline" ? "outline" : "solid"
    };
  }

  if (emphasis === "contrast") {
    if (
      archetype.contrast === "high" ||
      candidate.industry.id === "barbershop" ||
      candidate.industry.id === "restaurant" ||
      candidate.industry.id === "real_estate"
    ) {
      return {
        ...base,
        background: {
          type: "gradient",
          angle: 140,
          stops: [
            { color: theme.primary, position: 0 },
            { color: theme.text, position: 100 }
          ]
        },
        colorOverride: {
          bg: theme.primary,
          text: "#FFF8F1",
          primary: theme.secondary
        },
        buttonStyle: "outline"
      };
    }

    return {
      ...base,
      background: { type: "plain" },
      colorOverride: {
        bg: theme.surface,
        text: theme.text,
        primary: theme.primary
      },
      buttonStyle: "outline"
    };
  }

  if (emphasis === "soft") {
    return {
      ...base,
      background: {
        type: "gradient",
        angle: 180,
        stops: [
          { color: `${theme.secondary}26`, position: 0 },
          { color: theme.bg, position: 100 }
        ]
      },
      colorOverride: {
        bg: theme.bg,
        text: theme.text,
        primary: theme.primary
      }
    };
  }

  if (emphasis === "image") {
    return {
      ...base,
      background: { type: "plain" },
      buttonStyle: archetype.ctaStyle
    };
  }

  return base;
};

const buildDrafts = (candidate: ArchitectureCandidate, input: TemplateGenerationInput): SectionDraft[] => {
  return candidate.sectionOrder
    .filter((blueprintId) => sectionAllowed(candidate, blueprintId, input))
    .map((blueprintId, index) => {
      const definition = SECTION_DEFINITIONS[blueprintId];
      const emphasis = candidate.layout.sectionRhythm[index % candidate.layout.sectionRhythm.length] ?? "base";
      const variant = resolveVariant(candidate, definition.legacyType, blueprintId);
      const uploadedHero = useUploadedImage(input, 0);
      const images: SiteImage[] | undefined =
        blueprintId === "hero"
          ? [uploadedHero ?? imageForIndustry(candidate.industry.id, `${input.businessName}:hero`)]
          : blueprintId === "gallery_showcase"
            ? Array.from({ length: 3 }).map((_, galleryIndex) =>
                useUploadedImage(input, galleryIndex + 1) ?? imageForIndustry(candidate.industry.id, `${input.businessName}:gallery`, galleryIndex + 1)
              )
            : blueprintId === "featured_dishes" || blueprintId === "featured_listings"
              ? Array.from({ length: 3 }).map((_, galleryIndex) =>
                  useUploadedImage(input, galleryIndex + 1) ?? imageForIndustry(candidate.industry.id, `${input.businessName}:${blueprintId}`, galleryIndex + 1)
                )
            : undefined;

      return {
        blueprintId,
        legacyType: definition.legacyType,
        variant,
        label: definition.label,
        purpose: definition.purpose,
        conversionRole: definition.conversionRole,
        emphasis,
        content: buildFallbackSectionContent(candidate, blueprintId, input),
        images
      } satisfies SectionDraft;
    });
};

const maybeRefineDrafts = async (candidate: ArchitectureCandidate, input: TemplateGenerationInput, drafts: SectionDraft[], openai: any) => {
  const rewritten = await runStrictJsonWithRetry(openai, {
    schema: MODEL_REWRITE_SCHEMA,
    systemPrompt: INDUSTRY_V2_SYSTEM_PROMPT,
    userPrompt: buildIndustryV2UserPrompt({ input, architecture: candidate, draftSections: drafts }),
    temperature: input.qualityMode === "best" ? 0.6 : 0.35,
    timeoutMs: 45000,
    label: "industry-v2"
  });

  if (!rewritten) return drafts;
  const rewriteMap = new Map(rewritten.sections.map((section) => [section.id, section.content]));
  return drafts.map((draft) => ({
    ...draft,
    content: rewriteMap.has(draft.blueprintId)
      ? { ...draft.content, ...rewriteMap.get(draft.blueprintId) }
      : draft.content
  }));
};

const buildSectionFromDraft = (candidate: ArchitectureCandidate, draft: SectionDraft, index: number): SiteSection => {
  const style = buildSectionStyle(candidate, draft.blueprintId, draft.emphasis, draft.legacyType);
  const withImages = draft.images?.map((image, imageIndex) => ({
    ...image,
    slot:
      draft.blueprintId === "hero"
        ? "hero"
        : draft.blueprintId === "gallery_showcase"
          ? `gallery-${imageIndex + 1}`
          : draft.blueprintId === "featured_dishes" || draft.blueprintId === "featured_listings"
            ? `feature-${imageIndex + 1}`
          : image.slot
  }));

  return {
    id: `${draft.blueprintId}-${index + 1}`,
    type: draft.legacyType,
    name: draft.label,
    variant: draft.variant,
    enabled: true,
    style,
    content: draft.content,
    images: withImages
  };
};

const buildSiteDocument = (candidate: ArchitectureCandidate, input: TemplateGenerationInput, drafts: SectionDraft[]): SiteDocument => {
  const sections = drafts.map((draft, index) => buildSectionFromDraft(candidate, draft, index));
  const hero = drafts.find((draft) => draft.blueprintId === "hero");
  const seoDescription = clamp(String(hero?.content.subheadline ?? input.description), 155);
  return {
    templateId: INDUSTRY_TEMPLATE_IDS[candidate.industry.id],
    tone: candidate.archetype.tone,
    theme: candidate.theme,
    pages: [
      {
        id: "home",
        name: "Home",
        slug: "home",
        order: 0,
        showInMenu: true,
        menuTitle: "Home",
        parentId: null,
        sections
      }
    ],
    siteBrief: {
      businessName: input.businessName,
      logoUrl: undefined,
      industry: candidate.industry.label,
      description: input.description,
      tone: input.tone,
      goals: candidate.industry.primaryConversionGoals,
      pages: ["Home"],
      language: input.language,
      generationBrief: {
        audience: input.brief.audience,
        coreOffer: input.brief.coreOffer,
        primaryCtaGoal: input.brief.primaryCtaGoal,
        topServices: input.brief.topServices,
        proofPoints: input.brief.proofPoints,
        tone: input.brief.tone
      },
      theme: {
        primary: candidate.theme.primary,
        background: candidate.theme.bg,
        fontFamily: candidate.theme.fontBody
      },
      designDNA: {
        variationSeed: `${candidate.industry.id}:${candidate.archetype.id}:${candidate.layout.id}:${input.businessName}`,
        layoutStyle: candidate.layout.label,
        palette: {
          primary: candidate.theme.primary,
          secondary: candidate.theme.secondary,
          background: candidate.theme.bg,
          accent: candidate.theme.accent
        },
        fontPair: {
          heading: candidate.theme.fontHeading,
          body: candidate.theme.fontBody
        },
        variantBias: Object.fromEntries(drafts.map((draft) => [draft.blueprintId, draft.variant])),
        sectionOrder: candidate.sectionOrder,
        imageryStyle: candidate.archetype.imageTreatment,
        industryKey: candidate.industry.id,
        archetypeKey: candidate.archetype.id,
        layoutDNA: candidate.layout.id,
        sectionBlueprints: candidate.sectionOrder,
        conversionGoal: candidate.facts.primaryGoal
      }
    },
    seo: {
      title: `${input.businessName} | ${candidate.industry.label}`,
      description: seoDescription,
      ogImage: drafts.find((draft) => draft.images?.[0])?.images?.[0]?.src ?? null
    },
    mediaLibrary: drafts.flatMap((draft) => draft.images ?? [])
  };
};

const maxCandidatesForMode = (mode: TemplateGenerationInput["qualityMode"]) => {
  if (mode === "best") return 3;
  if (mode === "balanced") return 2;
  return 1;
};

export const isIndustryV2Supported = (industry: string, subtype?: string | null, description?: string | null) =>
  Boolean(detectSupportedIndustry(industry, subtype, description));

export async function generateIndustrySiteV2(args: {
  input: TemplateGenerationInput;
  openai: any;
}): Promise<TemplateGenerationOutput | null> {
  const candidates = buildArchitectureCandidates(args.input).slice(0, maxCandidatesForMode(args.input.qualityMode));
  if (!candidates.length) return null;

  let bestFailure: { siteDocument: SiteDocument; validation: TemplateValidationReport; candidate: ArchitectureCandidate; drafts: SectionDraft[] } | null = null;

  for (const candidate of candidates) {
    const fallbackDrafts = buildDrafts(candidate, args.input);
    const promptDrafts = args.openai ? await maybeRefineDrafts(candidate, args.input, fallbackDrafts, args.openai) : fallbackDrafts;
    const primarySite = buildSiteDocument(candidate, args.input, promptDrafts);
    const primaryValidation = validateIndustrySite({
      architecture: candidate,
      drafts: promptDrafts,
      siteDocument: primarySite
    });

    if (primaryValidation.passed) {
      return {
        siteDocument: primarySite,
        validation: primaryValidation,
        meta: {
          pipeline: "industry_v2",
          industryId: candidate.industry.id,
          archetypeId: candidate.archetype.id,
          layoutId: candidate.layout.id,
          sectionBlueprintIds: candidate.sectionOrder,
          candidateScores: candidates.map((entry) => ({
            industryId: entry.industry.id,
            archetypeId: entry.archetype.id,
            layoutId: entry.layout.id,
            score: entry.score
          })),
          promptUsed: Boolean(args.openai)
        }
      };
    }

    const fallbackSite = buildSiteDocument(candidate, args.input, fallbackDrafts);
    const fallbackValidation = validateIndustrySite({
      architecture: candidate,
      drafts: fallbackDrafts,
      siteDocument: fallbackSite
    });

    const candidateFailure = fallbackValidation.score >= primaryValidation.score
      ? { siteDocument: fallbackSite, validation: fallbackValidation, candidate, drafts: fallbackDrafts }
      : { siteDocument: primarySite, validation: primaryValidation, candidate, drafts: promptDrafts };

    if (!bestFailure || candidateFailure.validation.score > bestFailure.validation.score) {
      bestFailure = candidateFailure;
    }
  }

  if (!bestFailure) return null;

  return {
    siteDocument: bestFailure.siteDocument,
    validation: bestFailure.validation,
    meta: {
      pipeline: "industry_v2",
      industryId: bestFailure.candidate.industry.id,
      archetypeId: bestFailure.candidate.archetype.id,
      layoutId: bestFailure.candidate.layout.id,
      sectionBlueprintIds: bestFailure.candidate.sectionOrder,
      candidateScores: candidates.map((entry) => ({
        industryId: entry.industry.id,
        archetypeId: entry.archetype.id,
        layoutId: entry.layout.id,
        score: entry.score
      })),
      promptUsed: Boolean(args.openai)
    }
  };
}
