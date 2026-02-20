import type { SiteSection } from "@/lib/website-builder/types";

export type FeatureKey =
  | "booking"
  | "contact"
  | "gallery"
  | "faq"
  | "menu"
  | "services"
  | "testimonials"
  | "pricing";

export type BuilderFeatureFlags = {
  includeServices: boolean;
  includeTestimonials: boolean;
  includePricing: boolean;
  includeFaq: boolean;
  includeContact: boolean;
  includeReservation: boolean;
  includeGallery: boolean;
};

export const FEATURE_TO_SECTION_TYPES: Record<FeatureKey, SiteSection["type"][]> = {
  booking: ["reservation"],
  contact: ["contact"],
  gallery: ["gallery"],
  faq: ["faq"],
  menu: ["services"],
  services: ["services"],
  testimonials: ["testimonials"],
  pricing: ["pricing"]
};

export const ALWAYS_ALLOWED_SECTION_TYPES: SiteSection["type"][] = ["hero", "footer"];

const FEATURE_ORDER: FeatureKey[] = [
  "booking",
  "contact",
  "gallery",
  "faq",
  "menu",
  "services",
  "testimonials",
  "pricing"
];

export const getSelectedFeatureKeys = (flags: BuilderFeatureFlags): FeatureKey[] => {
  const selected = new Set<FeatureKey>();
  if (flags.includeReservation) selected.add("booking");
  if (flags.includeContact) selected.add("contact");
  if (flags.includeGallery) selected.add("gallery");
  if (flags.includeFaq) selected.add("faq");
  if (flags.includeServices) {
    selected.add("services");
    selected.add("menu");
  }
  if (flags.includeTestimonials) selected.add("testimonials");
  if (flags.includePricing) selected.add("pricing");

  return FEATURE_ORDER.filter((key) => selected.has(key));
};

export const computeSectionPolicyFromFeatureFlags = (
  flags: BuilderFeatureFlags
): {
  selectedFeatureKeys: FeatureKey[];
  allowedSectionTypes: SiteSection["type"][];
  requiredSectionTypes: SiteSection["type"][];
} => {
  const selectedFeatureKeys = getSelectedFeatureKeys(flags);

  const allowedSet = new Set<SiteSection["type"]>(ALWAYS_ALLOWED_SECTION_TYPES);
  const requiredSet = new Set<SiteSection["type"]>(ALWAYS_ALLOWED_SECTION_TYPES);

  selectedFeatureKeys.forEach((featureKey) => {
    const sectionTypes = FEATURE_TO_SECTION_TYPES[featureKey] ?? [];
    sectionTypes.forEach((sectionType) => {
      allowedSet.add(sectionType);
      requiredSet.add(sectionType);
    });
  });

  if (selectedFeatureKeys.includes("booking")) {
    requiredSet.add("reservation");
  }
  if (selectedFeatureKeys.includes("contact")) {
    requiredSet.add("contact");
  }

  return {
    selectedFeatureKeys,
    allowedSectionTypes: Array.from(allowedSet),
    requiredSectionTypes: Array.from(requiredSet)
  };
};
