import type { BrandArchetypeConfig } from "@/lib/builder/generation/v2/types";

export const BRAND_ARCHETYPES: BrandArchetypeConfig[] = [
  {
    id: "bold_urban",
    industryId: "barbershop",
    label: "Bold Urban",
    tone: "confident and sharp",
    mood: "night energy, contrast, edge",
    density: "balanced",
    contrast: "high",
    imageTreatment: "high-contrast editorial photography with dark backgrounds and chrome highlights",
    ctaStyle: "solid",
    headlineStyle: "short, muscular, no filler",
    trustStyle: "reputation and regular-client credibility",
    proofStyle: "review summary and shop discipline",
    bannedPhrases: ["busy local clients", "reliable appointments", "professional team"],
    contentFlavor: ["sharp", "clean", "confident", "street-smart"],
    preferredLayoutIds: ["split_showcase", "immersive_stack"],
    fontPair: {
      heading: "Sora, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#111111",
      secondary: "#D4AF37",
      background: "#F4F0E8",
      accent: "#C2410C",
      text: "#111111",
      muted: "#5B5348",
      surface: "#FFF8EE",
      border: "rgba(17,17,17,0.12)",
      buttonText: "#FFF8EE"
    }
  },
  {
    id: "classic_gentleman",
    industryId: "barbershop",
    label: "Classic Gentleman",
    tone: "heritage, polished, disciplined",
    mood: "warm wood, old-school trust, tailored craft",
    density: "airy",
    contrast: "medium",
    imageTreatment: "warm editorial portraits and close grooming detail",
    ctaStyle: "outline",
    headlineStyle: "refined and understated",
    trustStyle: "craft tradition and consistency",
    proofStyle: "service standards and repeat-client culture",
    bannedPhrases: ["premier destination", "first-class service"],
    contentFlavor: ["tailored", "steady", "precise", "timeless"],
    preferredLayoutIds: ["editorial_stack", "split_showcase"],
    fontPair: {
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#2C241E",
      secondary: "#C59D5F",
      background: "#F6F1EA",
      accent: "#8B5E34",
      text: "#241B16",
      muted: "#6C5A4D",
      surface: "#FFF9F2",
      border: "rgba(44,36,30,0.14)",
      buttonText: "#FFF9F2"
    }
  },
  {
    id: "cozy_family_dining",
    industryId: "restaurant",
    label: "Cozy Family Dining",
    tone: "warm, generous, inviting",
    mood: "comfort, laughter, candlelight, familiar room",
    density: "balanced",
    contrast: "medium",
    imageTreatment: "warm food photography with ambient light",
    ctaStyle: "solid",
    headlineStyle: "appetite-first and welcoming",
    trustStyle: "returning guests and house favorites",
    proofStyle: "guest review summary",
    bannedPhrases: ["modern solutions", "tailored solutions"],
    contentFlavor: ["warm", "comforting", "generous", "house-made"],
    preferredLayoutIds: ["editorial_stack", "centered_story"],
    fontPair: {
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#7C2D12",
      secondary: "#F4B183",
      background: "#FFF7EE",
      accent: "#D97706",
      text: "#2A211A",
      muted: "#735E4A",
      surface: "#FFFDF9",
      border: "rgba(124,45,18,0.14)",
      buttonText: "#FFF8F1"
    }
  },
  {
    id: "premium_fine_dining",
    industryId: "restaurant",
    label: "Premium Fine Dining",
    tone: "restrained, luxurious, precise",
    mood: "dark room, soft highlights, careful plating",
    density: "airy",
    contrast: "high",
    imageTreatment: "moody, high-contrast food and table details",
    ctaStyle: "outline",
    headlineStyle: "short editorial statements",
    trustStyle: "chef confidence and memorable service",
    proofStyle: "reservation demand and signature dishes",
    bannedPhrases: ["quality service", "trusted partner"],
    contentFlavor: ["quiet confidence", "seasonal", "considered", "refined"],
    preferredLayoutIds: ["immersive_stack", "split_showcase"],
    fontPair: {
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#181311",
      secondary: "#C9A86A",
      background: "#F7F1E8",
      accent: "#8B5E34",
      text: "#171311",
      muted: "#66554B",
      surface: "#FFF9F2",
      border: "rgba(24,19,17,0.15)",
      buttonText: "#FFF7EE"
    }
  },
  {
    id: "calm_family_care",
    industryId: "dental_clinic",
    label: "Calm Family Care",
    tone: "reassuring and clear",
    mood: "soft light, trust, calm guidance",
    density: "airy",
    contrast: "soft",
    imageTreatment: "bright, clinical but welcoming imagery",
    ctaStyle: "solid",
    headlineStyle: "gentle, direct reassurance",
    trustStyle: "patient comfort and clear steps",
    proofStyle: "process clarity and patient review summary",
    bannedPhrases: ["high-quality care", "crafted with precision and care"],
    contentFlavor: ["clear", "gentle", "steady", "family-friendly"],
    preferredLayoutIds: ["centered_story", "editorial_stack"],
    fontPair: {
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#0F766E",
      secondary: "#BFE7DF",
      background: "#EFF7F5",
      accent: "#14B8A6",
      text: "#173432",
      muted: "#5C7773",
      surface: "#FFFFFF",
      border: "rgba(15,118,110,0.12)",
      buttonText: "#F8FFFD"
    }
  },
  {
    id: "modern_clinical_precision",
    industryId: "dental_clinic",
    label: "Modern Clinical Precision",
    tone: "clear, expert, exact",
    mood: "clean geometry, modern equipment, certainty",
    density: "balanced",
    contrast: "medium",
    imageTreatment: "clean spaces, crisp details, premium equipment",
    ctaStyle: "outline",
    headlineStyle: "clear statements with zero hype",
    trustStyle: "methodical expertise and treatment transparency",
    proofStyle: "credential and process proof",
    bannedPhrases: ["seamless experience", "all your needs"],
    contentFlavor: ["clinical clarity", "evidence-minded", "modern", "precise"],
    preferredLayoutIds: ["split_showcase", "conversion_grid"],
    fontPair: {
      heading: "Manrope, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#0F172A",
      secondary: "#93C5FD",
      background: "#F3F7FB",
      accent: "#2563EB",
      text: "#102033",
      muted: "#5B6B81",
      surface: "#FFFFFF",
      border: "rgba(15,23,42,0.12)",
      buttonText: "#F8FBFF"
    }
  },
  {
    id: "local_trusted_agency",
    industryId: "real_estate",
    label: "Local Trusted Agency",
    tone: "credible, local, practical",
    mood: "neighborhood fluency, steady guidance",
    density: "balanced",
    contrast: "medium",
    imageTreatment: "streetscapes, homes, daylight interiors",
    ctaStyle: "solid",
    headlineStyle: "specific and trust-led",
    trustStyle: "area expertise and process calm",
    proofStyle: "local market confidence",
    bannedPhrases: ["helping you every step of the way", "trusted partner"],
    contentFlavor: ["neighborhood-led", "practical", "credible", "steady"],
    preferredLayoutIds: ["split_showcase", "conversion_grid"],
    fontPair: {
      heading: "Manrope, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#1F2937",
      secondary: "#D4AF37",
      background: "#F7F5F0",
      accent: "#C0841A",
      text: "#16202C",
      muted: "#616D7C",
      surface: "#FFFFFF",
      border: "rgba(31,41,55,0.12)",
      buttonText: "#FDFBF6"
    }
  },
  {
    id: "luxury_property_advisory",
    industryId: "real_estate",
    label: "Luxury Property Advisory",
    tone: "polished and composed",
    mood: "editorial, architectural, premium restraint",
    density: "airy",
    contrast: "high",
    imageTreatment: "architecture-led, premium interiors, wide negative space",
    ctaStyle: "outline",
    headlineStyle: "short prestige statements",
    trustStyle: "market intelligence and private-service calm",
    proofStyle: "portfolio positioning and area confidence",
    bannedPhrases: ["enhancing your lifestyle", "where quality meets convenience"],
    contentFlavor: ["architectural", "composed", "assured", "market-aware"],
    preferredLayoutIds: ["immersive_stack", "editorial_stack"],
    fontPair: {
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    palette: {
      primary: "#141414",
      secondary: "#B9975B",
      background: "#F5F1EA",
      accent: "#8C6A3A",
      text: "#171411",
      muted: "#6A5A4A",
      surface: "#FFFDF9",
      border: "rgba(20,20,20,0.14)",
      buttonText: "#FFF8F1"
    }
  }
];
