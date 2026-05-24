import type { GenerationBriefData, QualityMode } from "@/lib/builder/generation-config";
import { BRAND_ARCHETYPES } from "@/lib/builder/generation/v2/archetypes";
import { LAYOUT_DNA_REGISTRY } from "@/lib/builder/generation/v2/layout-dna";
import { resolveThemeFontPair } from "@/lib/website-builder/theme/fonts";
import {
  STUDIO_SPEC_VERSION,
  StudioGenerationSpecSchema,
  type StudioCtaGoal,
  type StudioGenerationSpec,
  type StudioSectionType,
  type StudioStyleMode
} from "@/lib/website-studio/schema";

type LegacyContact = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type LegacyFeatures = {
  includeServices?: boolean;
  includeTestimonials?: boolean;
  includePricing?: boolean;
  includeFaq?: boolean;
  includeContact?: boolean;
  includeReservation?: boolean;
  includeGallery?: boolean;
};

export type LegacyStudioGenerationPayload = {
  siteId?: string | null;
  businessId?: string | null;
  businessName?: string | null;
  industry?: string | null;
  description?: string | null;
  tone?: string | null;
  language?: string | null;
  contentLanguage?: string | null;
  qualityMode?: QualityMode | string | null;
  brief?: Partial<GenerationBriefData> | null;
  generationBrief?: Partial<GenerationBriefData> | null;
  pagesMode?: string | null;
  templateId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
  contact?: LegacyContact | null;
  openingHours?: string | null;
  socials?: Record<string, string | null | undefined> | null;
  targetCustomer?: string | null;
  services?: string[] | null;
  proofAssets?: string[] | null;
  features?: LegacyFeatures | null;
  uploadedImages?: Array<{
    src?: string | null;
    alt?: string | null;
    width?: number;
    height?: number;
  }> | null;
  hasOwnPhotos?: boolean | null;
  studioSource?: StudioGenerationSpec["source"];
};

const DEFAULT_PRIMARY = "#111827";
const DEFAULT_SECONDARY = "#F3F4F6";
const DEFAULT_FONT = "Sora, Inter, system-ui, sans-serif";
const RESTAURANT_ARCHETYPE_IDS = ["cozy_family_dining", "premium_fine_dining"] as const;
const RESTAURANT_LAYOUT_IDS = [
  "split_showcase",
  "editorial_stack",
  "immersive_stack",
  "centered_story"
] as const;

const normalizeText = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeNullableText = (value: unknown) => {
  const trimmed = normalizeText(value);
  return trimmed || null;
};

const normalizeHex = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
  return fallback;
};

const uniqueList = (items: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return items
    .map((item) => normalizeText(item))
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    });
};

const includesAny = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.includes(term));

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const pickStableOption = <T,>(options: readonly T[], seed: number, fallback: T) => {
  if (!options.length) return fallback;
  return options[seed % options.length] ?? fallback;
};

const normalizeSocials = (value: LegacyStudioGenerationPayload["socials"]) => {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, socialValue]) => [key, normalizeNullableText(socialValue)] as const)
      .filter(([, socialValue]) => socialValue !== null)
  );
};

const getBrief = (payload: LegacyStudioGenerationPayload) => {
  const brief = payload.brief ?? payload.generationBrief ?? {};
  const tone = normalizeText(brief.tone ?? payload.tone, "professional");
  return {
    audience: normalizeText(brief.audience ?? payload.targetCustomer, "Local diners and guests"),
    coreOffer: normalizeText(brief.coreOffer ?? payload.description, "A polished restaurant experience"),
    primaryCtaGoal: normalizeText(brief.primaryCtaGoal, "reserve_table"),
    topServices: uniqueList([
      ...((Array.isArray(brief.topServices) ? brief.topServices : []) as string[]),
      ...((Array.isArray(payload.services) ? payload.services : []) as string[])
    ]).slice(0, 6),
    proofPoints: uniqueList([
      ...((Array.isArray(brief.proofPoints) ? brief.proofPoints : []) as string[]),
      ...((Array.isArray(payload.proofAssets) ? payload.proofAssets : []) as string[])
    ]).slice(0, 6),
    tone
  };
};

