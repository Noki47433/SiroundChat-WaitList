export const DETERMINISTIC_TEMPLATE_IDS = ["restaurant", "dental", "service", "real_estate"] as const;

export type DeterministicTemplateId = (typeof DETERMINISTIC_TEMPLATE_IDS)[number];

export const SERVICE_NICHES = ["barbershop", "beauty_salon", "nail_salon"] as const;

export type ServiceNiche = (typeof SERVICE_NICHES)[number];

export type TemplateResolution = {
  template: DeterministicTemplateId;
  serviceNiche: ServiceNiche | null;
};

export const FIXED_SECTION_ORDER: Record<DeterministicTemplateId, readonly string[]> = {
  restaurant: [
    "header",
    "hero",
    "proof",
    "signature",
    "menu",
    "story",
    "logistics",
    "reviews",
    "newsletter",
    "footer"
  ],
  dental: [
    "header",
    "hero",
    "trust",
    "services",
    "why_us",
    "team",
    "pricing",
    "reviews",
    "faq",
    "contact",
    "footer"
  ],
  service: [
    "header",
    "hero",
    "services",
    "pricing",
    "staff",
    "gallery",
    "reviews",
    "contact",
    "footer"
  ],
  real_estate: [
    "header",
    "hero",
    "vision",
    "residences",
    "amenities",
    "neighborhood",
    "floorplans",
    "press",
    "team",
    "contact",
    "footer"
  ]
};

export const MAX_VARIANTS = 2;

export const ALLOWED_VARIANTS = {
  restaurant: {
    menu: ["categories", "pdf"],
    logistics: ["map_hours_contact", "hours_address_transit"]
  },
  dental: {
    trust: ["rating_badges", "anxiety_points"],
    pricing: ["insurance_list", "price_bands"]
  },
  service: {
    pricing: ["list", "starting_at"],
    gallery: ["masonry", "before_after"]
  },
  real_estate: {
    residences: ["property_cards", "floorplan_cards"],
    neighborhood: ["map_highlights", "distance_chips"]
  }
} as const;

export const ALLOWED_SPACING_STEPS = [4, 6, 8, 10, 12, 16, 20] as const;

export const ALLOWED_WIDTH_CLASSES = ["max-w-6xl", "max-w-xl"] as const;

export const ALLOWED_SPACING_CLASSES = [
  "py-10",
  "py-12",
  "py-16",
  "py-20",
  "gap-4",
  "gap-6",
  "gap-8",
  "gap-10",
  "gap-12",
  "gap-16",
  "gap-20",
  "mb-4",
  "mb-6",
  "space-y-2"
] as const;

export const MOTION_LEVELS = ["none", "minimal"] as const;

export const RESTAURANT_PRIMARY_CTA_LABELS = ["Reserve a table", "Order now"] as const;
export const DENTAL_PRIMARY_CTA_LABEL = "Book appointment" as const;
export const SERVICE_PRIMARY_CTA_LABELS = ["Book now", "Book appointment"] as const;
export const REAL_ESTATE_PRIMARY_CTA_LABEL = "Inquire" as const;

export const SECONDARY_CTA_LABELS = {
  restaurant: "View menu",
  dental: "Call now",
  real_estate: "Download brochure"
} as const;

export const IMAGE_RATIOS = {
  restaurant: {
    heroDesktop: "16:9",
    heroMobile: "4:5",
    signature: ["1:1", "4:3"],
    gallery: ["1:1", "4:5"]
  },
  dental: {
    heroDesktop: "16:9",
    heroMobile: "3:4",
    team: "1:1",
    gallery: "4:3"
  },
  service: {
    heroDesktop: "16:9",
    heroMobile: "4:5",
    gallery: ["1:1", "4:5"],
    staff: "1:1"
  },
  real_estate: {
    heroDesktop: "21:9",
    heroMobile: "4:5",
    listing: "4:3",
    neighborhood: "16:9"
  }
} as const;

const containsAny = (input: string, words: readonly string[]) => words.some((word) => input.includes(word));

export const resolveDeterministicTemplate = (industryOrSubtype: string): TemplateResolution => {
  const normalized = industryOrSubtype.trim().toLowerCase();

  if (containsAny(normalized, ["restaurant", "cafe", "bistro", "dining"])) {
    return { template: "restaurant", serviceNiche: null };
  }

  if (containsAny(normalized, ["dental", "dentist", "clinic", "orthodont"])) {
    return { template: "dental", serviceNiche: null };
  }

  if (containsAny(normalized, ["real estate", "real-estate", "property", "realtor", "condo"])) {
    return { template: "real_estate", serviceNiche: null };
  }

  if (containsAny(normalized, ["barber", "barbershop"])) {
    return { template: "service", serviceNiche: "barbershop" };
  }

  if (containsAny(normalized, ["beauty salon", "beauty", "spa", "cosmetic"])) {
    return { template: "service", serviceNiche: "beauty_salon" };
  }

  if (containsAny(normalized, ["nail", "manicure", "pedicure"])) {
    return { template: "service", serviceNiche: "nail_salon" };
  }

  return { template: "service", serviceNiche: "beauty_salon" };
};

export const getPersistedTemplateIdForRail = (
  rail: DeterministicTemplateId
): DeterministicTemplateId => rail;

export const isAllowedSpacingClass = (token: string): token is (typeof ALLOWED_SPACING_CLASSES)[number] => {
  return (ALLOWED_SPACING_CLASSES as readonly string[]).includes(token);
};

export const isAllowedWidthClass = (token: string): token is (typeof ALLOWED_WIDTH_CLASSES)[number] => {
  return (ALLOWED_WIDTH_CLASSES as readonly string[]).includes(token);
};
