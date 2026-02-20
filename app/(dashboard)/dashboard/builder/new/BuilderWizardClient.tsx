"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATE_META } from "@/lib/website-builder/templates/registry";

const INDUSTRY_OPTIONS = [
  "Restaurant",
  "Ecommerce",
  "Portfolio",
  "Tech company",
  "Non-profit",
  "Event",
  "Consulting",
  "Agency",
  "Service",
  "Other"
];

type ToneOption = "friendly" | "premium" | "corporate" | "bold" | "minimal";
type PagesMode = "one" | "multi";

type SocialLinks = {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;
};

type ToggleKey =
  | "includeServices"
  | "includeGallery"
  | "includeTestimonials"
  | "includePricing"
  | "includeFaq"
  | "includeContact"
  | "includeReservation";

const normalizeIndustry = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return { selected: "Restaurant", custom: "" };
  }
  const match = INDUSTRY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase()
  );
  if (match) {
    return { selected: match, custom: "" };
  }
  return { selected: "Other", custom: trimmed };
};

type BuilderWizardClientProps = {
  businessId: string;
  initialBusinessName: string;
  initialIndustry: string | null;
  initialLogoUrl: string | null;
};

type DraftState = {
  businessName: string;
  industry: string;
  description: string;
  tone: ToneOption;
  pagesMode: PagesMode;
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  openingHours: string;
  socials: SocialLinks;
  includeServices: boolean;
  includeTestimonials: boolean;
  includePricing: boolean;
  includeFaq: boolean;
  includeContact: boolean;
  includeReservation: boolean;
  includeGallery: boolean;
  hasOwnPhotos: boolean;
};

const resolveToneDefault = (industryValue: string): ToneOption => {
  const normalized = industryValue.toLowerCase();
  if (normalized.includes("consulting") || normalized.includes("corporate")) {
    return "corporate";
  }
  if (normalized.includes("restaurant")) {
    return "friendly";
  }
  if (normalized.includes("agency")) {
    return "premium";
  }
  if (normalized.includes("service")) {
    return "bold";
  }
  return "minimal";
};