const inferCuisineType = (payload: LegacyStudioGenerationPayload) => {
  const source = `${payload.industry ?? ""} ${payload.description ?? ""}`.toLowerCase();
  const knownCuisines = [
    "italian",
    "mediterranean",
    "japanese",
    "sushi",
    "thai",
    "mexican",
    "french",
    "steakhouse",
    "seafood",
    "cafe",
    "bistro",
    "bakery",
    "vegan",
    "pizza"
  ];
  return knownCuisines.find((cuisine) => source.includes(cuisine)) ?? undefined;
};

const styleModeFromTone = (tone: string): StudioStyleMode => {
  const normalized = tone.toLowerCase();
  if (normalized.includes("premium") || normalized.includes("luxury")) return "premium";
  if (normalized.includes("elegant")) return "elegant";
  if (normalized.includes("casual") || normalized.includes("friendly")) return "casual";
  if (normalized.includes("minimal") || normalized.includes("clean")) return "minimal";
  if (normalized.includes("warm") || normalized.includes("cozy")) return "warm";
  if (normalized.includes("bold")) return "bold";
  return "modern";
};

const ctaGoalFromBrief = (goal: string, reservationEnabled: boolean): StudioCtaGoal => {
  const normalized = goal.toLowerCase();
  if (reservationEnabled || normalized.includes("reserve")) return "reserve_table";
  if (normalized.includes("menu")) return "view_menu";
  if (normalized.includes("call") || normalized.includes("appointment")) return "call";
  if (normalized.includes("direction") || normalized.includes("visit")) return "directions";
  return "contact";
};

const ambianceTagsFromInput = (text: string) => {
  const normalized = text.toLowerCase();
  return uniqueList([
    normalized.includes("premium") || normalized.includes("luxury") ? "premium" : null,
    normalized.includes("romantic") ? "romantic" : null,
    normalized.includes("family") ? "family" : null,
    normalized.includes("modern") ? "modern" : null,
    normalized.includes("elegant") ? "elegant" : null,
    normalized.includes("casual") || normalized.includes("friendly") ? "casual" : null,
    normalized.includes("cozy") || normalized.includes("warm") ? "cozy" : null,
    normalized.includes("lively") || normalized.includes("bold") ? "lively" : null,
    normalized.includes("minimal") || normalized.includes("clean") ? "minimal" : null,
    normalized.includes("traditional") || normalized.includes("classic") ? "traditional" : null
  ]) as StudioGenerationSpec["business"]["ambianceTags"];
};

const RESTAURANT_ARCHETYPES = BRAND_ARCHETYPES.filter((entry) =>
  RESTAURANT_ARCHETYPE_IDS.includes(entry.id as (typeof RESTAURANT_ARCHETYPE_IDS)[number])
);

const RESTAURANT_LAYOUTS = LAYOUT_DNA_REGISTRY.filter((entry) =>
  RESTAURANT_LAYOUT_IDS.includes(entry.id as (typeof RESTAURANT_LAYOUT_IDS)[number])
);

const RESTAURANT_FONT_IDS = ["playfair", "cormorant", "jakarta", "space-grotesk", "manrope"] as const;

const resolveRestaurantFontFamily = (params: {
  archetypeId?: string;
  layoutId?: string;
  styleMode: StudioStyleMode;
  tone: string;
  description: string;
  ambianceTags: StudioGenerationSpec["business"]["ambianceTags"];
  businessName: string;
}) => {
  const normalized = `${params.tone} ${params.description} ${params.ambianceTags.join(" ")}`.toLowerCase();
  const seed = hashString(
    `${params.businessName}:${params.archetypeId ?? ""}:${params.layoutId ?? ""}:${normalized}`
  );

  let fontId: (typeof RESTAURANT_FONT_IDS)[number] = "playfair";
  if (
    includesAny(normalized, ["luxury", "luxurious", "premium", "elegant", "romantic", "chef's table"])
  ) {
    fontId = pickStableOption(["cormorant", "playfair"], seed, "cormorant");
  } else if (includesAny(normalized, ["modern", "minimal", "clean", "sleek", "refined"])) {
    fontId = pickStableOption(["jakarta", "space-grotesk", "manrope"], seed, "jakarta");
  } else if (includesAny(normalized, ["warm", "cozy", "family", "comfort", "welcoming"])) {
    fontId = pickStableOption(["playfair", "jakarta"], seed, "playfair");
  } else if (params.layoutId === "split_showcase") {
    fontId = pickStableOption(["jakarta", "manrope"], seed, "jakarta");
  } else if (params.layoutId === "immersive_stack") {
    fontId = pickStableOption(["cormorant", "playfair"], seed, "cormorant");
  } else if (params.archetypeId === "premium_fine_dining") {
    fontId = pickStableOption(["playfair", "cormorant"], seed, "playfair");
  }

  return resolveThemeFontPair(fontId).value;
};

