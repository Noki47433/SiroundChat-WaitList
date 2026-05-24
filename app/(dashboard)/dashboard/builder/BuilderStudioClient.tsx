"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Globe2,
  ImagePlus,
  Images,
  Loader2,
  Palette,
  PencilLine,
  Sparkles,
  UploadCloud,
  X
} from "lucide-react";
import { markChecklistTaskComplete } from "@/app/(dashboard)/dashboard/_components/onboarding/state";
import type { GenerationBriefData } from "@/lib/builder/generation-config";
import { DEFAULT_THEME_STYLE, THEME_STYLE_OPTIONS, type ThemeStyleId } from "@/lib/builder/template-sites/themes";
import {
  BUILDER_IMAGE_SLOT_OPTIONS,
  type BuilderImageSlot,
  resolveAssetKindFromSlot
} from "@/lib/builder/site-assets";
import { cn } from "@/lib/utils/cn";
import { buildRestaurantStudioSpecFromGenerationPayload } from "@/lib/website-studio/spec-builder";
import { useToast } from "@/components/ui/toast";

type BuilderSiteSummary = {
  id: string;
  status: string | null;
  slug: string | null;
  template_key: string | null;
  business_name: string | null;
  updated_at: string | null;
  published_url: string | null;
};

type BuilderStudioClientProps = {
  businessId: string;
  initialBusinessName: string;
  initialIndustry: string | null;
  initialLogoUrl: string | null;
  sites: BuilderSiteSummary[];
};

type Suggestion = {
  label: string;
  prompt: string;
};

type PendingBusinessImage = {
  id: string;
  file: File;
  previewUrl: string;
  targetSlot: BuilderImageSlot;
};

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Restaurant Website",
    prompt:
      "Create a warm restaurant website with menu highlights, table reservations, opening hours, gallery, and contact details."
  },
  {
    label: "Landing Page",
    prompt:
      "Create a focused landing page with a strong hero section, benefits, social proof, FAQs, and a clear contact CTA."
  },
  {
    label: "Premium Website",
    prompt:
      "Create a premium business website with elegant copy, polished sections, trust signals, testimonials, and a refined visual style."
  },
  {
    label: "Reservation Website",
    prompt:
      "Create a reservation-focused website with booking calls to action, opening hours, service details, and visitor-friendly contact sections."
  },
  {
    label: "Modern Layout",
    prompt:
      "Use a clean modern layout with strong spacing, clear hierarchy, concise sections, and mobile-first structure."
  },
  {
    label: "Elegant Style",
    prompt:
      "Use an elegant, restrained visual style with premium typography, calm colors, and confident business copy."
  },
  {
    label: "Generate from Business Info",
    prompt:
      "Generate a website from my existing business information. Emphasize my core offer, contact path, and customer trust."
  },
  {
    label: "Improve Existing Website",
    prompt:
      "Improve my existing website with clearer copy, stronger calls to action, better structure, and a more premium first impression."
  }
];

const THEME_COLOR_PRESETS: Record<ThemeStyleId, { primary: string; secondary: string }> = {
  "dark-premium": { primary: "#bfa06a", secondary: "#0f1115" },
  "editorial-elegant": { primary: "#b58c57", secondary: "#f6efe4" },
  "modern-minimal": { primary: "#0f172a", secondary: "#eef2f7" },
  "warm-cozy": { primary: "#9b5f3d", secondary: "#f6ead8" }
};

const makeClientId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isHexColor = (value?: string | null) =>
  Boolean(value && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim()));

const normalizeColor = (value: string, fallback: string) => (isHexColor(value) ? value : fallback);

const inferIndustry = (prompt: string, fallback?: string | null) => {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("restaurant") || normalized.includes("reservation") || normalized.includes("menu")) {
    return "Restaurant";
  }
  if (normalized.includes("shop") || normalized.includes("store") || normalized.includes("ecommerce")) {
    return "Ecommerce";
  }
  if (normalized.includes("portfolio") || normalized.includes("creative")) {
    return "Portfolio";
  }
  if (normalized.includes("clinic") || normalized.includes("dental") || normalized.includes("medical")) {
    return "Clinic";
  }
  if (normalized.includes("agency")) {
    return "Agency";
  }
  if (normalized.includes("consult")) {
    return "Consulting";
  }
  if (normalized.includes("event")) {
    return "Event";
  }
  return fallback?.trim() || "Service";
};