const TONE_OPTIONS: Array<{ value: ToneOption; label: string }> = [
  { value: "friendly", label: "Friendly" },
  { value: "premium", label: "Premium" },
  { value: "corporate", label: "Corporate" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" }
];

const PAGES_OPTIONS: Array<{ value: PagesMode; label: string }> = [
  { value: "one", label: "One-page" },
  { value: "multi", label: "Multi-page" }
];

const FONT_PAIRS = [
  {
    label: "Sora + Inter",
    value: "Sora, Inter, system-ui, sans-serif",
    heading: "Sora, Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif"
  },
  {
    label: "Manrope + Inter",
    value: "Manrope, Inter, system-ui, sans-serif",
    heading: "Manrope, Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif"
  },
  {
    label: "Space Grotesk + Inter",
    value: "\"Space Grotesk\", Inter, system-ui, sans-serif",
    heading: "\"Space Grotesk\", Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif"
  },
  {
    label: "Playfair Display + Inter",
    value: "\"Playfair Display\", Inter, system-ui, sans-serif",
    heading: "\"Playfair Display\", Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif"
  }
];

const SECTION_TOGGLES: Array<{ key: ToggleKey; label: string }> = [
  { key: "includeServices", label: "Services" },
  { key: "includeGallery", label: "Gallery" },
  { key: "includeTestimonials", label: "Testimonials" },
  { key: "includePricing", label: "Pricing" },
  { key: "includeFaq", label: "FAQ" },
  { key: "includeContact", label: "Contact" },
  { key: "includeReservation", label: "Reservations / Booking" }
];

const GENERATION_STEPS = ["Writing your copy...", "Finding photos...", "Designing layout..."];

const ONBOARDING_PREVIEWS = [
  {
    id: "threadlab",
    label: "ThreadLab",
    className: "left-12 top-24",
    gradient: "from-[#efe8ff] via-[#e9f2ff] to-[#ffffff]",
    delay: "0s"
  },
  {
    id: "bellco",
    label: "Bell’s&Co",
    className: "right-12 top-40",
    gradient: "from-[#fef3c7] via-[#fde68a] to-[#ffffff]",
    delay: "0.6s"
  },
  {
    id: "knobby",
    label: "Knobby",
    className: "right-20 bottom-28",
    gradient: "from-[#dcfce7] via-[#dbeafe] to-[#ffffff]",
    delay: "1.1s"
  },
  {
    id: "cleo",
    label: "Cleo",
    className: "left-20 bottom-32",
    gradient: "from-[#fce7f3] via-[#fee2e2] to-[#ffffff]",
    delay: "1.5s"
  },
  {
    id: "lampish",
    label: "Lampish",
    className: "left-4 top-1/2 -translate-y-1/2",
    gradient: "from-[#e0f2fe] via-[#fef9c3] to-[#ffffff]",
    delay: "0.9s"
  }
];

const NAME_SUGGESTIONS = [
  "Ecommerce Haven",
  "ShopSphere",
  "CartCentral",
  "TrendNest",
  "MarketMingle",
  "UrbanCart"
];

const GOAL_SUGGESTIONS = [
  "Boost online sales",
  "Build customer relationships",
  "Increase brand awareness",
  "Drive repeat purchases",
  "Share product knowledge"
];

const INDUSTRY_SUGGESTIONS = [
  "Online store",
  "Portfolio",
  "Offering services",
  "Blog",
  "Landing page",
  "Non-profit organization",
  "Tech company",
  "Restaurant",
  "Promoting an event"
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value: string) => {
  const trimmed = value.trim().replace("#", "");
  if (trimmed.length === 3) {
    return `#${trimmed
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (trimmed.length === 6) {
    return `#${trimmed}`;
  }
  return null;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixColors = (base: string, overlay: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const weight = clamp(amount, 0, 1);
  return rgbToHex(
    baseRgb.r + (overlayRgb.r - baseRgb.r) * weight,
    baseRgb.g + (overlayRgb.g - baseRgb.g) * weight,
    baseRgb.b + (overlayRgb.b - baseRgb.b) * weight
  );
};

const getContrastText = (background: string) => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111827" : "#FFFFFF";
};

const getThemeSuggestions = (primaryColor: string) => {
  const primary = normalizeHex(primaryColor) ?? "#111827";
  const brandBackground = "#FFFFFF";
  const contrastBackground = "#0B0B0C";
  const softBackground = "#F3F4F6";
  return [
    {
      id: "brand-accurate",
      name: "Brand Accurate",
      description: "Based on your brand color",
      background: brandBackground,
      primary,
      text: getContrastText(brandBackground)
    },
    {
      id: "high-contrast",
      name: "High Contrast",
      description: "Bold, high readability",
      background: contrastBackground,
      primary,
      text: getContrastText(contrastBackground)
    },
    {
      id: "soft-neutral",
      name: "Soft Neutral",
      description: "Clean and calm",
      background: softBackground,
      primary,
      text: getContrastText(softBackground)
    }
  ];
};

// Color-thief style sampling for a dominant logo color without a dependency.
const extractDominantColor = (src: string): Promise<string | null> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 40;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 200) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }

      if (!count) {
        resolve(null);
        return;
      }

      resolve(rgbToHex(r / count, g / count, b / count));
    };

    img.onerror = () => resolve(null);
  });
};

const autoPickTemplateId = (industry: string) => {
  const normalized = industry.toLowerCase();
  if (normalized.includes("restaurant")) return "restaurant-editorial";
  if (normalized.includes("clinic") || normalized.includes("medical")) return "clinic-clean";
  if (normalized.includes("beauty") || normalized.includes("salon") || normalized.includes("spa")) {
    return "beauty-lux";
  }
  if (normalized.includes("portfolio") || normalized.includes("creative")) {
    return "portfolio-minimal";
  }
  if (normalized.includes("ecommerce") || normalized.includes("shop") || normalized.includes("store")) {
    return "ecommerce-simple";
  }
  if (normalized.includes("hospitality") || normalized.includes("hotel") || normalized.includes("resort")) {
    return "hospitality-resort";
  }
  if (normalized.includes("consulting") || normalized.includes("corporate") || normalized.includes("agency")) {
    return "corporate-sleek";
  }
  if (normalized.includes("service")) return "auto-modern";
  return "auto-modern";
};