const resolveRestaurantArchetype = (params: {
  styleMode: StudioStyleMode;
  description: string;
  tone: string;
  ambianceTags: StudioGenerationSpec["business"]["ambianceTags"];
}) => {
  const normalized = `${params.tone} ${params.description} ${params.ambianceTags.join(" ")}`.toLowerCase();
  if (
    params.styleMode === "premium" ||
    params.styleMode === "elegant" ||
    normalized.includes("luxury") ||
    normalized.includes("fine dining") ||
    normalized.includes("romantic")
  ) {
    return RESTAURANT_ARCHETYPES.find((entry) => entry.id === "premium_fine_dining") ?? RESTAURANT_ARCHETYPES[0];
  }
  return RESTAURANT_ARCHETYPES.find((entry) => entry.id === "cozy_family_dining") ?? RESTAURANT_ARCHETYPES[0];
};

const resolveRestaurantLayout = (params: {
  archetypeId?: string;
  styleMode: StudioStyleMode;
  tone: string;
  description: string;
  businessName: string;
}) => {
  const normalized = `${params.tone} ${params.description}`.toLowerCase();
  const seed = hashString(`${params.businessName}:${params.archetypeId ?? ""}:${normalized}`);
  if (params.styleMode === "premium" || params.styleMode === "elegant" || normalized.includes("dramatic")) {
    return RESTAURANT_LAYOUTS.find((entry) => entry.id === "immersive_stack") ?? RESTAURANT_LAYOUTS[0];
  }
  if (params.styleMode === "minimal" || normalized.includes("clean") || normalized.includes("modern")) {
    return pickStableOption(
      RESTAURANT_LAYOUTS.filter((entry) => entry.id === "split_showcase" || entry.id === "editorial_stack"),
      seed,
      RESTAURANT_LAYOUTS[0]
    );
  }
  if (params.styleMode === "warm" || params.styleMode === "casual" || normalized.includes("family")) {
    return RESTAURANT_LAYOUTS.find((entry) => entry.id === "centered_story") ?? RESTAURANT_LAYOUTS[0];
  }
  const archetype = RESTAURANT_ARCHETYPES.find((entry) => entry.id === params.archetypeId);
  const preferred = archetype?.preferredLayoutIds.find((layoutId) =>
    RESTAURANT_LAYOUT_IDS.includes(layoutId as (typeof RESTAURANT_LAYOUT_IDS)[number])
  );
  return (
    RESTAURANT_LAYOUTS.find((entry) => entry.id === preferred) ??
    pickStableOption(
      RESTAURANT_LAYOUTS.filter((entry) => entry.id === "editorial_stack" || entry.id === "split_showcase"),
      seed,
      RESTAURANT_LAYOUTS[0]
    )
  );
};

