import type {
  ArchitectureCandidate,
  SectionDraft,
  SupportedIndustryKey,
  TemplateValidationIssue,
  TemplateValidationReport
} from "@/lib/builder/generation/v2/types";
import type { SiteDocument } from "@/lib/website-builder/types";

const GLOBAL_BANNED_PHRASES = [
  "built for busy local clients",
  "quality service",
  "reliable appointments",
  "modern solutions",
  "tailored solutions",
  "we pride ourselves on",
  "trusted partner",
  "seamless experience",
  "customer satisfaction",
  "excellence in every",
  "professional team",
  "all your needs",
  "fast appointments without the wait",
  "premier destination",
  "high-quality care",
  "first-class service",
  "enhancing your lifestyle",
  "designed around your needs",
  "helping you every step of the way",
  "crafted with precision and care",
  "where quality meets convenience"
];

const PLACEHOLDER_TESTIMONIAL_NAMES = [
  "verified customer",
  "happy client",
  "satisfied customer",
  "local client",
  "returning customer"
];

const collectStrings = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectStrings(entry, output));
  }
  return output;
};

const hasSectionType = (site: SiteDocument, type: string) =>
  site.pages.some((page) => page.sections.some((section) => section.enabled && section.type === type));

const getEnabledSections = (site: SiteDocument) =>
  site.pages.flatMap((page) => page.sections.filter((section) => section.enabled));

const getRequiredPatterns = (industryId: SupportedIndustryKey) => {
  switch (industryId) {
    case "barbershop":
      return ["hero", "services", "gallery", "cta", "contact"];
    case "restaurant":
      return ["hero", "pricing", "reservation", "contact"];
    case "dental_clinic":
      return ["hero", "services", "about", "cta", "contact"];
    case "real_estate":
      return ["hero", "pricing", "services", "cta", "contact"];
    default:
      return ["hero", "cta", "contact"];
  }
};

const MEMORABLE_VARIANTS = new Set(["D", "E", "F", "G", "H"]);
const IMAGE_FORWARD_VARIANTS = new Set(["B", "D", "E", "F", "G", "H"]);