const defaultState = (props: BuilderWizardClientProps): DraftState => {
  const normalized = normalizeIndustry(props.initialIndustry);
  const industryValue = props.initialIndustry ?? (normalized.custom || normalized.selected);
  const lowerIndustry = industryValue.toLowerCase();
  return {
    businessName: props.initialBusinessName || "",
    industry: normalized.selected,
    description: "",
    tone: resolveToneDefault(industryValue),
    pagesMode: "one",
    templateId: "",
    primaryColor: "#111827",
    secondaryColor: "#F3F4F6",
    fontFamily: "Sora, Inter, system-ui, sans-serif",
    logoUrl: props.initialLogoUrl || "",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    openingHours: "",
    socials: {},
    includeServices: true,
    includeTestimonials:
      lowerIndustry.includes("consulting") ||
      lowerIndustry.includes("agency") ||
      lowerIndustry.includes("corporate"),
    includePricing: lowerIndustry.includes("consulting"),
    includeFaq: lowerIndustry.includes("clinic") || lowerIndustry.includes("service"),
    includeContact: true,
    includeReservation: lowerIndustry.includes("restaurant"),
    includeGallery: false,
    hasOwnPhotos: false
  };
};

export function BuilderWizardClient({
  businessId,
  initialBusinessName,
  initialIndustry,
  initialLogoUrl
}: BuilderWizardClientProps) {
  const router = useRouter();
  const initialIndustryState = normalizeIndustry(initialIndustry);
  const initialDraftRef = useRef<DraftState | null>(null);
  const initialCustomIndustryRef = useRef(initialIndustryState.custom);
  if (initialDraftRef.current === null) {
    initialDraftRef.current = defaultState({
      businessId,
      initialBusinessName,
      initialIndustry,
      initialLogoUrl
    });
  }
  const [step, setStep] = useState(0);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(() => initialDraftRef.current as DraftState);
  const [customIndustry, setCustomIndustry] = useState(initialIndustryState.custom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservationTouched, setReservationTouched] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<string>("All");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedDraft = useRef(false);

  const stepMeta = [
    {
      title: "First, what is your site all about?",
      description: "Describe your site in a few sentences and choose a category."
    },
    {
      title: "What do you want to call your site?",
      description: "Add a name and set your brand look (logo, colors, and typography)."
    },
    {
      title: "What are your goals for this site?",
      description: "Pick the sections you want and the structure that fits your goals."
    },
    {
      title: "Add the details that build trust",
      description: "Share your contact info and social links so visitors can reach you."
    },
    {
      title: "Choose a design direction",
      description: "Pick a layout style so the generator can shape the site around your brand."
    }
  ];
  const steps = stepMeta.map((item) => item.title);

  const resolvedIndustry = useMemo(() => {
    if (draft.industry === "Other") {
      return customIndustry.trim();
    }
    return draft.industry.trim();
  }, [customIndustry, draft.industry]);

  const canNext = useMemo(() => {
    if (step === 0) {
      return Boolean(
        draft.businessName.trim() &&
          resolvedIndustry &&
          draft.description.trim() &&
          draft.tone
      );
    }
    return true;
  }, [draft.businessName, draft.description, draft.tone, resolvedIndustry, step]);

  const themeSuggestions = useMemo(() => getThemeSuggestions(draft.primaryColor), [draft.primaryColor]);

  const templateTags = useMemo(() => {
    const tags = new Set<string>();
    TEMPLATE_META.forEach((template) => {
      template.industryTags.forEach((tag) => tags.add(tag));
    });
    return ["All", ...Array.from(tags)];
  }, []);

  const filteredTemplates = useMemo(() => {
    if (templateFilter === "All") return TEMPLATE_META;
    return TEMPLATE_META.filter((template) => template.industryTags.includes(templateFilter));
  }, [templateFilter]);

  const applyIndustrySuggestion = useCallback(
    (label: string) => {
      const mapped =
        label === "Online store"
          ? "Ecommerce"
          : label === "Non-profit organization"
            ? "Non-profit"
            : label === "Promoting an event"
              ? "Event"
              : label;
      if (INDUSTRY_OPTIONS.includes(mapped)) {
        setDraft((prev) => ({ ...prev, industry: mapped }));
        setCustomIndustry("");
        return;
      }
      setDraft((prev) => ({ ...prev, industry: "Other" }));
      setCustomIndustry(mapped);
    },
    [setCustomIndustry]
  );

  const progress = Math.round(((step + 1) / steps.length) * 100);
  const isLastStep = step === steps.length - 1;
  const inputClass =
    "h-11 w-full rounded-xl border border-[#e5e1d8] bg-white px-4 text-sm text-neutral-900 shadow-sm focus:border-[#5b6bff] focus:outline-none focus:ring-2 focus:ring-[#5b6bff]/20";
  const textareaClass =
    "min-h-[120px] w-full rounded-xl border border-[#e5e1d8] bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm focus:border-[#5b6bff] focus:outline-none focus:ring-2 focus:ring-[#5b6bff]/20";
  const pillBase =
    "rounded-full border border-[#e5e1d8] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition";
  const pillActive = "border-[#5b6bff] bg-[#eef2ff] text-[#3745ff]";
  const pillInactive = "text-neutral-500 hover:border-[#c9c2b4] hover:text-neutral-700";

  useEffect(() => {
    const isRestaurant = resolvedIndustry.toLowerCase().includes("restaurant");
    if (isRestaurant && !reservationTouched && !draft.includeReservation) {
      setDraft((prev) => ({ ...prev, includeReservation: true }));
    }
  }, [draft.includeReservation, reservationTouched, resolvedIndustry]);

  const saveDraft = useCallback(
    async (current: DraftState) => {
      if (!siteId || !hasLoadedDraft.current || !resolvedIndustry) return;

      await fetch("/api/builder/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          businessName: current.businessName,
          industry: resolvedIndustry,
          description: current.description,
          tone: current.tone,
          pagesMode: current.pagesMode,
          templateId: current.templateId,
          primaryColor: current.primaryColor,
          secondaryColor: current.secondaryColor,
          fontFamily: current.fontFamily,
          logoUrl: current.logoUrl || null,
          contact: {
            email: current.contactEmail || null,
            phone: current.contactPhone || null,
            address: current.contactAddress || null
          },
          openingHours: current.openingHours || null,
          socials: current.socials,
          features: {
            includeServices: current.includeServices,
            includeTestimonials: current.includeTestimonials,
            includePricing: current.includePricing,
            includeFaq: current.includeFaq,
            includeContact: current.includeContact,
            includeReservation: current.includeReservation,
            includeGallery: current.includeGallery
          },
          hasOwnPhotos: current.hasOwnPhotos
        })
      });
    },
    [resolvedIndustry, siteId]
  );

  useEffect(() => {
    if (!siteId || !hasLoadedDraft.current) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveDraft(draft).catch((saveError) => {
        console.error("[BUILDER_DRAFT_SAVE_ERROR]", saveError);
      });
    }, 700);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [draft, saveDraft, siteId]);

  useEffect(() => {
    let active = true;

    const createDraft = async () => {
      const seed = initialDraftRef.current as DraftState;
      const seedIndustry =
        seed.industry === "Other"
          ? (initialCustomIndustryRef.current ?? "").trim()
          : seed.industry.trim();
      const response = await fetch("/api/builder/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          businessName: seed.businessName || "New website",
          industry: seedIndustry || "Service",
          description: seed.description || "Describe your business.",
          tone: seed.tone,
          pagesMode: seed.pagesMode,
          templateId: seed.templateId,
          primaryColor: seed.primaryColor,
          secondaryColor: seed.secondaryColor,
          fontFamily: seed.fontFamily,
          logoUrl: seed.logoUrl || null,
          contact: {
            email: seed.contactEmail || null,
            phone: seed.contactPhone || null,
            address: seed.contactAddress || null
          },
          openingHours: seed.openingHours || null,
          socials: seed.socials,
          features: {
            includeServices: seed.includeServices,
            includeTestimonials: seed.includeTestimonials,
            includePricing: seed.includePricing,
            includeFaq: seed.includeFaq,
            includeContact: seed.includeContact,
            includeReservation: seed.includeReservation,
            includeGallery: seed.includeGallery
          },
          hasOwnPhotos: seed.hasOwnPhotos
        })
      });

      if (!response.ok) {
        setError("Unable to create draft.");
        return;
      }

      const data = await response.json();
      if (data?.siteId && active) {
        setSiteId(data.siteId);
        window.localStorage.setItem("builderDraftSiteId", data.siteId);
        hasLoadedDraft.current = true;
        setDraftLoaded(true);
      }
    };

    const hydrateDraft = async () => {
      const existingId = window.localStorage.getItem("builderDraftSiteId");
      if (existingId) {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          existingId
        );
        if (!isValidUuid) {
          window.localStorage.removeItem("builderDraftSiteId");
        } else {
        const response = await fetch(`/api/builder/site?siteId=${existingId}`);
        if (response.ok) {
          const data = await response.json();
          if (data?.id && active) {
            const normalized = normalizeIndustry(data.industry ?? "");
            setCustomIndustry(normalized.custom);
            setSiteId(data.id);
            setDraft((prev) => ({
              ...prev,
              businessName: data.business_name ?? prev.businessName,
              industry: normalized.selected,
              description: data.description ?? prev.description,
              tone: data.tone ?? prev.tone,
              pagesMode: data.pages_mode ?? prev.pagesMode,
              templateId: data.template_id ?? prev.templateId,
              primaryColor: data.primary_color ?? prev.primaryColor,
              secondaryColor: data.secondary_color ?? prev.secondaryColor,
              fontFamily: data.font_family ?? prev.fontFamily,
              logoUrl: data.logo_url ?? prev.logoUrl,
              contactEmail: data.contact_email ?? prev.contactEmail,
              contactPhone: data.contact_phone ?? prev.contactPhone,
              contactAddress: data.contact_address ?? prev.contactAddress,
              openingHours: data.opening_hours ?? prev.openingHours,
              socials: data.socials ?? prev.socials,
              includeServices: Boolean(data.include_services ?? prev.includeServices),
              includeTestimonials: Boolean(data.include_testimonials ?? prev.includeTestimonials),
              includePricing: Boolean(data.include_pricing ?? prev.includePricing),
              includeFaq: Boolean(data.include_faq ?? prev.includeFaq),
              includeContact: Boolean(data.include_contact ?? prev.includeContact),
              includeReservation: Boolean(data.include_reservation ?? prev.includeReservation),
              includeGallery: Boolean(data.include_gallery ?? prev.includeGallery),
              hasOwnPhotos: Boolean(data.has_own_photos ?? prev.hasOwnPhotos)
            }));
            hasLoadedDraft.current = true;
            setDraftLoaded(true);
            return;
          }
        }
        window.localStorage.removeItem("builderDraftSiteId");
        }
      }

      await createDraft();
    };

    hydrateDraft().catch((createError) => {
      console.error("[BUILDER_DRAFT_CREATE_ERROR]", createError);
      setError("Unable to start the builder.");
    });

    return () => {
      active = false;
    };
  }, [businessId]);

  const handleLogoUpload = async (file: File | null) => {
    if (!file || !siteId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("siteId", siteId);
    formData.append("kind", "logo");

    const response = await fetch("/api/builder/upload-image", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      setError("Logo upload failed.");
      return;
    }

    const data = await response.json();
    if (data?.url) {
      setDraft((prev) => ({ ...prev, logoUrl: data.url }));
    }
  };

  const handleRecommendTheme = async () => {
    if (!draft.logoUrl) {
      setError("Upload a logo to recommend a theme.");
      return;
    }

    setThemeLoading(true);
    setError(null);

    try {
      const dominant = await extractDominantColor(draft.logoUrl);
      if (!dominant) {
        setError("Unable to read logo colors. Try another image.");
        return;
      }
      const background = mixColors(dominant, "#FFFFFF", 0.92);
      setDraft((prev) => ({
        ...prev,
        primaryColor: dominant,
        secondaryColor: background
      }));
    } finally {
      setThemeLoading(false);
    }
  };

  const toggleFeature = (key: ToggleKey) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] } as DraftState));
    if (key === "includeReservation") {
      setReservationTouched(true);
    }
  };

  const updateSocial = (key: keyof SocialLinks, value: string) => {
    setDraft((prev) => ({
      ...prev,
      socials: {
        ...prev.socials,
        [key]: value
      }
    }));
  };

  const handleGenerate = async () => {
    if (!siteId) return;
    const resolvedTemplateId = draft.templateId || autoPickTemplateId(resolvedIndustry);
    if (!resolvedTemplateId) {
      setError("Select a template to continue.");
      return;
    }

    if (resolvedTemplateId !== draft.templateId) {
      setDraft((prev) => ({ ...prev, templateId: resolvedTemplateId }));
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        siteId,
        businessId,
        businessName: draft.businessName,
        industry: resolvedIndustry,
        description: draft.description,
        tone: draft.tone,
        pagesMode: draft.pagesMode,
        templateId: resolvedTemplateId,
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        fontFamily: draft.fontFamily,
        logoUrl: draft.logoUrl || null,
        contact: {
          email: draft.contactEmail || null,
          phone: draft.contactPhone || null,
          address: draft.contactAddress || null
        },
        openingHours: draft.openingHours || null,
        socials: draft.socials,
        features: {
          includeServices: draft.includeServices,
          includeTestimonials: draft.includeTestimonials,
          includePricing: draft.includePricing,
          includeFaq: draft.includeFaq,
          includeContact: draft.includeContact,
          includeReservation: draft.includeReservation,
          includeGallery: draft.includeGallery
        },
        hasOwnPhotos: draft.hasOwnPhotos
      };

      window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(payload));
      window.localStorage.removeItem("builderDraftSiteId");
      router.push(`/editor/${siteId}/generate`);
    } catch (generateError) {
      console.error("[BUILDER_GENERATE_ERROR]", generateError);
      setError("Unable to start site generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4f1] text-neutral-900">
      <div className="pointer-events-none absolute inset-0">
        {ONBOARDING_PREVIEWS.map((card) => (
          <div
            key={card.id}
            className={`absolute ${card.className} hidden lg:block`}
            style={{ animation: "wrapped-float 7s ease-in-out infinite", animationDelay: card.delay }}
          >
            <div className="w-[140px] rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              <div className={`h-16 w-full rounded-xl bg-gradient-to-br ${card.gradient}`} />
              <div className="mt-2 text-xs font-semibold text-neutral-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-4xl items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
              SC
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">SiroundChat</p>
              <p className="text-sm font-semibold text-neutral-600">Website Builder</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            Skip to Dashboard →
          </button>
        </div>

        <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-[#ece7df] bg-white wix-soft-shadow">
          <div className="h-1 w-full bg-[#ece7df]">
            <div
              className="h-1 bg-gradient-to-r from-[#5b6bff] via-[#6f7bff] to-[#7c5cff]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="px-10 py-8">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-neutral-400">
              <span>
                Step {step + 1} of {steps.length}
              </span>
              <span>Auto-saved</span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-neutral-900">{stepMeta[step].title}</h2>
            <p className="mt-2 text-sm text-neutral-500">{stepMeta[step].description}</p>

            <div className="mt-8">
              {!draftLoaded ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 w-40 rounded-full bg-neutral-200" />
                  <div className="h-10 w-full rounded-xl bg-neutral-200" />
                  <div className="h-10 w-full rounded-xl bg-neutral-200" />
                  <div className="h-24 w-full rounded-xl bg-neutral-200" />
                </div>
              ) : (
                <>
                  {step === 0 ? (
                    <div className="space-y-6">
                      <label className="space-y-2 text-sm font-semibold text-neutral-700">
                        Describe your site
                        <textarea
                          className={textareaClass}
                          value={draft.description}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Describe your site or business in a few sentences."
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {INDUSTRY_SUGGESTIONS.map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => applyIndustrySuggestion(label)}
                            className={`rounded-full border border-[#e5e1d8] px-3 py-1 text-xs font-medium text-neutral-500 transition hover:border-[#5b6bff] hover:text-[#3b4ae8]`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-6 md:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Business name
                          <input
                            className={inputClass}
                            value={draft.businessName}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, businessName: event.target.value }))
                            }
                            placeholder="Your business"
                          />
                          <div className="flex flex-wrap gap-2">
                            {NAME_SUGGESTIONS.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setDraft((prev) => ({ ...prev, businessName: name }))}
                                className="rounded-full border border-[#e5e1d8] px-3 py-1 text-[11px] font-medium text-neutral-500 transition hover:border-[#5b6bff] hover:text-[#3b4ae8]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Industry
                          <select
                            className={inputClass}
                            value={draft.industry}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, industry: event.target.value }))
                            }
                          >
                            {INDUSTRY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        {draft.industry === "Other" ? (
                          <label className="space-y-2 text-sm font-semibold text-neutral-700 md:col-span-2">
                            Custom industry
                            <input
                              className={inputClass}
                              value={customIndustry}
                              onChange={(event) => setCustomIndustry(event.target.value)}
                              placeholder="Describe your industry"
                            />
                          </label>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-neutral-700">Tone</p>
                        <div className="flex flex-wrap gap-2">
                          {TONE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setDraft((prev) => ({ ...prev, tone: option.value }))}
                              className={`${pillBase} ${
                                draft.tone === option.value ? pillActive : pillInactive
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                        <div className="space-y-4">
                          <label className="space-y-2 text-sm font-semibold text-neutral-700">
                            Logo upload
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full text-sm text-neutral-500"
                              onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
                            />
                          </label>
                          {draft.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={draft.logoUrl}
                              alt="Logo"
                              className="h-16 w-16 rounded-2xl border border-[#e5e1d8] bg-white object-contain p-2"
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={handleRecommendTheme}
                            disabled={themeLoading || !draft.logoUrl}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-[#e5e1d8] px-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600 disabled:opacity-50"
                          >
                            {themeLoading ? "Analyzing logo..." : "Recommend theme"}
                          </button>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-neutral-700">Theme suggestions</p>
                          <div className="grid gap-3">
                            {themeSuggestions.map((theme) => {
                              const isSelected =
                                draft.primaryColor === theme.primary &&
                                draft.secondaryColor === theme.background;
                              return (
                                <button
                                  key={theme.id}
                                  type="button"
                                  onClick={() =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      primaryColor: theme.primary,
                                      secondaryColor: theme.background
                                    }))
                                  }
                                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                                    isSelected
                                      ? "border-[#5b6bff] bg-[#eef2ff]"
                                      : "border-[#e5e1d8] hover:border-[#c9c2b4]"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="h-7 w-7 rounded-lg border border-[#e5e1d8]"
                                        style={{ backgroundColor: theme.background }}
                                      />
                                      <span
                                        className="h-7 w-7 rounded-lg border border-[#e5e1d8]"
                                        style={{ backgroundColor: theme.primary }}
                                      />
                                      <span
                                        className="h-7 w-7 rounded-lg border border-[#e5e1d8]"
                                        style={{ backgroundColor: theme.text }}
                                      />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-neutral-800">{theme.name}</p>
                                      <p className="text-xs text-neutral-500">{theme.description}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Primary color
                          <input
                            type="color"
                            className="h-11 w-full rounded-xl border border-[#e5e1d8] bg-white px-3"
                            value={draft.primaryColor}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, primaryColor: event.target.value }))
                            }
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Secondary color
                          <input
                            type="color"
                            className="h-11 w-full rounded-xl border border-[#e5e1d8] bg-white px-3"
                            value={draft.secondaryColor}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, secondaryColor: event.target.value }))
                            }
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700 md:col-span-2">
                          Font pairing
                          <select
                            className={inputClass}
                            value={draft.fontFamily}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, fontFamily: event.target.value }))
                            }
                          >
                            {FONT_PAIRS.map((pair) => (
                              <option key={pair.label} value={pair.value}>
                                {pair.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-neutral-700">Pages mode</p>
                        <div className="flex flex-wrap gap-2">
                          {PAGES_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setDraft((prev) => ({ ...prev, pagesMode: option.value }))}
                              className={`${pillBase} ${
                                draft.pagesMode === option.value ? pillActive : pillInactive
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-neutral-700">Goals for this site</p>
                        <div className="flex flex-wrap gap-2">
                          {GOAL_SUGGESTIONS.map((goal) => (
                            <span
                              key={goal}
                              className="rounded-full border border-[#e5e1d8] px-3 py-1 text-xs font-medium text-neutral-500"
                            >
                              {goal}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-neutral-700">Sections</p>
                        <div className="rounded-2xl border border-[#e5e1d8] bg-white">
                          {SECTION_TOGGLES.map((toggle, index) => {
                            const enabled = draft[toggle.key];
                            return (
                              <label
                                key={toggle.key}
                                className={`flex items-center justify-between px-4 py-3 text-sm ${
                                  index !== SECTION_TOGGLES.length - 1 ? "border-b border-[#f1ede6]" : ""
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={() => toggleFeature(toggle.key)}
                                    className="h-4 w-4 accent-[#5b6bff]"
                                  />
                                  <span className="font-medium text-neutral-700">{toggle.label}</span>
                                </span>
                                <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                                  {enabled ? "On" : "Off"}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Contact email
                          <input
                            type="email"
                            className={inputClass}
                            value={draft.contactEmail}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, contactEmail: event.target.value }))
                            }
                            placeholder="you@example.com"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Contact phone
                          <input
                            type="tel"
                            className={inputClass}
                            value={draft.contactPhone}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, contactPhone: event.target.value }))
                            }
                            placeholder="+1 (555) 555-5555"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700 md:col-span-2">
                          Address
                          <input
                            className={inputClass}
                            value={draft.contactAddress}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, contactAddress: event.target.value }))
                            }
                            placeholder="123 Main St, City"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700 md:col-span-2">
                          Opening hours
                          <input
                            className={inputClass}
                            value={draft.openingHours}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, openingHours: event.target.value }))
                            }
                            placeholder="Mon-Fri 9am-6pm, Sat 10am-2pm"
                          />
                        </label>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Instagram
                          <input
                            className={inputClass}
                            value={draft.socials.instagram ?? ""}
                            onChange={(event) => updateSocial("instagram", event.target.value)}
                            placeholder="@yourhandle"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          Facebook
                          <input
                            className={inputClass}
                            value={draft.socials.facebook ?? ""}
                            onChange={(event) => updateSocial("facebook", event.target.value)}
                            placeholder="facebook.com/yourpage"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          TikTok
                          <input
                            className={inputClass}
                            value={draft.socials.tiktok ?? ""}
                            onChange={(event) => updateSocial("tiktok", event.target.value)}
                            placeholder="@yourhandle"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700">
                          LinkedIn
                          <input
                            className={inputClass}
                            value={draft.socials.linkedin ?? ""}
                            onChange={(event) => updateSocial("linkedin", event.target.value)}
                            placeholder="linkedin.com/company/yourpage"
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-neutral-700 md:col-span-2">
                          Website
                          <input
                            className={inputClass}
                            value={draft.socials.website ?? ""}
                            onChange={(event) => updateSocial("website", event.target.value)}
                            placeholder="https://yourbrand.com"
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-neutral-700">I have my own photos</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDraft((prev) => ({ ...prev, hasOwnPhotos: true }))}
                            className={`${pillBase} ${
                              draft.hasOwnPhotos ? pillActive : pillInactive
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraft((prev) => ({ ...prev, hasOwnPhotos: false }))}
                            className={`${pillBase} ${
                              !draft.hasOwnPhotos ? pillActive : pillInactive
                            }`}
                          >
                            No
                          </button>
                        </div>
                        {!draft.hasOwnPhotos ? (
                          <p className="text-xs text-neutral-400">We&apos;ll source AI-generated visuals.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {templateTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setTemplateFilter(tag)}
                              className={`${pillBase} ${
                                templateFilter === tag ? pillActive : pillInactive
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              templateId: autoPickTemplateId(resolvedIndustry)
                            }))
                          }
                          className="inline-flex h-9 items-center justify-center rounded-full border border-[#e5e1d8] px-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500"
                        >
                          Auto-pick best template
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredTemplates.map((template) => {
                          const selected = draft.templateId === template.id;
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => setDraft((prev) => ({ ...prev, templateId: template.id }))}
                              className={`rounded-2xl border p-4 text-left transition ${
                                selected
                                  ? "border-[#5b6bff] bg-[#eef2ff]"
                                  : "border-[#e5e1d8] hover:border-[#c9c2b4]"
                              }`}
                            >
                              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[#e5e1d8] bg-[#f5f4ef]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={template.thumbnailPath}
                                  alt={template.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="mt-3 space-y-1">
                                <p className="text-sm font-semibold text-neutral-800">{template.name}</p>
                                <p className="text-xs text-neutral-500">{template.description}</p>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {template.industryTags.map((tag) => (
                                  <span
                                    key={`${template.id}-${tag}`}
                                    className="rounded-full border border-[#e5e1d8] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-400"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-3 rounded-2xl border border-[#e5e1d8] bg-[#faf9f6] p-4 text-sm text-neutral-600">
                        <p className="text-base font-semibold text-neutral-800">Review summary</p>
                        <div className="grid gap-2">
                          <p>Business: {draft.businessName}</p>
                          <p>Industry: {resolvedIndustry}</p>
                          <p>Tone: {draft.tone}</p>
                          <p>Pages: {draft.pagesMode === "one" ? "One-page" : "Multi-page"}</p>
                          <p>Template: {draft.templateId || "Auto-pick on generate"}</p>
                        </div>
                      </div>

                      {loading ? (
                        <div className="space-y-2 text-sm text-neutral-500">
                          {GENERATION_STEPS.map((label) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-transparent" />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {error ? <p className="mt-6 text-sm text-red-500">{error}</p> : null}
          </div>
          <div className="flex items-center justify-between border-t border-[#f0ede6] px-10 py-6">
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              className="rounded-full border border-[#e5e1d8] px-4 py-2 text-sm font-semibold text-neutral-500 disabled:opacity-40"
              disabled={!draftLoaded || step === 0 || loading}
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep(steps.length - 1)}
                  className="text-xs font-semibold text-neutral-400 hover:text-neutral-600"
                  disabled={!draftLoaded || loading}
                >
                  Skip
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (isLastStep) {
                    handleGenerate();
                  } else {
                    setStep((prev) => Math.min(steps.length - 1, prev + 1));
                  }
                }}
                className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!draftLoaded || (isLastStep ? loading : !canNext)}
              >
                {isLastStep ? (loading ? "Generating..." : "Generate website") : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
