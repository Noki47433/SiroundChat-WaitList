import type { SiteSection } from "@/lib/website-builder/types";

export type NicheKey = "restaurant" | "clinic" | "barber" | "gym" | "real-estate" | "agency" | "generic";

export type NicheRules = {
  key: NicheKey;
  bannedPhrases: string[];
  requiredSections: SiteSection["type"][];
  preferredCtaTargets: {
    primary: "#reservation" | "#contact";
  };
  copyConstraints: {
    mustMention: string[];
  };
};

const COMMON_BANNED_PHRASES = [
  "trusted local experts",
  "flexible plans",
  "any budget",
  "tailored solutions",
  "industry-leading",
  "seamless"
];

const NICHE_RULES: Record<NicheKey, NicheRules> = {
  restaurant: {
    key: "restaurant",
    bannedPhrases: COMMON_BANNED_PHRASES,
    requiredSections: ["hero", "services", "gallery", "reservation", "contact", "footer"],
    preferredCtaTargets: { primary: "#reservation" },
    copyConstraints: {
      mustMention: [
        "cuisine style",
        "signature dishes",
        "atmosphere",
        "booking or reservations"
      ]
    }
  },
  clinic: {
    key: "clinic",
    bannedPhrases: [
      ...COMMON_BANNED_PHRASES,
      "book your table",
      "chef special",
      "nightlife vibe"
    ],
    requiredSections: ["hero", "services", "faq", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["patient care", "appointments", "licensed team"]
    }
  },
  barber: {
    key: "barber",
    bannedPhrases: [
      ...COMMON_BANNED_PHRASES,
      "enterprise transformation",
      "board-level strategy"
    ],
    requiredSections: ["hero", "services", "gallery", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["cuts or grooming", "walk-ins or booking", "style expertise"]
    }
  },
  gym: {
    key: "gym",
    bannedPhrases: [
      ...COMMON_BANNED_PHRASES,
      "fine dining",
      "menu tasting",
      "corporate procurement"
    ],
    requiredSections: ["hero", "services", "testimonials", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["training", "membership", "coaching"]
    }
  },
  "real-estate": {
    key: "real-estate",
    bannedPhrases: [
      ...COMMON_BANNED_PHRASES,
      "chef-driven",
      "spa package",
      "table booking"
    ],
    requiredSections: ["hero", "services", "testimonials", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["listings", "buyers or sellers", "local market"]
    }
  },
  agency: {
    key: "agency",
    bannedPhrases: [
      ...COMMON_BANNED_PHRASES,
      "table for two",
      "menu highlights",
      "guest seating"
    ],
    requiredSections: ["hero", "services", "cta", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["results", "delivery", "strategy"]
    }
  },
  generic: {
    key: "generic",
    bannedPhrases: COMMON_BANNED_PHRASES,
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredCtaTargets: { primary: "#contact" },
    copyConstraints: {
      mustMention: ["what you offer", "who it is for", "how to contact"]
    }
  }
};

export const getNicheRules = (industry: string, templateId?: string): NicheRules => {
  const normalized = `${industry} ${templateId ?? ""}`.toLowerCase();

  if (
    normalized.includes("restaurant") ||
    normalized.includes("cafe") ||
    normalized.includes("bistro") ||
    normalized.includes("diner") ||
    normalized.includes("food") ||
    normalized.includes("grill") ||
    normalized.includes("pizzeria")
  ) {
    return NICHE_RULES.restaurant;
  }

  if (
    normalized.includes("clinic") ||
    normalized.includes("medical") ||
    normalized.includes("dental") ||
    normalized.includes("health")
  ) {
    return NICHE_RULES.clinic;
  }

  if (normalized.includes("barber") || normalized.includes("barbershop") || normalized.includes("groom")) {
    return NICHE_RULES.barber;
  }

  if (normalized.includes("gym") || normalized.includes("fitness") || normalized.includes("crossfit") || normalized.includes("yoga")) {
    return NICHE_RULES.gym;
  }

  if (normalized.includes("real estate") || normalized.includes("realtor") || normalized.includes("property")) {
    return NICHE_RULES["real-estate"];
  }

  if (
    normalized.includes("agency") ||
    normalized.includes("consulting") ||
    normalized.includes("corporate") ||
    normalized.includes("marketing")
  ) {
    return NICHE_RULES.agency;
  }

  return NICHE_RULES.generic;
};
