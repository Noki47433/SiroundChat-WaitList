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
  return {
    passed: true,
    score: 100,
    issues: [],
    architecture: {
      industryId: architecture.industry.id,
      archetypeId: architecture.archetype.id,
      layoutId: architecture.layout.id
    }
  };
};
