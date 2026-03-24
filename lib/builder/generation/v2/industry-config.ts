import type { IndustryConfig } from "@/lib/builder/generation/v2/types";

export const INDUSTRY_CONFIGS: Record<IndustryConfig["id"], IndustryConfig> = {
  barbershop: {
    id: "barbershop",
    label: "Barbershop",
    detectionKeywords: ["barber", "barbershop", "fade", "beard", "grooming", "cut"],
    primaryConversionGoals: ["book appointments", "show style and vibe", "show services", "build local trust"],
    allowedSections: [
      "hero",
      "signature_services",
      "service_pricing",
      "gallery_showcase",
      "brand_story",
      "proof_grid",
      "review_summary",
      "faq",
      "booking_cta",
      "contact_hours",
      "footer"
    ],
    discouragedSections: ["menu_preview", "payment_info", "featured_listings", "buyer_seller_services"],
    preferredSectionStacks: [
      ["hero", "signature_services", "gallery_showcase", "brand_story", "proof_grid", "booking_cta", "contact_hours", "footer"],
      ["hero", "signature_services", "proof_grid", "gallery_showcase", "review_summary", "booking_cta", "contact_hours", "footer"],
      ["hero", "service_pricing", "gallery_showcase", "brand_story", "faq", "booking_cta", "contact_hours", "footer"]
    ],
    contentRules: [
      "Keep headlines punchy and visual.",
      "Sound local and confident, never corporate.",
      "Write like a barbershop, not a SaaS landing page."
    ],
    trustPatterns: ["repeat clientele", "shop reputation", "years in the chair", "clean timing", "walk-ins or bookings"],
    ctaPatterns: ["Book a cut", "See open slots", "Plan your next trim"],
    mediaNeeds: ["shop interior", "finished cuts", "close-up grooming details"],
    toneConstraints: {
      preferred: ["confident", "stylish", "local", "direct"],
      avoid: ["corporate", "consultative", "soft B2B language"]
    },
    userJourneys: [
      "See the vibe quickly",
      "Understand what services are offered",
      "Decide whether the shop feels right",
      "Book without friction"
    ],
    mustHaveInformation: ["services", "booking CTA", "hours or location", "proof of consistent quality"],
    proofFallbacks: ["review summary", "years in business", "repeat-client positioning", "local reputation line"]
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    detectionKeywords: ["restaurant", "cafe", "bistro", "dining", "food", "menu", "kitchen"],
    primaryConversionGoals: ["drive reservations", "help guests browse the menu", "sell atmosphere", "show location and hours"],
    allowedSections: [
      "hero",
      "featured_dishes",
      "menu_preview",
      "atmosphere_story",
      "gallery_showcase",
      "review_summary",
      "reservation_cta",
      "contact_hours",
      "footer"
    ],
    discouragedSections: ["buyer_seller_services", "featured_listings", "payment_info"],
    preferredSectionStacks: [
      ["hero", "featured_dishes", "menu_preview", "atmosphere_story", "gallery_showcase", "reservation_cta", "contact_hours", "footer"],
      ["hero", "atmosphere_story", "featured_dishes", "gallery_showcase", "review_summary", "reservation_cta", "contact_hours", "footer"],
      ["hero", "menu_preview", "gallery_showcase", "atmosphere_story", "reservation_cta", "contact_hours", "footer"]
    ],
    contentRules: [
      "Use sensory, appetite-driven language.",
      "Describe atmosphere with concrete cues.",
      "Keep reservation language obvious and low-friction."
    ],
    trustPatterns: ["busy nights", "signature dishes", "guest favorites", "chef or house specialties", "repeat diners"],
    ctaPatterns: ["Reserve a table", "Plan dinner", "See tonight's menu"],
    mediaNeeds: ["dishes", "interior lighting", "seating", "table setting", "bar or kitchen details"],
    toneConstraints: {
      preferred: ["warm", "appetizing", "lively", "premium when appropriate"],
      avoid: ["consulting language", "abstract promises", "feature grids that feel SaaS-like"]
    },
    userJourneys: [
      "Understand the vibe fast",
      "See what kind of food is served",
      "Check whether the place fits the occasion",
      "Reserve or visit"
    ],
    mustHaveInformation: ["menu cues", "reservation path", "hours", "location"],
    proofFallbacks: ["guest review summary", "house specialties", "chef focus", "popular dining times"]
  },
  dental_clinic: {
    id: "dental_clinic",
    label: "Dental Clinic",
    detectionKeywords: ["dental", "dentist", "clinic", "orthodont", "teeth", "implant", "hygiene"],
    primaryConversionGoals: ["build trust", "reduce anxiety", "explain treatments clearly", "make booking easy"],
    allowedSections: [
      "hero",
      "treatments_grid",
      "clinic_reassurance",
      "proof_grid",
      "review_summary",
      "faq",
      "payment_info",
      "booking_cta",
      "contact_hours",
      "footer"
    ],
    discouragedSections: ["featured_dishes", "menu_preview", "featured_listings"],
    preferredSectionStacks: [
      ["hero", "treatments_grid", "clinic_reassurance", "proof_grid", "faq", "booking_cta", "contact_hours", "footer"],
      ["hero", "treatments_grid", "review_summary", "clinic_reassurance", "payment_info", "booking_cta", "contact_hours", "footer"],
      ["hero", "clinic_reassurance", "treatments_grid", "proof_grid", "faq", "booking_cta", "contact_hours", "footer"]
    ],
    contentRules: [
      "Lead with reassurance, not hype.",
      "Use clear treatment language and plain explanations.",
      "Trust must feel earned, not exaggerated."
    ],
    trustPatterns: ["gentle care", "clear treatment plans", "modern clinic standards", "family or cosmetic expertise", "transparent next steps"],
    ctaPatterns: ["Book an assessment", "Talk to the clinic", "Plan your visit"],
    mediaNeeds: ["clean treatment rooms", "welcoming reception", "professional portraits", "equipment details"],
    toneConstraints: {
      preferred: ["calm", "clear", "reassuring", "professional"],
      avoid: ["salesy urgency", "flashy claims", "fear-based messaging"]
    },
    userJourneys: [
      "Feel safe enough to book",
      "Understand what treatments are offered",
      "See why this clinic is credible",
      "Know how payment and booking work"
    ],
    mustHaveInformation: ["treatments", "trust mechanism", "booking path", "contact information"],
    proofFallbacks: ["credentials summary", "patient experience principles", "clinic process clarity", "payment transparency"]
  },
  real_estate: {
    id: "real_estate",
    label: "Real Estate Agency",
    detectionKeywords: ["real estate", "realty", "property", "broker", "agency", "homes", "listings"],
    primaryConversionGoals: ["capture leads", "show market expertise", "show buying and selling support", "build trust"],
    allowedSections: [
      "hero",
      "featured_listings",
      "buyer_seller_services",
      "neighborhood_expertise",
      "proof_grid",
      "review_summary",
      "lead_cta",
      "contact_hours",
      "footer"
    ],
    discouragedSections: ["featured_dishes", "menu_preview", "payment_info"],
    preferredSectionStacks: [
      ["hero", "featured_listings", "buyer_seller_services", "neighborhood_expertise", "proof_grid", "lead_cta", "contact_hours", "footer"],
      ["hero", "buyer_seller_services", "featured_listings", "review_summary", "neighborhood_expertise", "lead_cta", "contact_hours", "footer"],
      ["hero", "featured_listings", "proof_grid", "buyer_seller_services", "lead_cta", "contact_hours", "footer"]
    ],
    contentRules: [
      "Sound credible and market-aware.",
      "Talk about area knowledge and process clarity.",
      "CTA copy should convert inquiries, not sound vague."
    ],
    trustPatterns: ["local expertise", "buyer guidance", "seller positioning", "transaction confidence", "market familiarity"],
    ctaPatterns: ["Ask about a property", "Book a viewing", "Get local advice"],
    mediaNeeds: ["homes", "streetscapes", "neighborhood landmarks", "interior detail shots"],
    toneConstraints: {
      preferred: ["credible", "polished", "informative", "lead-focused"],
      avoid: ["empty luxury clichés", "generic lifestyle language", "invented success stories"]
    },
    userJourneys: [
      "Understand what type of property help is offered",
      "Assess whether the agency knows the area",
      "See a clear next step for inquiry",
      "Make contact without friction"
    ],
    mustHaveInformation: ["property focus", "buyer/seller support", "area expertise", "lead CTA"],
    proofFallbacks: ["market knowledge", "client process clarity", "neighborhood focus", "service differentiation"]
  }
};

export const detectSupportedIndustry = (industry: string, subtype?: string | null, description?: string | null) => {
  const haystack = `${industry} ${subtype ?? ""} ${description ?? ""}`.toLowerCase();
  const match = Object.values(INDUSTRY_CONFIGS).find((config) =>
    config.detectionKeywords.some((keyword) => haystack.includes(keyword))
  );
  return match?.id ?? null;
};