const resolveInitialVariants = (params: {
  layoutId?: string;
  archetypeId?: string;
  tone: string;
  description: string;
  ambianceTags: StudioGenerationSpec["business"]["ambianceTags"];
  businessName: string;
}) => {
  const layout = RESTAURANT_LAYOUTS.find((entry) => entry.id === params.layoutId);
  const variantBias = layout?.sectionVariantBias ?? {};
  const normalized = `${params.tone} ${params.description} ${params.ambianceTags.join(" ")}`.toLowerCase();
  const seed = hashString(
    `${params.businessName}:${params.archetypeId ?? ""}:${params.layoutId ?? ""}:${normalized}`
  );
  const prefersDramatic = includesAny(normalized, [
    "premium",
    "luxury",
    "luxurious",
    "elegant",
    "dramatic",
    "fine dining",
    "romantic"
  ]);
  const prefersClean = includesAny(normalized, ["modern", "minimal", "clean", "refined", "sleek"]);
  const prefersWarm = includesAny(normalized, ["warm", "cozy", "family", "welcoming", "friendly", "comfort"]);
  const pick = (sectionType: keyof typeof variantBias, fallback: string, preferredIndex = 0) => {
    const options = [...new Set((variantBias[sectionType] ?? []).filter(Boolean))];
    if (!options.length) return fallback;
    if (prefersDramatic && ["hero", "gallery", "testimonials", "reservation", "cta"].includes(sectionType)) {
      return options[Math.min(1, options.length - 1)] ?? options[0] ?? fallback;
    }
    if (prefersClean && ["hero", "services", "about", "contact"].includes(sectionType)) {
      return options[Math.min(preferredIndex, options.length - 1)] ?? options[0] ?? fallback;
    }
    if (prefersWarm && ["about", "services", "reservation", "contact"].includes(sectionType)) {
      return options[0] ?? fallback;
    }
    return pickStableOption(options, seed + sectionType.length, options[0] ?? fallback);
  };
  return {
    hero: pick("hero", "B", 0),
    intro: pick("about", "E", 0),
    signature_dishes: pick("services", "E", 0),
    reservation_cta: pick("reservation", pick("cta", "B", 0), 0),
    gallery: pick("gallery", "D", prefersDramatic ? 1 : 0),
    testimonials: pick("testimonials", "C", prefersDramatic ? 1 : 0),
    location_hours: pick("contact", "E", 0),
    footer: "B"
  } satisfies Partial<Record<StudioSectionType, string>>;
};

const buildRestaurantSections = (params: {
  reservationEnabled: boolean;
  includeGallery: boolean;
  includeTestimonials: boolean;
  variants: Partial<Record<StudioSectionType, string>>;
}) => {
  const sections: Array<{
    id: string;
    type: StudioSectionType;
    rendersAs: StudioGenerationSpec["structure"]["sections"][number]["rendersAs"];
    required: boolean;
    enabled: boolean;
    variant: string;
    constraints: string[];
  }> = [
    {
      id: "nav",
      type: "navbar",
      rendersAs: null,
      required: true,
      enabled: true,
      variant: "anchor-nav",
      constraints: ["Use only approved anchor destinations.", "Do not invent extra navigation items."]
    },
    {
      id: "hero",
      type: "hero",
      rendersAs: "hero",
      required: true,
      enabled: true,
      variant: params.variants.hero ?? "B",
      constraints: ["Lead with the restaurant name and one clear reservation or contact CTA."]
    },
    {
      id: "intro",
      type: "intro",
      rendersAs: "about",
      required: true,
      enabled: true,
      variant: params.variants.intro ?? "E",
      constraints: ["Explain the dining concept without generic filler copy."]
    },
    {
      id: "signature-dishes",
      type: "signature_dishes",
      rendersAs: "services",
      required: true,
      enabled: true,
      variant: params.variants.signature_dishes ?? "E",
      constraints: ["Use menu or signature dish content only from SiroundChat inputs."]
    },
    {
      id: "reservations",
      type: "reservation_cta",
      rendersAs: "reservation",
      required: params.reservationEnabled,
      enabled: params.reservationEnabled,
      variant: params.variants.reservation_cta ?? "B",
      constraints: ["Keep reservation behavior compatible with SiroundChat forms and publish renderer."]
    },
    {
      id: "gallery",
      type: "gallery",
      rendersAs: "gallery",
      required: false,
      enabled: params.includeGallery,
      variant: params.variants.gallery ?? "D",
      constraints: ["Use uploaded or normalized gallery assets before stock-like imagery."]
    },
    {
      id: "testimonials",
      type: "testimonials",
      rendersAs: "testimonials",
      required: false,
      enabled: params.includeTestimonials,
      variant: params.variants.testimonials ?? "C",
      constraints: ["Do not invent named customer reviews unless supplied."]
    },
    {
      id: "location-hours",
      type: "location_hours",
      rendersAs: "contact",
      required: true,
      enabled: true,
      variant: params.variants.location_hours ?? "E",
      constraints: ["Use provided address, phone, email, and hours as source of truth."]
    },
    {
      id: "footer",
      type: "footer",
      rendersAs: "footer",
      required: true,
      enabled: true,
      variant: params.variants.footer ?? "B",
      constraints: ["Keep footer minimal and consistent with navbar destinations."]
    }
  ];

  return sections.map((section, order) => ({ ...section, order }));
};

