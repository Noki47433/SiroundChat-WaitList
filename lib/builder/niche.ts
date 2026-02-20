import type { SiteSection } from "@/lib/website-builder/types";

export type NicheKey =
  | "restaurant"
  | "clinic"
  | "barber"
  | "gym"
  | "real-estate"
  | "agency"
  | "generic";

export type NicheRules = {
  key: NicheKey;
  bannedPhrases: string[];
  requiredTerms: string[];
  forbiddenTopics: string[];
  defaultBulletPool: string[];
  imageQueryPresets: {
    hero: string[];
    gallery: string[];
  };
  requiredSections: SiteSection["type"][];
  preferredPrimaryCta: "#reservation" | "#contact";
};

const COMMON_BANNED_PHRASES = [
  "trusted local experts",
  "flexible plans",
  "any budget",
  "tailored solutions",
  "industry-leading",
  "seamless"
];

const RULES: Record<NicheKey, NicheRules> = {
  restaurant: {
    key: "restaurant",
    bannedPhrases: [...COMMON_BANNED_PHRASES],
    requiredTerms: ["cuisine", "reservation", "dish", "atmosphere"],
    forbiddenTopics: ["dental", "orthodontics", "fillings", "check-ups"],
    defaultBulletPool: [
      "Wood-fired specials daily",
      "Fresh ingredients and seasonal plates",
      "Reservations recommended on weekends"
    ],
    imageQueryPresets: {
      hero: ["restaurant food hero", "cozy restaurant interior"],
      gallery: ["restaurant plated dishes", "restaurant dining room", "chef plating entree"]
    },
    requiredSections: ["hero", "services", "gallery", "reservation", "contact", "footer"],
    preferredPrimaryCta: "#reservation"
  },
  clinic: {
    key: "clinic",
    bannedPhrases: [...COMMON_BANNED_PHRASES, "book your table", "chef special", "nightlife vibe"],
    requiredTerms: ["cleanings", "check-ups", "hygiene", "comfort", "whitening"],
    forbiddenTopics: ["dining", "seasonal dishes", "menu", "chef", "table", "peak dinner", "cuisine"],
    defaultBulletPool: [
      "Gentle check-ups and cleanings",
      "Modern treatments with clear pricing",
      "Cosmetic and restorative dentistry"
    ],
    imageQueryPresets: {
      hero: ["dental clinic reception", "dental care patient comfort"],
      gallery: ["dental clinic treatment room", "dental team consultation", "dental office interior"]
    },
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredPrimaryCta: "#contact"
  },
  barber: {
    key: "barber",
    bannedPhrases: [...COMMON_BANNED_PHRASES, "enterprise transformation", "board-level strategy"],
    requiredTerms: ["cuts", "fade", "grooming", "appointments"],
    forbiddenTopics: ["seasonal dishes", "chef", "menu tasting", "table service"],
    defaultBulletPool: [
      "Precision cuts and clean fades",
      "Beard grooming tailored to your style",
      "Easy booking and walk-ins welcome"
    ],
    imageQueryPresets: {
      hero: ["barbershop interior modern", "barber cutting hair"],
      gallery: ["barber fade haircut", "barber beard trim", "barbershop workstation"]
    },
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredPrimaryCta: "#contact"
  },
  gym: {
    key: "gym",
    bannedPhrases: [...COMMON_BANNED_PHRASES, "fine dining", "menu tasting", "corporate procurement"],
    requiredTerms: ["training", "membership", "coaching"],
    forbiddenTopics: ["chef", "reservation for dinner", "table booking", "cuisine"],
    defaultBulletPool: [
      "Coach-led sessions for every level",
      "Strength and conditioning programs",
      "Flexible memberships with real support"
    ],
    imageQueryPresets: {
      hero: ["modern gym interior", "personal training session"],
      gallery: ["gym equipment", "group fitness class", "strength training workout"]
    },
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredPrimaryCta: "#contact"
  },
  "real-estate": {
    key: "real-estate",
    bannedPhrases: [...COMMON_BANNED_PHRASES, "chef-driven", "table booking"],
    requiredTerms: ["listings", "buyers", "sellers", "market"],
    forbiddenTopics: ["menu", "seasonal dishes", "chef", "dining room"],
    defaultBulletPool: [
      "Local market expertise for buyers and sellers",
      "Clear guidance from listing to closing",
      "Property strategy tailored to your goals"
    ],
    imageQueryPresets: {
      hero: ["modern home exterior real estate", "real estate agent showing property"],
      gallery: ["property interior living room", "home kitchen listing", "residential neighborhood"]
    },
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredPrimaryCta: "#contact"
  },
  agency: {
    key: "agency",
    bannedPhrases: [...COMMON_BANNED_PHRASES, "table for two", "guest seating"],
    requiredTerms: ["results", "strategy", "delivery"],
    forbiddenTopics: ["menu highlights", "chef specials", "dining"],
    defaultBulletPool: [
      "Strategy and execution under one team",
      "Clear reporting tied to business outcomes",
      "Fast iterations with measurable improvements"
    ],
    imageQueryPresets: {
      hero: ["creative agency workspace", "team strategy workshop"],
      gallery: ["branding design process", "marketing campaign planning", "agency team collaboration"]
    },
    requiredSections: ["hero", "services", "contact", "footer"],
    preferredPrimaryCta: "#contact"
  },
  generic: {
    key: "generic",
    bannedPhrases: [...COMMON_BANNED_PHRASES],
    requiredTerms: ["offer", "customers", "contact"],
    forbiddenTopics: [],
    defaultBulletPool: [
      "Clear services tailored to your needs",
      "Friendly support from start to finish",
      "Fast response and straightforward pricing"
    ],
    imageQueryPresets: {
      hero: ["professional business hero", "modern office interior"],
      gallery: ["business team collaboration", "professional workplace", "service detail photography"]
    },
    requiredSections: ["hero", "footer"],
    preferredPrimaryCta: "#contact"
  }
};

const inferNicheKey = (industry: string, templateId?: string): NicheKey => {
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
    return "restaurant";
  }

  if (
    normalized.includes("clinic") ||
    normalized.includes("medical") ||
    normalized.includes("dental") ||
    normalized.includes("dentist") ||
    normalized.includes("health")
  ) {
    return "clinic";
  }

  if (normalized.includes("barber") || normalized.includes("barbershop") || normalized.includes("groom")) {
    return "barber";
  }

  if (normalized.includes("gym") || normalized.includes("fitness") || normalized.includes("crossfit") || normalized.includes("yoga")) {
    return "gym";
  }

  if (normalized.includes("real estate") || normalized.includes("realtor") || normalized.includes("property")) {
    return "real-estate";
  }

  if (
    normalized.includes("agency") ||
    normalized.includes("consulting") ||
    normalized.includes("corporate") ||
    normalized.includes("marketing")
  ) {
    return "agency";
  }

  return "generic";
};

export const getNicheRules = (industry: string, templateId?: string): NicheRules => {
  return RULES[inferNicheKey(industry, templateId)];
};