const inferTone = (prompt: string, industry: string, themeStyle?: ThemeStyleId) => {
  const selectedTheme = THEME_STYLE_OPTIONS.find((option) => option.id === themeStyle);
  if (selectedTheme) return selectedTheme.tone;
  const normalized = `${prompt} ${industry}`.toLowerCase();
  if (normalized.includes("premium") || normalized.includes("elegant") || normalized.includes("luxury")) {
    return "premium";
  }
  if (normalized.includes("bold")) return "bold";
  if (normalized.includes("friendly") || normalized.includes("restaurant")) return "friendly";
  if (normalized.includes("minimal") || normalized.includes("modern")) return "minimal";
  return "professional";
};

const inferPrimaryGoal = (
  prompt: string,
  industry: string
): GenerationBriefData["primaryCtaGoal"] => {
  const normalized = `${prompt} ${industry}`.toLowerCase();
  if (normalized.includes("reservation") || normalized.includes("restaurant")) return "reserve_table";
  if (normalized.includes("shop") || normalized.includes("store") || normalized.includes("ecommerce")) return "buy_now";
  if (normalized.includes("quote")) return "get_quote";
  if (normalized.includes("demo")) return "request_demo";
  if (normalized.includes("appointment") || normalized.includes("clinic")) return "book_appointment";
  if (normalized.includes("call")) return "book_call";
  return "contact";
};

const defaultServicesForIndustry = (industry: string) => {
  const normalized = industry.toLowerCase();
  if (normalized.includes("restaurant")) {
    return ["Menu highlights", "Table reservations", "Private dining and events"];
  }
  if (normalized.includes("ecommerce")) {
    return ["Featured products", "Secure checkout", "Customer support"];
  }
  if (normalized.includes("portfolio")) {
    return ["Featured work", "Project case studies", "Contact inquiries"];
  }
  if (normalized.includes("clinic") || normalized.includes("medical")) {
    return ["Appointments", "Patient services", "Care team information"];
  }
  if (normalized.includes("agency") || normalized.includes("consulting")) {
    return ["Strategy sessions", "Service packages", "Client outcomes"];
  }
  return ["Core services", "Customer inquiries", "Business information"];
};

const extractServiceHints = (prompt: string, industry: string) => {
  const normalized = prompt
    .replace(/[.;]/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 3 && part.length < 80);

  const defaults = defaultServicesForIndustry(industry);
  return [...normalized, ...defaults].slice(0, 3);
};

const buildGenerationBrief = (
  prompt: string,
  industry: string,
  themeStyle?: ThemeStyleId
): GenerationBriefData => {
  const tone = inferTone(prompt, industry, themeStyle);
  const topServices = extractServiceHints(prompt, industry);

  return {
    audience: "Customers researching this business online",
    coreOffer: prompt.slice(0, 220),
    primaryCtaGoal: inferPrimaryGoal(prompt, industry),
    topServices,
    proofPoints: ["Clear business information", "Easy contact path", "Mobile-friendly experience"],
    tone
  };
};