const buildNavbar = (reservationEnabled: boolean) => {
  const nav = [
    { id: "nav-home", label: "Home", href: "#hero", targetSectionId: "hero" },
    { id: "nav-menu", label: "Menu", href: "#signature-dishes", targetSectionId: "signature-dishes" },
    reservationEnabled
      ? { id: "nav-reservations", label: "Reservations", href: "#reservations", targetSectionId: "reservations" }
      : null,
    { id: "nav-about", label: "About", href: "#intro", targetSectionId: "intro" },
    { id: "nav-contact", label: "Contact", href: "#location-hours", targetSectionId: "location-hours" }
  ].filter(Boolean) as Array<{ id: string; label: string; href: string; targetSectionId: string }>;

  return nav.map((item, order) => ({ ...item, order, locked: true }));
};

export function buildRestaurantStudioSpecFromGenerationPayload(
  payload: LegacyStudioGenerationPayload
): StudioGenerationSpec {
  const brief = getBrief(payload);
  const businessName = normalizeText(payload.businessName, "Restaurant");
  const description = normalizeText(payload.description ?? brief.coreOffer, `${businessName} restaurant website`);
  const tone = normalizeText(payload.tone ?? brief.tone, "modern");
  const styleMode = styleModeFromTone(`${tone} ${description}`);
  const ambianceTags = ambianceTagsFromInput(`${tone} ${description}`);
  const archetype = resolveRestaurantArchetype({
    styleMode,
    description,
    tone,
    ambianceTags
  });
  const layout = resolveRestaurantLayout({
    archetypeId: archetype?.id,
    styleMode,
    tone,
    description,
    businessName
  });
  const defaultPaletteRequested =
    normalizeHex(payload.primaryColor, DEFAULT_PRIMARY) === DEFAULT_PRIMARY &&
    normalizeHex(payload.secondaryColor, DEFAULT_SECONDARY) === DEFAULT_SECONDARY;
  const primaryColor = defaultPaletteRequested
    ? archetype?.palette.primary ?? DEFAULT_PRIMARY
    : normalizeHex(payload.primaryColor, DEFAULT_PRIMARY);
  const secondaryColor = defaultPaletteRequested
    ? archetype?.palette.background ?? DEFAULT_SECONDARY
    : normalizeHex(payload.secondaryColor, DEFAULT_SECONDARY);
  const resolvedFontFamily = defaultPaletteRequested
    ? resolveRestaurantFontFamily({
        archetypeId: archetype?.id,
        layoutId: layout?.id,
        styleMode,
        tone,
        description,
        ambianceTags,
        businessName
      })
    : normalizeText(payload.fontFamily, DEFAULT_FONT);
  const reservationEnabled = Boolean(
    payload.features?.includeReservation ||
      brief.primaryCtaGoal.toLowerCase().includes("reserve") ||
      `${payload.industry ?? ""} ${description}`.toLowerCase().includes("restaurant")
  );
  const ctaGoal = ctaGoalFromBrief(brief.primaryCtaGoal, reservationEnabled);
  const services = brief.topServices.length
    ? brief.topServices
    : ["Signature dishes", "Table reservations", "Location and hours"];
  const galleryImages = (payload.uploadedImages ?? [])
    .filter((image) => image?.src)
    .map((image) => ({
      src: String(image.src),
      alt: normalizeText(image.alt, `${businessName} gallery image`),
      width: image.width,
      height: image.height
    }));
  const sections = buildRestaurantSections({
    reservationEnabled,
    includeGallery: Boolean(payload.features?.includeGallery || galleryImages.length),
    includeTestimonials: Boolean(payload.features?.includeTestimonials),
    variants: resolveInitialVariants({
      layoutId: layout?.id,
      archetypeId: archetype?.id,
      tone,
      description,
      ambianceTags,
      businessName
    })
  });
  const enabledSectionIds = sections.filter((section) => section.enabled).map((section) => section.id);
  const createdAt = new Date().toISOString();

  const spec = {
    version: STUDIO_SPEC_VERSION,
    vertical: "restaurant",
    source: payload.studioSource ?? "prompt_studio",
    sourcePrompt: description,
    businessId: normalizeText(payload.businessId, "pending-business"),
    siteId: normalizeNullableText(payload.siteId),
    business: {
      name: businessName,
      category: "restaurant",
      description,
      cuisineType: inferCuisineType(payload),
      toneStyle: tone,
      priceFeel: undefined,
      diningFeel: styleMode,
      phone: normalizeNullableText(payload.contact?.phone),
      email: normalizeNullableText(payload.contact?.email),
      address: normalizeNullableText(payload.contact?.address),
      openingHours: normalizeNullableText(payload.openingHours),
      reservation: {
        enabled: reservationEnabled,
        label: reservationEnabled ? "Reserve a table" : "Contact us",
        href: reservationEnabled ? "#reservations" : "#location-hours"
      },
      ctaGoal,
      socials: normalizeSocials(payload.socials),
      logoUrl: normalizeNullableText(payload.logoUrl),
      galleryImages,
      primaryColor,
      secondaryColor,
      menu: {
        source: null,
        items: services.map((name) => ({
          name,
          description: "Highlight this offering with concise restaurant-specific copy.",
          featured: true
        }))
      },
      signatureDishes: services,
      ambianceTags
    },
    theme: {
      primary: primaryColor,
      secondary: archetype?.palette.secondary ?? secondaryColor,
      background: archetype?.palette.background ?? secondaryColor,
      surface: archetype?.palette.surface ?? "#FFFFFF",
      text: archetype?.palette.text ?? "#111827",
      muted: archetype?.palette.muted ?? "#6B7280",
      border: normalizeHex(archetype?.palette.border, "#E5E7EB"),
      buttonText: archetype?.palette.buttonText ?? "#FFFFFF",
      styleMode,
      motionProfile: "subtle",
      radius: "xl",
      fontFamily: resolvedFontFamily
    },
    structure: {
      architecture: "single_page_restaurant",
      pages: [
        {
          id: "home",
          title: "Home",
          slug: "home",
          architecture: "single_page_anchor",
          showInNav: true,
          order: 0,
          sectionIds: enabledSectionIds
        }
      ],
      navbar: buildNavbar(reservationEnabled),
      sections,
      allowedPages: ["Home", "Menu", "Reservations", "About", "Contact"],
      allowedSectionTypes: [
        "navbar",
        "hero",
        "intro",
        "signature_dishes",
        "reservation_cta",
        "gallery",
        "testimonials",
        "location_hours",
        "footer"
      ],
      disallowUnknownSections: true,
      disallowFreeformCanvas: true
    },
    content: {
      hero: {
        eyebrow: inferCuisineType(payload) ? `${inferCuisineType(payload)} restaurant` : "Restaurant",
        headline: businessName,
        subheadline: brief.coreOffer,
        primaryCtaLabel: reservationEnabled ? "Reserve a table" : "Contact us",
        primaryCtaHref: reservationEnabled ? "#reservations" : "#location-hours"
      },
      intro: {
        title: `About ${businessName}`,
        body: description
      },
      menuHighlights: {
        title: "Signature highlights",
        items: services.map((name) => ({
          name,
          description: "Highlight this offering with concise restaurant-specific copy.",
          featured: true
        }))
      },
      testimonials: brief.proofPoints.map((proofPoint) => ({
        quote: proofPoint,
        name: "Guest note"
      })),
      gallery: galleryImages,
      cta: {
        title: reservationEnabled ? "Plan your visit" : "Get in touch",
        body: reservationEnabled
          ? "Make it easy for guests to request a table and understand the dining experience."
          : "Make it easy for visitors to contact the restaurant.",
        label: reservationEnabled ? "Reserve a table" : "Contact us",
        href: reservationEnabled ? "#reservations" : "#location-hours"
      },
      contact: {
        title: "Location and hours",
        body: "Keep restaurant contact details clear, accurate, and easy to act on.",
        phone: normalizeNullableText(payload.contact?.phone),
        email: normalizeNullableText(payload.contact?.email),
        address: normalizeNullableText(payload.contact?.address),
        openingHours: normalizeNullableText(payload.openingHours)
      },
      footer: {
        text: `${businessName} - Website by SiroundChat`
      }
    },
    rules: {
      promptConstraints: [
        "Generate only within the SiroundChat restaurant site schema.",
        "Use the provided business data as source of truth.",
        "Do not invent extra pages, custom navigation systems, or unsupported sections.",
        "Do not produce raw custom-code editing flows for business users.",
        `Choose one approved restaurant design direction: ${RESTAURANT_ARCHETYPES.map((entry) => `${entry.id} (${entry.label})`).join(" | ")}.`,
        `Choose one approved layout DNA: ${RESTAURANT_LAYOUTS.map((entry) => `${entry.id} (${entry.label})`).join(" | ")}.`,
        "Use supported variation levers deliberately: theme mood, contrast, typography mood, section rhythm, hero treatment, gallery treatment, testimonial treatment, and reservation emphasis.",
        "Do not collapse every restaurant back into the same neutral editorial baseline."
      ],
      themePolicy: [
        "Use primary and secondary theme tokens as the color source of truth.",
        "Do not introduce random accent colors unless derived from provided tokens or an approved SiroundChat restaurant archetype palette.",
        "Keep typography and spacing premium, readable, and mobile-safe.",
        "Use approved layout DNA, section variants, section background treatments, and typography mood to create visibly different restaurant websites without breaking the renderer.",
        "Preserve stronger contrast, darker palettes, warmer surfaces, or cleaner minimal spacing when they match the business and user request."
      ],
      navPolicy: [
        "Use anchored single-page navigation unless SiroundChat explicitly requests multi-page.",
        "Keep navbar labels constrained to Home, Menu, Reservations, About, and Contact.",
        "Hide Reservations when reservation is disabled."
      ],
      pagePolicy: [
        "Default to one restaurant landing page with anchored sections.",
        "Allowed expanded pages are Home, Menu, Reservations, About, and Contact only.",
        "Never let the provider invent arbitrary page architecture."
      ],
      refinementPolicy: [
        "Classify natural-language refinement before applying it.",
        "Apply the smallest scoped change possible.",
        "Allowed scopes are full site, page, section, content only, theme only, and navbar only."
      ]
    },
    compatibility: {
      legacyIndustry: normalizeText(payload.industry, "Restaurant"),
      legacyTemplateId: normalizeNullableText(payload.templateId),
      pagesMode: payload.pagesMode === "multi" ? "multi" : "one",
      generationBrief: brief
    },
    createdAt
  };

  return StudioGenerationSpecSchema.parse(spec);
}