export const validateIndustrySite = (args: {
  architecture: ArchitectureCandidate;
  drafts: SectionDraft[];
  siteDocument: SiteDocument;
}): TemplateValidationReport => {
  const { architecture, drafts, siteDocument } = args;
  const issues: TemplateValidationIssue[] = [];
  const enabledSections = getEnabledSections(siteDocument);
  const strings = collectStrings(siteDocument).map((entry) => entry.toLowerCase());
  const bannedPhrases = [...GLOBAL_BANNED_PHRASES, ...architecture.archetype.bannedPhrases].map((phrase) => phrase.toLowerCase());

  bannedPhrases.forEach((phrase) => {
    if (strings.some((value) => value.includes(phrase))) {
      issues.push({
        code: "banned_phrase",
        severity: "critical",
        message: `Banned phrase detected: ${phrase}`
      });
    }
  });

  const requiredTypes = getRequiredPatterns(architecture.industry.id);
  requiredTypes.forEach((type) => {
    if (!hasSectionType(siteDocument, type)) {
      issues.push({
        code: "missing_required_section",
        severity: "critical",
        message: `Missing required section type for ${architecture.industry.label}: ${type}`
      });
    }
  });

  const proofSection = drafts.some((section) => section.conversionRole === "proof" || section.conversionRole === "trust");
  if (!proofSection) {
    issues.push({
      code: "missing_proof",
      severity: "critical",
      message: "No trust or proof mechanism was included."
    });
  }

  const ctaSections = drafts.filter((section) => section.conversionRole === "primary_cta");
  if (ctaSections.length === 0) {
    issues.push({
      code: "missing_primary_cta",
      severity: "critical",
      message: "No primary CTA section was included."
    });
  }

  const hero = enabledSections.find((section) => section.type === "hero");
  const heroHeadline = String(hero?.content?.headline ?? "").toLowerCase();
  if (!heroHeadline || heroHeadline.includes("for busy local clients") || heroHeadline.includes("trusted")) {
    issues.push({
      code: "weak_hero",
      severity: "critical",
      message: "Hero headline is generic or missing."
    });
  }

  const sectionTypes = enabledSections.map((section) => section.type);
  const repeatedTypes = sectionTypes.filter((type, index) => sectionTypes.indexOf(type) !== index);
  if (repeatedTypes.length >= Math.ceil(enabledSections.length / 2)) {
    issues.push({
      code: "visual_repetition",
      severity: "warning",
      message: "Too many repeated legacy section types may make the page feel repetitive."
    });
  }

  const strongBackgroundSections = enabledSections.filter(
    (section) => section.style.background.type !== "plain" || section.style.colorOverride?.bg
  );
  if (strongBackgroundSections.length === 0) {
    issues.push({
      code: "weak_visual_rhythm",
      severity: "warning",
      message: "No visually distinctive section was generated."
    });
  }

  const sectionVariants = enabledSections.map((section) => section.variant);
  const memorableSections = enabledSections.filter((section) => MEMORABLE_VARIANTS.has(section.variant));
  if (memorableSections.length === 0) {
    issues.push({
      code: "missing_memorable_section",
      severity: "critical",
      message: "Renderer output did not produce a visually distinctive section."
    });
  }

  const imageDominantSections = enabledSections.filter(
    (section) =>
      section.images?.length ||
      section.style.background.type === "image" ||
      IMAGE_FORWARD_VARIANTS.has(section.variant)
  );
  if ((architecture.industry.id === "barbershop" || architecture.industry.id === "restaurant" || architecture.industry.id === "real_estate") && imageDominantSections.length < 2) {
    issues.push({
      code: "missing_image_rhythm",
      severity: "warning",
      message: `${architecture.industry.label} output needs stronger image-led sections.`
    });
  }

  const repetitiveRuns = enabledSections.reduce(
    (state, section, index, all) => {
      if (index === 0) return { longest: 1, current: 1 };
      const previous = all[index - 1];
      const sameVisualCluster =
        previous.type === section.type ||
        (["services", "testimonials", "pricing", "faq"].includes(previous.type) &&
          ["services", "testimonials", "pricing", "faq"].includes(section.type) &&
          previous.variant === section.variant);
      const current = sameVisualCluster ? state.current + 1 : 1;
      return { longest: Math.max(state.longest, current), current };
    },
    { longest: 0, current: 0 }
  );

  if (repetitiveRuns.longest >= 3) {
    issues.push({
      code: "stacked_card_repetition",
      severity: "critical",
      message: "Too many adjacent sections resolve into the same card rhythm."
    });
  }

  const uniqueVariants = new Set(sectionVariants);
  if (uniqueVariants.size <= Math.max(2, Math.floor(enabledSections.length / 3))) {
    issues.push({
      code: "low_variant_diversity",
      severity: "warning",
      message: "Variant diversity is too low for a distinctive multi-section page."
    });
  }

  enabledSections
    .filter((section) => section.type === "testimonials")
    .forEach((section) => {
      const items = Array.isArray(section.content.items) ? section.content.items : [];
      items.forEach((item: any) => {
        const name = String(item?.name ?? "").toLowerCase();
        if (PLACEHOLDER_TESTIMONIAL_NAMES.some((placeholder) => name.includes(placeholder))) {
          issues.push({
            code: "fake_testimonial_pattern",
            severity: "critical",
            message: "Placeholder testimonial naming detected.",
            sectionId: section.id
          });
        }
      });
    });

  if (architecture.industry.id === "restaurant") {
    if (!hasSectionType(siteDocument, "reservation")) {
      issues.push({
        code: "missing_reservation_flow",
        severity: "critical",
        message: "Restaurant page is missing reservation flow."
      });
    }
  }

  if (architecture.industry.id === "dental_clinic") {
    const hasFaq = hasSectionType(siteDocument, "faq");
    if (!hasFaq) {
      issues.push({
        code: "missing_patient_questions",
        severity: "warning",
        message: "Dental page should answer patient hesitation with FAQs."
      });
    }
  }

  if (architecture.industry.id === "real_estate") {
    const listingSection = drafts.find((section) => section.blueprintId === "featured_listings");
    if (!listingSection) {
      issues.push({
        code: "missing_listing_logic",
        severity: "critical",
        message: "Real estate page is missing a property or market inventory section."
      });
    }
  }

  const score = Math.max(
    0,
    100 -
      issues.reduce((total, issue) => total + (issue.severity === "critical" ? 18 : 8), 0) +
      Math.min(8, strongBackgroundSections.length * 2)
  );

  return {
    passed: issues.every((issue) => issue.severity !== "critical"),
    score,
    issues,
    architecture: {
      industryId: architecture.industry.id,
      archetypeId: architecture.archetype.id,
      layoutId: architecture.layout.id
    }
  };
};