const buildGenerationPayload = ({
  siteId,
  businessId,
  businessName,
  industry,
  prompt,
  rawPrompt,
  enhancedPrompt,
  selectedTemplate,
  logoUrl,
  themeStyle,
  primaryColor,
  secondaryColor,
  hasOwnPhotos
}: {
  siteId: string;
  businessId: string;
  businessName: string;
  industry: string;
  prompt: string;
  rawPrompt?: string | null;
  enhancedPrompt?: string | null;
  selectedTemplate?: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  hasOwnPhotos: boolean;
  themeStyle?: ThemeStyleId;
}) => {
  const brief = buildGenerationBrief(prompt, industry, themeStyle);
  const tone = brief.tone;
  const topServices = brief.topServices;
  const includeReservation =
    industry.toLowerCase().includes("restaurant") || prompt.toLowerCase().includes("reservation");

  const payload = {
    siteId,
    businessId,
    businessName,
    industry,
    description: prompt,
    rawPrompt: rawPrompt ?? prompt,
    enhancedPrompt: enhancedPrompt ?? undefined,
    tone,
    language: "en",
    contentLanguage: "en",
    qualityMode: "balanced",
    themeStyle,
    brief,
    pagesMode: "one",
    templateId: selectedTemplate ?? undefined,
    selectedTemplate: selectedTemplate ?? undefined,
    primaryColor,
    secondaryColor,
    fontFamily: "Sora, Inter, system-ui, sans-serif",
    logoUrl: logoUrl || null,
    contact: {
      email: null,
      phone: null,
      address: null
    },
    openingHours: null,
    socials: {},
    targetCustomer: "Customers researching this business online",
    services: topServices,
    proofAssets: brief.proofPoints,
    features: {
      includeServices: true,
      includeTestimonials: true,
      includePricing: false,
      includeFaq: true,
      includeContact: true,
      includeReservation,
      includeGallery: includeReservation || prompt.toLowerCase().includes("gallery")
    },
    hasOwnPhotos,
    studioSource: "prompt_studio" as const
  };

  return {
    ...payload,
    studioSpec: buildRestaurantStudioSpecFromGenerationPayload(payload)
  };
};