export function buildStudioProviderPrompt(spec: StudioGenerationSpec) {
  return [
    "Generate a restaurant website inside SiroundChat-owned constraints.",
    `Business: ${spec.business.name}`,
    `Cuisine: ${spec.business.cuisineType ?? "restaurant"}`,
    `Tone/style: ${spec.business.toneStyle}`,
    `CTA goal: ${spec.business.ctaGoal}`,
    `Theme tokens: ${JSON.stringify(spec.theme)}`,
    `Approved restaurant archetypes: ${RESTAURANT_ARCHETYPES.map((entry) => entry.id).join(", ")}`,
    `Approved layout DNA: ${RESTAURANT_LAYOUTS.map((entry) => entry.id).join(", ")}`,
    `Allowed pages: ${spec.structure.allowedPages.join(", ")}`,
    `Allowed sections: ${spec.structure.allowedSectionTypes.join(", ")}`,
    `Enabled section order: ${spec.structure.sections
      .filter((section) => section.enabled)
      .map((section) => `${section.id}:${section.type}`)
      .join(" -> ")}`,
    `Suggested starter direction: ${spec.theme.styleMode} mood with ${spec.theme.fontFamily} and section variants ${spec.structure.sections
      .filter((section) => section.enabled && section.rendersAs)
      .map((section) => `${section.type}:${section.variant}`)
      .join(", ")}`,
    "Use only the structured business/content/theme data in the provided JSON spec.",
    "Do not invent unknown nav items, pages, sections, random colors, raw code editing, or drag-and-drop behavior.",
    "Choose approved palette, typography, layout, hero/gallery/testimonial/reservation treatments, and section-variant mixes that keep the output materially different across restaurants while still rendering inside SiroundChat.",
    `Structured spec JSON: ${JSON.stringify(spec)}`
  ].join("\n");
}