const formatDate = (value: string | null) => {
  if (!value) return "Recently updated";
  try {
    return `Updated ${new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  } catch {
    return "Recently updated";
  }
};

const persistGenerationBrief = (siteId: string, payload: unknown) => {
  try {
    window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(payload));
    window.localStorage.removeItem("builderDraftSiteId");
  } catch (error) {
    console.warn("[BUILDER_STUDIO_STORAGE_ERROR]", error);
  }
};

export function BuilderStudioClient({
  businessId,
  initialBusinessName,
  initialIndustry,
  initialLogoUrl,
  sites
}: BuilderStudioClientProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const businessImageInputRef = useRef<HTMLInputElement | null>(null);
  const businessImagesRef = useRef<PendingBusinessImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [themeStyle, setThemeStyle] = useState<ThemeStyleId>(DEFAULT_THEME_STYLE);
  const [primaryColor, setPrimaryColor] = useState(THEME_COLOR_PRESETS[DEFAULT_THEME_STYLE].primary);
  const [secondaryColor, setSecondaryColor] = useState(THEME_COLOR_PRESETS[DEFAULT_THEME_STYLE].secondary);
  const [hasManualColorSelection, setHasManualColorSelection] = useState(false);
  const [businessImages, setBusinessImages] = useState<PendingBusinessImage[]>([]);

  const businessName = initialBusinessName.trim() || "New Website";
  const recentSites = useMemo(() => sites.slice(0, 4), [sites]);

  useEffect(() => {
    businessImagesRef.current = businessImages;
  }, [businessImages]);

  useEffect(() => {
    return () => {
      businessImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const addBusinessImages = (files: FileList | File[] | null) => {
    const nextFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!nextFiles.length) return;

    setBusinessImages((current) => {
      const existingKeys = new Set(
        current.map((image) => `${image.file.name}-${image.file.size}-${image.file.lastModified}`)
      );
      const availableSlots = Math.max(0, 6 - current.length);
      let heroAssigned = current.some((image) => image.targetSlot === "hero");
      const additions = nextFiles
        .filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
        .slice(0, availableSlots)
        .map((file) => {
          const targetSlot: BuilderImageSlot = heroAssigned ? "auto" : "hero";
          heroAssigned = true;
          return {
            id: makeClientId(),
            file,
            previewUrl: URL.createObjectURL(file),
            targetSlot
          };
        });

      return [...current, ...additions];
    });
  };

  const setBusinessImageSlot = (imageId: string, targetSlot: BuilderImageSlot) => {
    setBusinessImages((current) =>
      current.map((image) => {
        if (targetSlot === "hero" && image.id !== imageId && image.targetSlot === "hero") {
          return { ...image, targetSlot: "auto" as BuilderImageSlot };
        }
        if (image.id !== imageId) return image;
        return { ...image, targetSlot };
      })
    );
  };

  const removeBusinessImage = (imageId: string) => {
    setBusinessImages((current) => {
      const match = current.find((image) => image.id === imageId);
      if (match) {
        URL.revokeObjectURL(match.previewUrl);
      }
      return current.filter((image) => image.id !== imageId);
    });
  };

  const applyThemeStyle = (nextThemeStyle: ThemeStyleId) => {
    setThemeStyle(nextThemeStyle);
    if (hasManualColorSelection) return;
    const preset = THEME_COLOR_PRESETS[nextThemeStyle];
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const uploadBusinessPhotos = async (siteId: string) => {
    if (!businessImages.length) return;

    const uploads = await Promise.all(
      businessImages.map(async (image) => {
        const formData = new FormData();
        formData.append("siteId", siteId);
        formData.append("kind", resolveAssetKindFromSlot(image.targetSlot));
        formData.append("slot", image.targetSlot);
        formData.append("file", image.file);

        const response = await fetch("/api/builder/upload-image", {
          method: "POST",
          body: formData
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to upload business photos.");
        }
        return payload;
      })
    );

    if (uploads.length) {
      pushToast({
        title: "Business photos uploaded",
        message: "These photos will be prioritized in the generated website.",
        variant: "success"
      });
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file || isUploadingLogo) return;
    setError(null);
    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("businessId", businessId);
      formData.append("file", file);

      const response = await fetch("/api/logos/upload", {
        method: "POST",
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to upload logo.");
      }

      const nextLogoUrl =
        typeof payload?.logoUrl === "string" ? payload.logoUrl : null;

      if (!nextLogoUrl) {
        throw new Error("Upload completed without a logo URL.");
      }

      setLogoUrl(nextLogoUrl);
      pushToast({
        title: "Logo uploaded",
        message: "This logo will be used in the generated website.",
        variant: "success"
      });
    } catch (uploadError) {
      console.error("[BUILDER_STUDIO_LOGO_UPLOAD_ERROR]", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload logo.");
    } finally {
      setIsUploadingLogo(false);
      setIsDraggingLogo(false);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    setError(null);
    setPrompt((current) => {
      const trimmed = current.trim();
      if (!trimmed) return suggestion.prompt;
      if (trimmed.includes(suggestion.prompt)) return current;
      return `${trimmed}\n\n${suggestion.prompt}`;
    });
  };

  const startGeneration = async () => {
    if (isStarting || isUploadingLogo) return;
    const description = prompt.trim();
    if (description.length < 12) {
      setError("Describe the website in a little more detail before generating.");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const industry = inferIndustry(description, initialIndustry);
      const tone = inferTone(description, industry, themeStyle);
      const generationBrief = buildGenerationBrief(description, industry, themeStyle);

      const response = await fetch("/api/builder/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          businessName,
          industry,
          description,
          tone,
          themeStyle,
          contentLanguage: "en",
          generationBrief,
          pagesMode: "one",
          primaryColor: normalizeColor(primaryColor, THEME_COLOR_PRESETS[themeStyle].primary),
          secondaryColor: normalizeColor(secondaryColor, THEME_COLOR_PRESETS[themeStyle].secondary),
          fontFamily: "Sora, Inter, system-ui, sans-serif",
          logoUrl: logoUrl || null,
          contact: {
            email: null,
            phone: null,
            address: null
          },
          openingHours: null,
          socials: {},
          features: {
            includeServices: true,
            includeTestimonials: true,
            includePricing: false,
            includeFaq: true,
            includeContact: true,
            includeReservation:
              industry.toLowerCase().includes("restaurant") ||
              description.toLowerCase().includes("reservation"),
            includeGallery:
              industry.toLowerCase().includes("restaurant") ||
              description.toLowerCase().includes("gallery")
          },
          hasOwnPhotos: businessImages.length > 0
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create a website draft.");
      }

      const siteId =
        typeof payload?.siteId === "string"
          ? payload.siteId
          : typeof payload?.id === "string"
            ? payload.id
            : typeof payload?.site?.id === "string"
              ? payload.site.id
              : null;

      if (!siteId) {
        throw new Error("Draft created with an unexpected response. Please try again.");
      }

      await uploadBusinessPhotos(siteId);

      const generationPayload = buildGenerationPayload({
        siteId,
        businessId,
        businessName,
        industry,
        prompt: description,
        rawPrompt: originalPrompt ?? description,
        enhancedPrompt:
          originalPrompt && originalPrompt.trim() !== description ? description : undefined,
        themeStyle,
        selectedTemplate:
          typeof payload?.templateId === "string"
            ? payload.templateId
            : typeof payload?.templateKey === "string"
              ? payload.templateKey
              : null,
        logoUrl,
        primaryColor: normalizeColor(primaryColor, THEME_COLOR_PRESETS[themeStyle].primary),
        secondaryColor: normalizeColor(secondaryColor, THEME_COLOR_PRESETS[themeStyle].secondary),
        hasOwnPhotos: businessImages.length > 0
      });

      persistGenerationBrief(siteId, generationPayload);
      markChecklistTaskComplete("create_website", true);
      router.push(`/editor/${siteId}/generate`);
    } catch (startError) {
      console.error("[BUILDER_STUDIO_START_ERROR]", startError);
      setError(startError instanceof Error ? startError.message : "Unable to start generation.");
      setIsStarting(false);
    }
  };

  const enhancePrompt = async () => {
    if (isEnhancing || isStarting || isUploadingLogo) return;
    const description = prompt.trim();
    if (description.length < 12) {
      setError("Describe the website in a little more detail before enhancing.");
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      const response = await fetch("/api/builder/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: description,
          businessName,
          industry: initialIndustry,
          themeStyle,
          primaryColor: normalizeColor(primaryColor, THEME_COLOR_PRESETS[themeStyle].primary),
          secondaryColor: normalizeColor(secondaryColor, THEME_COLOR_PRESETS[themeStyle].secondary)
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to enhance this prompt.");
      }

      const enhancedPrompt =
        typeof payload?.enhancedPrompt === "string" ? payload.enhancedPrompt.trim() : "";
      if (!enhancedPrompt) {
        throw new Error("Prompt enhancement returned an empty result.");
      }

      setOriginalPrompt((current) => current ?? description);
      setPrompt(enhancedPrompt);
    } catch (enhanceError) {
      console.error("[BUILDER_STUDIO_ENHANCE_ERROR]", enhanceError);
      setError(enhanceError instanceof Error ? enhanceError.message : "Unable to enhance prompt.");
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="builder-studio -mx-4 -my-6 min-h-[calc(100dvh-5.5rem)] px-4 py-10 text-[var(--builder-studio-text)] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center pt-5 text-center sm:pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--builder-studio-muted)] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[var(--builder-studio-accent)]" />
            Website Studio
          </div>

          <h2 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight text-[var(--builder-studio-text)] sm:text-5xl lg:text-6xl">
            Describe the website you want to build
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--builder-studio-muted)] sm:text-base">
            Create a polished SiroundChat website draft with business-ready structure, copy, and calls to action.
          </p>

          <div className="mt-8 w-full">
            <div className="rounded-[28px] border border-[var(--builder-studio-border-strong)] bg-[var(--builder-studio-panel)] p-3 text-left shadow-[var(--builder-studio-shadow)]">
              <label className="sr-only" htmlFor="builder-studio-prompt">
                Website prompt
              </label>
              <textarea
                id="builder-studio-prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void startGeneration();
                  }
                }}
                rows={5}
                disabled={isStarting}
                placeholder="Create a premium website for my restaurant with reservations, menu highlights, gallery, reviews, and a warm elegant style..."
                className="min-h-[150px] w-full resize-none rounded-[20px] border-0 bg-transparent px-3 py-3 text-base leading-7 text-[var(--builder-studio-text)] outline-none placeholder:text-[var(--builder-studio-placeholder)] disabled:cursor-not-allowed disabled:opacity-70"
              />

              <div className="grid gap-3 border-t border-[var(--builder-studio-border)] px-2 py-4 lg:grid-cols-[1.45fr_0.95fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                    Style direction
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--builder-studio-muted)]">
                    This adjusts tone, mood, and visual flavor. Template choice still comes from your business prompt.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {THEME_STYLE_OPTIONS.map((option) => {
                      const selected = themeStyle === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => applyThemeStyle(option.id)}
                          disabled={isStarting || isEnhancing || isUploadingLogo}
                          className={cn(
                            "rounded-[20px] border px-4 py-3 text-left transition",
                            selected
                              ? "border-[var(--builder-studio-accent)] bg-[rgba(255,212,0,0.08)]"
                              : "border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] hover:border-[var(--builder-studio-border-strong)]"
                          )}
                        >
                          <span className="block text-sm font-semibold text-[var(--builder-studio-text)]">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--builder-studio-muted)]">
                            {option.description}
                          </span>
                          <span className="mt-3 flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: THEME_COLOR_PRESETS[option.id].primary }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: THEME_COLOR_PRESETS[option.id].secondary }}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                        <Palette className="h-3.5 w-3.5" />
                        Primary color
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(event) => {
                            setHasManualColorSelection(true);
                            setPrimaryColor(event.target.value);
                          }}
                          className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--builder-studio-border)] bg-transparent"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(event) => {
                            setHasManualColorSelection(true);
                            setPrimaryColor(event.target.value);
                          }}
                          className="h-11 flex-1 rounded-xl border border-[var(--builder-studio-border)] bg-white/70 px-3 text-sm text-[var(--builder-studio-text)] outline-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                        <Palette className="h-3.5 w-3.5" />
                        Secondary color
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(event) => {
                            setHasManualColorSelection(true);
                            setSecondaryColor(event.target.value);
                          }}
                          className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--builder-studio-border)] bg-transparent"
                        />
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(event) => {
                            setHasManualColorSelection(true);
                            setSecondaryColor(event.target.value);
                          }}
                          className="h-11 flex-1 rounded-xl border border-[var(--builder-studio-border)] bg-white/70 px-3 text-sm text-[var(--builder-studio-text)] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                      Logo
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStarting || isEnhancing || isUploadingLogo}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--builder-studio-muted)] transition hover:text-[var(--builder-studio-text)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {logoUrl ? "Replace" : "Upload"}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleLogoUpload(event.target.files?.[0] ?? null)}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setIsDraggingLogo(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0] ?? null;
                      void handleLogoUpload(file);
                    }}
                    disabled={isStarting || isEnhancing || isUploadingLogo}
                    className={cn(
                      "mt-3 flex min-h-[150px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed px-4 py-5 text-center transition",
                      isDraggingLogo
                        ? "border-[var(--builder-studio-accent)] bg-[rgba(255,212,0,0.08)]"
                        : "border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] hover:border-[var(--builder-studio-border-strong)]",
                      (isStarting || isEnhancing || isUploadingLogo) && "cursor-not-allowed opacity-70"
                    )}
                  >
                    {logoUrl ? (
                      <>
                        <Image
                          src={logoUrl}
                          alt="Logo preview"
                          width={64}
                          height={64}
                          unoptimized
                          className="h-16 w-16 object-contain"
                        />
                        <span className="mt-3 text-sm font-semibold text-[var(--builder-studio-text)]">
                          Logo ready
                        </span>
                        <span className="mt-1 text-xs text-[var(--builder-studio-muted)]">
                          Drag in a replacement or click to browse.
                        </span>
                      </>
                    ) : (
                      <>
                        {isUploadingLogo ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[var(--builder-studio-accent)]" />
                        ) : (
                          <UploadCloud className="h-5 w-5 text-[var(--builder-studio-accent)]" />
                        )}
                        <span className="mt-3 text-sm font-semibold text-[var(--builder-studio-text)]">
                          {isUploadingLogo ? "Uploading logo..." : "Upload or drag a logo"}
                        </span>
                        <span className="mt-1 text-xs text-[var(--builder-studio-muted)]">
                          PNG recommended. JPG and WebP also work. It will be used where the selected template supports branding.
                        </span>
                      </>
                    )}
                  </button>

                  <div className="rounded-[22px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface-muted)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                        Business photos
                      </p>
                      <button
                        type="button"
                        onClick={() => businessImageInputRef.current?.click()}
                        disabled={isStarting || isEnhancing || isUploadingLogo}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--builder-studio-muted)] transition hover:text-[var(--builder-studio-text)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Images className="h-3.5 w-3.5" />
                        Add photos
                      </button>
                    </div>

                    <input
                      ref={businessImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => addBusinessImages(event.target.files)}
                    />

                    <button
                      type="button"
                      onClick={() => businessImageInputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDraggingImages(true);
                      }}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setIsDraggingImages(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                        setIsDraggingImages(false);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        addBusinessImages(event.dataTransfer.files);
                        setIsDraggingImages(false);
                      }}
                      disabled={isStarting || isEnhancing || isUploadingLogo}
                      className={cn(
                        "mt-3 flex min-h-[112px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed px-4 py-5 text-center transition",
                        isDraggingImages
                          ? "border-[var(--builder-studio-accent)] bg-[rgba(255,212,0,0.08)]"
                          : "border-[var(--builder-studio-border)] bg-white/60 hover:border-[var(--builder-studio-border-strong)]"
                      )}
                    >
                      <UploadCloud className="h-5 w-5 text-[var(--builder-studio-accent)]" />
                      <span className="mt-3 text-sm font-semibold text-[var(--builder-studio-text)]">
                        Upload restaurant photos
                      </span>
                      <span className="mt-1 text-xs text-[var(--builder-studio-muted)]">
                        Interior, plating, dining room, or team photos. Up to 6 images. Assign slots after upload.
                      </span>
                    </button>

                    {businessImages.length ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {businessImages.map((image) => (
                          <div key={image.id} className="overflow-hidden rounded-2xl border border-[var(--builder-studio-border)] bg-black/5">
                            <Image
                              src={image.previewUrl}
                              alt={image.file.name}
                              width={160}
                              height={120}
                              unoptimized
                              className="h-24 w-full object-cover"
                            />
                            <div className="space-y-2 bg-black/70 px-2 py-2">
                              <select
                                value={image.targetSlot}
                                onChange={(event) =>
                                  setBusinessImageSlot(image.id, event.target.value as BuilderImageSlot)
                                }
                                className="h-8 w-full rounded-lg border border-white/10 bg-white/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white outline-none"
                              >
                                {BUILDER_IMAGE_SLOT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value} className="text-black">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
                                <span>
                                  {
                                    BUILDER_IMAGE_SLOT_OPTIONS.find((option) => option.value === image.targetSlot)
                                      ?.label
                                  }
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeBusinessImage(image.id)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15"
                                  aria-label="Remove business photo"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {businessImages.length ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--builder-studio-muted)]">
                        Hero = first image visitors see. Gallery = atmosphere or interior. About / Story = team or kitchen.
                        Menu / Dishes = plating and signature items. Reservation = supporting reservation image. Auto lets the
                        builder place it.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 border-t border-[var(--builder-studio-border)] px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--builder-studio-muted)]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--builder-studio-surface-muted)] px-3 py-2">
                    <Globe2 className="h-3.5 w-3.5" />
                    Project: {businessName}
                  </span>
                  <Link
                    href="/dashboard/builder/new"
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold text-[var(--builder-studio-muted)] transition hover:text-[var(--builder-studio-text)]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Advanced setup
                  </Link>
                  {originalPrompt ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(originalPrompt);
                        setOriginalPrompt(null);
                        setError(null);
                      }}
                      disabled={isStarting || isEnhancing}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold text-[var(--builder-studio-muted)] transition hover:text-[var(--builder-studio-text)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Use original
                    </button>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void enhancePrompt()}
                    disabled={isStarting || isEnhancing || isUploadingLogo}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--builder-studio-border)] px-4 text-sm font-semibold text-[var(--builder-studio-text)] transition hover:border-[var(--builder-studio-border-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enhancing
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Enhance Prompt
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void startGeneration()}
                    disabled={isStarting || isEnhancing || isUploadingLogo}
                    data-tutorial-target="builder-create-site"
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--builder-studio-accent)] px-5 text-sm font-semibold text-[var(--builder-studio-accent-text)] shadow-[0_14px_30px_rgba(255,212,0,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting
                      </>
                    ) : (
                      <>
                        Generate website
                        <ArrowUp className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 text-left text-sm font-medium text-[var(--builder-studio-danger)]">{error}</p>
            ) : null}
          </div>

          <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                disabled={isStarting}
                className="rounded-full border border-[var(--builder-studio-border)] bg-[var(--builder-studio-chip)] px-3.5 py-2 text-xs font-semibold text-[var(--builder-studio-muted)] transition hover:border-[var(--builder-studio-border-strong)] hover:text-[var(--builder-studio-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
          <div className="rounded-[24px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface)] p-5 shadow-[var(--builder-studio-card-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--builder-studio-muted)]">
                  Existing websites
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[var(--builder-studio-text)]">
                  Drafts and published sites
                </h3>
              </div>
              <Link
                href="/dashboard/builder/new"
                className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--builder-studio-border)] px-4 text-xs font-semibold text-[var(--builder-studio-text)] transition hover:border-[var(--builder-studio-border-strong)]"
              >
                Guided setup
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {recentSites.length ? (
                recentSites.map((site) => (
                  <div
                    key={site.id}
                    className="rounded-[20px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-base font-semibold text-[var(--builder-studio-text)]">
                            {site.business_name || "Untitled website"}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--builder-studio-surface-muted)] px-2.5 py-1 text-[11px] font-semibold capitalize text-[var(--builder-studio-muted)]">
                            {site.published_url ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Clock3 className="h-3 w-3" />
                            )}
                            {site.published_url ? "Published" : site.status || "Draft"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--builder-studio-muted)]">
                          {site.template_key || "auto-modern"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--builder-studio-muted)]">{formatDate(site.updated_at)}</p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/dashboard/builder/${site.id}`}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--builder-studio-text)] px-3.5 text-xs font-semibold text-[var(--builder-studio-inverse-text)]"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Manage
                        </Link>
                        {site.published_url ? (
                          <a
                            href={site.published_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--builder-studio-border)] px-3.5 text-xs font-semibold text-[var(--builder-studio-text)]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Live
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-6 text-center">
                  <p className="text-sm font-semibold text-[var(--builder-studio-text)]">No websites yet</p>
                  <p className="mt-1 text-sm text-[var(--builder-studio-muted)]">
                    Use the prompt above to generate your first draft.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-[24px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-surface)] p-5 shadow-[var(--builder-studio-card-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--builder-studio-muted)]">
              Studio profile
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[18px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--builder-studio-muted)]">
                  Business
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--builder-studio-text)]">{businessName}</p>
                <p className="mt-1 text-sm text-[var(--builder-studio-muted)]">
                  {initialIndustry?.trim() || "Service business"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--builder-studio-muted)]">
                    Sites
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--builder-studio-text)]">{sites.length}</p>
                </div>
                <div className="rounded-[18px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--builder-studio-muted)]">
                    Live
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--builder-studio-text)]">
                    {sites.filter((site) => site.published_url).length}
                  </p>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "mt-5 rounded-[18px] border border-[var(--builder-studio-border)] bg-[var(--builder-studio-row)] p-4",
                !sites.length && "hidden"
              )}
            >
              <p className="text-sm font-semibold text-[var(--builder-studio-text)]">Publish access</p>
              <p className="mt-1 text-sm leading-6 text-[var(--builder-studio-muted)]">
                Open a website from the list to manage publishing and live links.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
