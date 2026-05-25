"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BrainCog,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileText,
  ExternalLink,
  Images,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Undo2,
  UploadCloud,
  WandSparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { useToast } from "@/components/ui/toast";
import { DeviceSwitch, type PreviewDevice } from "@/components/generation/DeviceSwitch";
import { PublishButtonWithModal } from "@/components/generation/PublishButtonWithModal";
import {
  BUILDER_IMAGE_SLOT_OPTIONS,
  type BuilderImageSlot,
  normalizeBuilderImageSlot,
  resolveAssetKindFromSlot
} from "@/lib/builder/site-assets";
import {
  isGenerationBriefComplete,
  normalizeContentLanguage,
  normalizeGenerationBriefForForm,
  normalizeQualityMode,
  sanitizeGenerationBrief
} from "@/lib/builder/generation-config";
import {
  parseIntegratedTemplateSiteDocument,
  type IntegratedTemplateSiteDocument
} from "@/lib/builder/template-sites/schema";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import type { SiteDocument } from "@/lib/website-builder/types";
import { StudioGenerationSpecSchema } from "@/lib/website-studio/schema";
import { buildRestaurantStudioSpecFromGenerationPayload } from "@/lib/website-studio/spec-builder";
import type { GenerationBrief } from "@/state/generation";

type GenerationScreenProps = {
  siteId: string;
};

type RenderDocument = SiteDocument | IntegratedTemplateSiteDocument;

type SiteSnapshot = {
  slug: string | null;
  businessName: string;
  renderDocument: RenderDocument | null;
  status: string | null;
  publishedUrl: string | null;
  updatedAt: string | null;
};

type BuilderSiteAsset = {
  id: string;
  kind: "logo" | "hero" | "gallery" | "other" | null;
  target_slot: BuilderImageSlot | null;
  url: string;
  created_at: string | null;
};

type ActivityAttachment = {
  id: string;
  name: string;
  previewUrl?: string;
};

type ActivityTraceStep = {
  kind: "inspect" | "think" | "apply" | "render" | "read";
  label: string;
};

type ActivityPatchCard = {
  title: string;
  versionLabel: string;
  deltaLabel: string;
};

type ActivityEntry = {
  id: string;
  kind: "user" | "assistant" | "error" | "clarification";
  title: string;
  detail?: string;
  createdAt: string;
  attachments?: ActivityAttachment[];
  traceSteps?: ActivityTraceStep[];
  bullets?: string[];
  patch?: ActivityPatchCard;
  durationMs?: number;
};

const INITIAL_STAGES = [
  "Selecting template",
  "Generating restaurant content",
  "Sourcing images",
  "Assembling template",
  "Rendering preview"
];

const ASSET_REFRESH_STAGES = [
  "Refreshing site imagery",
  "Prioritizing business photos",
  "Re-rendering preview"
];

const DESKTOP_PREVIEW_VIEWPORT = {
  width: 1440,
  height: 900
} as const;

const isHexColor = (value?: string | null) =>
  Boolean(value && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim()));

const normalizeTextOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeEmailOrNull = (value: unknown) => {
  const normalized = normalizeTextOrNull(value);
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
};

const normalizeSocials = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const next: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(source)) {
    const normalized = normalizeTextOrNull(raw);
    if (normalized !== null) next[key] = normalized;
  }
  return next;
};

const normalizeFeatures = (value: unknown) => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    includeServices: Boolean(source.includeServices ?? true),
    includeTestimonials: Boolean(source.includeTestimonials),
    includePricing: Boolean(source.includePricing),
    includeFaq: Boolean(source.includeFaq),
    includeContact: Boolean(source.includeContact ?? true),
    includeReservation: Boolean(source.includeReservation),
    includeGallery: Boolean(source.includeGallery)
  };
};

const parseStoredStudioSpec = (value: unknown) => {
  const parsed = StudioGenerationSpecSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const parseRenderDocument = (value: unknown): RenderDocument | null => {
  const integrated = parseIntegratedTemplateSiteDocument(value);
  if (integrated) return integrated;
  const legacy = SiteDocumentSchema.safeParse(value);
  return legacy.success ? legacy.data : null;
};

const isIntegratedRenderDocument = (
  document?: RenderDocument | null
): document is IntegratedTemplateSiteDocument =>
  Boolean(document && typeof document === "object" && "kind" in document && document.kind === "integrated_template");

const normalizeStoredBrief = (value: any, siteId: string): GenerationBrief | null => {
  if (!value || typeof value !== "object") return null;
  const tone = normalizeTextOrNull(value.tone) ?? "professional";

  return {
    siteId,
    businessId: String(value.businessId ?? value.business_id ?? ""),
    businessName: normalizeTextOrNull(value.businessName ?? value.business_name) ?? "",
    industry: normalizeTextOrNull(value.industry) ?? "Service",
    themeStyle:
      normalizeTextOrNull(value.themeStyle ?? value.theme_style ?? value.studioSpec?.business?.themeStyle) ??
      undefined,
    contentLanguage: normalizeContentLanguage(value.contentLanguage ?? value.language ?? value.content_language),
    qualityMode: normalizeQualityMode(value.qualityMode),
    generationBrief: normalizeGenerationBriefForForm(
      value.generationBrief ?? value.brief ?? value.generation_brief,
      tone
    ),
    tone,
    pagesMode: normalizeTextOrNull(value.pagesMode ?? value.pages_mode) ?? "one",
    templateId: normalizeTextOrNull(value.templateId ?? value.template_id) ?? undefined,
    selectedTemplate:
      normalizeTextOrNull(value.selectedTemplate ?? value.selected_template ?? value.templateId ?? value.template_id) ??
      undefined,
    primaryColor: normalizeTextOrNull(value.primaryColor ?? value.primary_color) ?? "#111827",
    secondaryColor: normalizeTextOrNull(value.secondaryColor ?? value.secondary_color) ?? "#F3F4F6",
    fontFamily:
      normalizeTextOrNull(value.fontFamily ?? value.font_family) ??
      "Sora, Inter, system-ui, sans-serif",
    logoUrl: normalizeTextOrNull(value.logoUrl ?? value.logo_url),
    description: normalizeTextOrNull(value.description) ?? "",
    rawPrompt: normalizeTextOrNull(value.rawPrompt ?? value.raw_prompt) ?? undefined,
    enhancedPrompt: normalizeTextOrNull(value.enhancedPrompt ?? value.enhanced_prompt) ?? undefined,
    contact: {
      email: normalizeEmailOrNull(value.contact?.email ?? value.contact_email),
      phone: normalizeTextOrNull(value.contact?.phone ?? value.contact_phone),
      address: normalizeTextOrNull(value.contact?.address ?? value.contact_address)
    },
    openingHours: normalizeTextOrNull(value.openingHours ?? value.opening_hours),
    socials: normalizeSocials(value.socials),
    features: {
      ...normalizeFeatures(value.features),
      includeReservation: Boolean(value.features?.includeReservation ?? value.include_reservation)
    },
    hasOwnPhotos: Boolean(value.hasOwnPhotos ?? value.has_own_photos),
    chatbotEmbedSnippet: normalizeTextOrNull(value.chatbotEmbedSnippet ?? value.chatbot_embed_snippet),
    studioSpec: parseStoredStudioSpec(value.studioSpec ?? value.studio_spec)
  };
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEntry = (
  kind: ActivityEntry["kind"],
  title: string,
  detail?: string,
  extras: Partial<Omit<ActivityEntry, "id" | "kind" | "title" | "detail" | "createdAt">> = {}
): ActivityEntry => ({
  id: createId(),
  kind,
  title,
  detail,
  createdAt: new Date().toISOString(),
  ...extras
});

const formatIdLabel = (value?: string | null) =>
  (value ?? "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (token) => token.toUpperCase())
    .trim();

const formatUpdatedAtLabel = (value?: string | null) => {
  if (!value) return "Just now";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Just now";
  return new Date(timestamp).toLocaleString();
};

const formatActivityTimeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

const formatDurationLabel = (value?: number) => {
  if (!value || value < 1000) return "1s";
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${totalSeconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const humanizeAppliedChange = (value: string) => {
  const exact: Record<string, string> = {
    hero_headline: "Updated the hero headline",
    hero_subheadline: "Updated the hero supporting copy",
    story_text: "Refined the story section copy",
    reservation_text: "Strengthened the reservation copy",
    contact_text: "Updated the contact section copy",
    faq_heading: "Updated the FAQ heading",
    faq_rebuilt: "Rebuilt the FAQ section",
    story_rebuilt: "Rebuilt the story section",
    reservation_rebuilt: "Rebuilt the reservation section",
    contact_rebuilt: "Rebuilt the contact section",
    faq_readability: "Fixed the FAQ contrast and readability",
    hero_text_color: "Changed the hero text color",
    text_color: "Updated the main text color",
    button_color: "Updated the primary button color",
    background_dark: "Shifted the background darker",
    text_align_center: "Centered the text layout",
    spacing_relaxed: "Increased section spacing",
    spacing_compact: "Tightened section spacing",
    hero_size_large: "Increased the hero text size",
    hero_size_small: "Reduced the hero text size",
    body_size_large: "Increased the body text size",
    body_size_small: "Reduced the body text size"
  };

  if (exact[value]) return exact[value];
  if (value.startsWith("hide_")) {
    return `Hid the ${formatIdLabel(value.replace("hide_", ""))} section`;
  }
  if (value.startsWith("show_")) {
    return `Enabled the ${formatIdLabel(value.replace("show_", ""))} section`;
  }
  if (value.endsWith("_text_color")) {
    return `Updated the ${formatIdLabel(value.replace("_text_color", ""))} text color`;
  }
  if (value.endsWith("_background_color")) {
    return `Adjusted the ${formatIdLabel(value.replace("_background_color", ""))} background`;
  }
  if (value.endsWith("_repaired")) {
    return `Repaired the ${formatIdLabel(value.replace("_repaired", ""))} section`;
  }
  return formatIdLabel(value);
};

const buildGenerateTraceSteps = (): ActivityTraceStep[] => [
  { kind: "inspect", label: "Selected the best-fit template" },
  { kind: "apply", label: "Generated restaurant content and imagery" },
  { kind: "render", label: "Rendered the first preview" }
];

const buildEditTraceSteps = (args: {
  referenceImagesCount: number;
  thinkMode: boolean;
  aiRefinementUsed: boolean;
  imageRefreshUsed: boolean;
  durationMs: number;
}): ActivityTraceStep[] => {
  const steps: ActivityTraceStep[] = [];

  if (args.referenceImagesCount > 0) {
    steps.push({
      kind: "inspect",
      label: `Analyzed ${args.referenceImagesCount} attached screenshot${args.referenceImagesCount === 1 ? "" : "s"}`
    });
  }

  if (args.thinkMode) {
    steps.push({
      kind: "think",
      label: `Thought harder for ${formatDurationLabel(args.durationMs)}`
    });
  }

  steps.push({
    kind: args.aiRefinementUsed ? "apply" : "read",
    label: args.aiRefinementUsed
      ? "Applied deterministic fixes and then ran a stronger template refinement pass"
      : "Mapped the request into deterministic template controls and section repairs"
  });

  steps.push({
    kind: args.imageRefreshUsed ? "render" : "apply",
    label: args.imageRefreshUsed
      ? "Refreshed imagery and re-rendered the preview"
      : "Re-rendered the live preview and synced the template document"
  });

  return steps;
};

const buildLegacyOutcomeBullets = (next: SiteDocument) => {
  const bullets: string[] = [];
  const design = next.siteBrief?.designDNA;
  if (design?.archetypeKey || design?.layoutDNA) {
    bullets.push(
      `Selected ${[formatIdLabel(design?.archetypeKey), formatIdLabel(design?.layoutDNA)]
        .filter(Boolean)
        .join(" with ")}`
    );
  }
  bullets.push(`Prepared palette ${next.theme.primary} on ${next.theme.bg}`);
  bullets.push(
    `Prepared typography ${[next.theme.fontHeading, next.theme.fontBody]
      .filter(Boolean)
      .join(" / ")}`
  );
  return bullets;
};

const buildIntegratedOutcomeBullets = (
  previous: IntegratedTemplateSiteDocument | null,
  next: IntegratedTemplateSiteDocument
) => {
  const bullets: string[] = [];

  if (!previous || previous.template !== next.template) {
    bullets.push(`Selected ${formatIdLabel(next.template)} as the active template`);
  }

  bullets.push(next.meta.selection.reason);
  bullets.push(
    `Built ${next.content.business.cuisine.toLowerCase()} copy with a ${next.content.business.vibe.toLowerCase()} tone`
  );
  bullets.push(
    next.meta.imagePolicy.usedV0HeroGeneration
      ? "Used Pexels-first imagery with one gated v0 hero image"
      : "Used Pexels-first imagery with strict image limits"
  );
  bullets.push(`Anchored the page with "${next.content.hero.headline}"`);

  return bullets;
};

const buildAssistantEntry = (args: {
  title: string;
  detail: string;
  bullets: string[];
  patchTitle: string;
  versionNumber: number;
  deltaCount: number;
  traceSteps?: ActivityTraceStep[];
  durationMs?: number;
}) =>
  createEntry("assistant", args.title, args.detail, {
    bullets: args.bullets,
    traceSteps: args.traceSteps,
    durationMs: args.durationMs,
    patch: {
      title: args.patchTitle,
      versionLabel: `v${args.versionNumber}`,
      deltaLabel: `+${Math.max(1, args.deltaCount)}`
    }
  });

const documentBusinessName = (document?: RenderDocument | null) => {
  if (!document) return null;
  return isIntegratedRenderDocument(document)
    ? document.meta.businessName
    : document.siteBrief?.businessName ?? null;
};

const buildRenderDocumentChangeEntry = (args: {
  previous: RenderDocument | null;
  next: RenderDocument;
  operation: "hydrate" | "generate" | "edit";
  versionNumber: number;
  durationMs?: number;
  traceSteps?: ActivityTraceStep[];
  appliedChanges?: string[];
  analysisNotes?: string[];
  customTitle?: string;
}) => {
  const { previous, next, operation, versionNumber, durationMs, traceSteps, appliedChanges, analysisNotes, customTitle } = args;
  const isIntegrated = isIntegratedRenderDocument(next);
  const patchTitle = isIntegrated
    ? `${previous ? "Updated" : "Built"} ${formatIdLabel(next.template)} preview`
    : previous
      ? "Updated website preview"
      : "Built website preview";

  const fallbackBullets = isIntegrated
    ? buildIntegratedOutcomeBullets(
        isIntegratedRenderDocument(previous) ? previous : null,
        next
      )
    : buildLegacyOutcomeBullets(next);

  const bullets =
    appliedChanges && appliedChanges.length
      ? appliedChanges.map(humanizeAppliedChange)
      : analysisNotes && analysisNotes.length
        ? analysisNotes
        : fallbackBullets;

  const detail =
    customTitle ??
    (operation === "generate"
      ? "I finished the first website pass and assembled the preview below."
      : operation === "edit"
        ? "I updated the preview, synced the integrated template document, and listed the exact changes below."
        : "I recovered the latest website draft and summarized the current state below.");

  return buildAssistantEntry({
    title:
      operation === "generate"
        ? "Generated website preview"
        : operation === "edit"
          ? "Applied website edit"
          : "Recovered website draft",
    detail,
    bullets,
    patchTitle,
    versionNumber,
    deltaCount: appliedChanges?.length ?? bullets.length,
    traceSteps,
    durationMs
  });
};

const buildHydratedEntries = (brief: GenerationBrief | null, document: RenderDocument) => {
  const entries: ActivityEntry[] = [];
  const sourcePrompt =
    brief?.enhancedPrompt ??
    brief?.description ??
    brief?.studioSpec?.sourcePrompt ??
    (isIntegratedRenderDocument(document)
      ? document.meta.sourcePrompt
      : document.siteBrief?.studio?.generationSpec?.sourcePrompt ?? document.siteBrief?.description);

  if (sourcePrompt) {
    entries.push(createEntry("user", sourcePrompt));
  }

  entries.push(
    buildRenderDocumentChangeEntry({
      previous: null,
      next: document,
      operation: "hydrate",
      versionNumber: 1
    })
  );
  return entries;
};

const providerLabelForDocument = (document?: RenderDocument | null) => {
  if (!document) return "siroundchat-current";
  if (isIntegratedRenderDocument(document)) {
    return `template:${document.template}`;
  }
  return document.siteBrief?.studio?.provider?.provider ?? "siroundchat-current";
};

const promptPlaceholder = (document?: RenderDocument | null) => {
  if (isIntegratedRenderDocument(document)) {
    return "Make it darker and more premium, refine the dining story, push reservations harder, or request new visuals if needed...";
  }
  return document
    ? "Make it darker and more premium, tighten the hero copy, clean up the gallery, or push reservations harder..."
    : "Wait for the first pass before sending follow-up edits.";
};

const buildEditStageLabels = (filesCount: number, thinkMode: boolean) => [
  ...(filesCount > 0 ? ["Analyzing screenshot"] : []),
  ...(thinkMode ? ["Thinking harder"] : []),
  "Mapping requested changes",
  "Updating integrated template",
  "Re-rendering preview"
];

export function GenerationScreen({ siteId }: GenerationScreenProps) {
  const { push: pushToast } = useToast();
  const [brief, setBrief] = useState<GenerationBrief | null>(null);
  const [briefHydrated, setBriefHydrated] = useState(false);
  const [siteSnapshot, setSiteSnapshot] = useState<SiteSnapshot | null>(null);
  const [siteHydrated, setSiteHydrated] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [composerThinkMode, setComposerThinkMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewPage, setPreviewPage] = useState<string>("home");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [siteAssets, setSiteAssets] = useState<BuilderSiteAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsUploading, setAssetsUploading] = useState(false);
  const [assetSlotSavingId, setAssetSlotSavingId] = useState<string | null>(null);
  const [isDraggingAssets, setIsDraggingAssets] = useState(false);

  const initialGenerationStartedRef = useRef(false);
  const activityScrollRef = useRef<HTMLDivElement | null>(null);
  const stageTimersRef = useRef<number[]>([]);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const activityAttachmentUrlsRef = useRef<string[]>([]);
  const assistantVersionRef = useRef(0);
  const desktopPreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const [desktopPreviewScale, setDesktopPreviewScale] = useState(1);

  const appendEntries = useCallback((entries: ActivityEntry[]) => {
    if (!entries.length) return;
    setActivityEntries((current) => [...current, ...entries]);
  }, []);

  const clearStageTimers = useCallback(() => {
    stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stageTimersRef.current = [];
  }, []);

  const queueStages = useCallback(
    (labels: string[]) => {
      clearStageTimers();
      labels.forEach((label, index) => {
        const timer = window.setTimeout(() => {
          setLiveStatus(label);
        }, index * 900);
        stageTimersRef.current.push(timer);
      });
    },
    [clearStageTimers]
  );

  const buildActivityAttachments = useCallback((files: File[]) => {
    return files.map((file) => {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      if (previewUrl) {
        activityAttachmentUrlsRef.current.push(previewUrl);
      }
      return {
        id: createId(),
        name: file.name,
        previewUrl
      };
    });
  }, []);

  const loadBrief = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(`sc_generation_brief:${siteId}`);
      if (!stored) return null;
      return normalizeStoredBrief(JSON.parse(stored), siteId);
    } catch {
      return null;
    }
  }, [siteId]);

  const persistGenerationBrief = useCallback(
    (value: unknown) => {
      try {
        window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(value));
      } catch (storageError) {
        console.warn("[GENERATION_STORAGE_WRITE_ERROR]", storageError);
      }
    },
    [siteId]
  );

  const loadSiteSnapshot = useCallback(async (): Promise<SiteSnapshot | null> => {
    try {
      const response = await fetch(`/api/builder/site?siteId=${siteId}`);
      if (!response.ok) return null;
      const data = await response.json();
      const renderDocument = parseRenderDocument(data?.site_document);
      return {
        slug: typeof data?.slug === "string" ? data.slug : null,
        businessName:
          normalizeTextOrNull(data?.business_name) ??
          documentBusinessName(renderDocument) ??
          "Website",
        renderDocument,
        status: normalizeTextOrNull(data?.status),
        publishedUrl: normalizeTextOrNull(data?.published_url),
        updatedAt: normalizeTextOrNull(data?.updated_at)
      };
    } catch {
      return null;
    }
  }, [siteId]);

  const loadSiteAssets = useCallback(async (): Promise<BuilderSiteAsset[]> => {
    try {
      const response = await fetch(`/api/builder/upload-image?siteId=${siteId}`);
      if (!response.ok) return [];
      const data = await response.json().catch(() => null);
      return Array.isArray(data?.assets)
        ? data.assets.filter(
            (asset: unknown): asset is BuilderSiteAsset => {
              const next = asset as Partial<BuilderSiteAsset> | null;
              return (
                typeof next?.id === "string" &&
                typeof next?.url === "string" &&
                next.url.length > 0
              );
            }
          )
            .map((asset: BuilderSiteAsset) => ({
              ...asset,
              target_slot: normalizeBuilderImageSlot(asset.target_slot, asset.kind === "hero" ? "hero" : "auto")
            }))
        : [];
    } catch {
      return [];
    }
  }, [siteId]);

  const buildGenerationPayload = useCallback(
    (sourceBrief: GenerationBrief) => {
      const tone = normalizeTextOrNull(sourceBrief.tone) ?? "professional";
      const normalizedBriefBase = {
        siteId,
        businessId: sourceBrief.businessId,
        businessName: sourceBrief.businessName,
        industry: sourceBrief.industry,
        themeStyle: sourceBrief.themeStyle,
        description:
          sourceBrief.enhancedPrompt ||
          sourceBrief.description ||
          sourceBrief.studioSpec?.sourcePrompt ||
          sourceBrief.generationBrief.coreOffer,
        rawPrompt:
          sourceBrief.rawPrompt ??
          sourceBrief.description ??
          sourceBrief.generationBrief.coreOffer,
        enhancedPrompt: sourceBrief.enhancedPrompt,
        tone,
        language: normalizeContentLanguage(sourceBrief.contentLanguage),
        qualityMode: normalizeQualityMode(sourceBrief.qualityMode),
        brief: sanitizeGenerationBrief(sourceBrief.generationBrief, tone),
        pagesMode: sourceBrief.pagesMode === "multi" ? "multi" : "one",
        templateId: sourceBrief.selectedTemplate ?? sourceBrief.templateId,
        selectedTemplate: sourceBrief.selectedTemplate ?? sourceBrief.templateId,
        primaryColor: isHexColor(sourceBrief.primaryColor) ? sourceBrief.primaryColor : "#111827",
        secondaryColor: isHexColor(sourceBrief.secondaryColor) ? sourceBrief.secondaryColor : "#F3F4F6",
        fontFamily:
          normalizeTextOrNull(sourceBrief.fontFamily) ??
          "Sora, Inter, system-ui, sans-serif",
        logoUrl: normalizeTextOrNull(sourceBrief.logoUrl),
        openingHours: normalizeTextOrNull(sourceBrief.openingHours),
        contact: {
          email: normalizeEmailOrNull(sourceBrief.contact?.email),
          phone: normalizeTextOrNull(sourceBrief.contact?.phone),
          address: normalizeTextOrNull(sourceBrief.contact?.address)
        },
        socials: normalizeSocials(sourceBrief.socials),
        targetCustomer: sourceBrief.generationBrief.audience,
        services: sourceBrief.generationBrief.topServices,
        proofAssets: sourceBrief.generationBrief.proofPoints,
        features: normalizeFeatures(sourceBrief.features),
        hasOwnPhotos: Boolean(sourceBrief.hasOwnPhotos),
        chatbotEmbedSnippet: normalizeTextOrNull(sourceBrief.chatbotEmbedSnippet),
        studioSource: sourceBrief.studioSpec?.source ?? "prompt_studio"
      };

      const normalizedPayload = {
        ...normalizedBriefBase,
        studioSpec:
          parseStoredStudioSpec(sourceBrief.studioSpec) ??
          buildRestaurantStudioSpecFromGenerationPayload(normalizedBriefBase)
      };

      if (!isGenerationBriefComplete(normalizedPayload.brief)) {
        throw new Error("Complete the generation brief before starting generation.");
      }

      return normalizedPayload;
    },
    [siteId]
  );

  const previewUrl = useMemo(() => {
    const slug = siteSnapshot?.slug || "preview";
    return `/s/${slug}?preview=true&siteId=${siteId}&page=${previewPage}&v=${previewRevision}`;
  }, [previewPage, previewRevision, siteId, siteSnapshot?.slug]);

  const refreshSiteSnapshot = useCallback(async () => {
    const snapshot = await loadSiteSnapshot();
    if (snapshot) {
      setSiteSnapshot(snapshot);
    }
    return snapshot;
  }, [loadSiteSnapshot]);

  const refreshSiteAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const assets = await loadSiteAssets();
      setSiteAssets(assets);
      return assets;
    } finally {
      setAssetsLoading(false);
    }
  }, [loadSiteAssets]);

  const saveCurrentState = useCallback(async () => {
    if (!siteSnapshot?.renderDocument || saveState === "saving") {
      return false;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/builder/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          siteDocument: siteSnapshot.renderDocument
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Save failed");
      }

      await refreshSiteSnapshot();
      setSaveState("saved");
      pushToast({
        title: "Saved",
        message: "Draft updated.",
        variant: "success"
      });
      return true;
    } catch (saveError) {
      console.error("[GENERATION_SAVE_ERROR]", saveError);
      setSaveState("error");
      pushToast({
        title: "Save failed",
        message: saveError instanceof Error ? saveError.message : "Try again in a moment.",
        variant: "error"
      });
      return false;
    } finally {
      window.setTimeout(() => setSaveState("idle"), 1500);
    }
  }, [pushToast, refreshSiteSnapshot, saveState, siteId, siteSnapshot?.renderDocument]);

  const runInitialGeneration = useCallback(
    async (sourceBrief: GenerationBrief) => {
      const startedAt = Date.now();
      setIsRunning(true);
      setError(null);
      setPreviewLoading(true);
      appendEntries([
        createEntry(
          "user",
          sourceBrief.enhancedPrompt ||
            sourceBrief.description ||
            sourceBrief.studioSpec?.sourcePrompt ||
            sourceBrief.generationBrief.coreOffer
        )
      ]);
      queueStages(INITIAL_STAGES);

      try {
        const payload = buildGenerationPayload(sourceBrief);
        persistGenerationBrief(payload);

        const response = await fetch("/api/builder/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Generate failed");
        }

        const data = await response.json();
        const resolvedDocument = parseRenderDocument(data?.siteDocument);
        const nextSnapshot = (await loadSiteSnapshot()) ?? siteSnapshot;
        const nextDocument = resolvedDocument ?? nextSnapshot?.renderDocument ?? null;

        if (!nextDocument) {
          throw new Error("Generation finished without a valid preview document.");
        }

        setSiteSnapshot({
          slug: nextSnapshot?.slug ?? siteSnapshot?.slug ?? null,
          businessName:
            nextSnapshot?.businessName ??
            sourceBrief.businessName ??
            siteSnapshot?.businessName ??
            "Website",
          renderDocument: nextDocument,
          status: nextSnapshot?.status ?? siteSnapshot?.status ?? "draft",
          publishedUrl: nextSnapshot?.publishedUrl ?? siteSnapshot?.publishedUrl ?? null,
          updatedAt: nextSnapshot?.updatedAt ?? siteSnapshot?.updatedAt ?? new Date().toISOString()
        });
        setPreviewRevision((current) => current + 1);
        clearStageTimers();
        setLiveStatus(null);
        assistantVersionRef.current += 1;
        appendEntries([
          buildRenderDocumentChangeEntry({
            previous: null,
            next: nextDocument,
            operation: "generate",
            versionNumber: assistantVersionRef.current,
            durationMs: Date.now() - startedAt,
            traceSteps: buildGenerateTraceSteps()
          })
        ]);
      } catch (generationError) {
        clearStageTimers();
        setLiveStatus(null);
        const message =
          generationError instanceof Error
            ? generationError.message
            : "We couldn’t generate your website.";
        setError(message);
        appendEntries([createEntry("error", "Generation failed", message)]);
      } finally {
        setIsRunning(false);
      }
    },
    [
      appendEntries,
      buildGenerationPayload,
      clearStageTimers,
      loadSiteSnapshot,
      persistGenerationBrief,
      queueStages,
      siteSnapshot
    ]
  );

  const runStudioEditRequest = useCallback(
    async ({
      request,
      files = [],
      thinkMode = false,
      appendUserEntry = true,
      stageLabels,
      errorTitle = "Edit failed",
      successSummary
    }: {
      request: string;
      files?: File[];
      thinkMode?: boolean;
      appendUserEntry?: boolean;
      stageLabels?: string[];
      errorTitle?: string;
      successSummary?: string;
    }) => {
      const normalizedRequest = request.trim();
      if (!normalizedRequest || isRunning || !siteSnapshot?.renderDocument) return false;
      const startedAt = Date.now();
      const resolvedStageLabels = stageLabels ?? buildEditStageLabels(files.length, thinkMode);

      setIsRunning(true);
      setError(null);
      setPreviewLoading(true);
      if (appendUserEntry) {
        appendEntries([
          createEntry("user", normalizedRequest, undefined, {
            attachments: buildActivityAttachments(files)
          })
        ]);
      }
      queueStages(resolvedStageLabels);

      try {
        const hasReferences = files.length > 0 || thinkMode;
        const response = await fetch("/api/builder/studio-edit", {
          method: "POST",
          ...(hasReferences
            ? {
                body: (() => {
                  const payload = new FormData();
                  payload.append("siteId", siteId);
                  payload.append("prompt", normalizedRequest);
                  payload.append("thinkMode", thinkMode ? "true" : "false");
                  files.forEach((file) => payload.append("files", file));
                  return payload;
                })()
              }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  siteId,
                  prompt: normalizedRequest,
                  thinkMode
                })
              })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Could not apply that edit.");
        }

        const data = await response.json();

        // Handle clarification / advisory responses (not errors, but no document update)
        if (data?.type === "clarification_needed" || data?.type === "advisory") {
          clearStageTimers();
          setLiveStatus(null);
          const message =
            data.type === "clarification_needed"
              ? (data.clarification?.message ?? "Please provide more information to complete this edit.")
              : (data.advisory ?? "");
          appendEntries([
            createEntry(
              "clarification",
              data.type === "clarification_needed" ? "More information needed" : "Template note",
              message
            )
          ]);
          return false;
        }

        // Handle page_added — update document and switch preview to new page
        if (data?.type === "page_added") {
          clearStageTimers();
          setLiveStatus(null);
          const resolvedDoc = parseRenderDocument(data.siteDocument);
          if (resolvedDoc) {
            setSiteSnapshot((current) =>
              current ? { ...current, renderDocument: resolvedDoc, updatedAt: new Date().toISOString() } : current
            );
            setPreviewRevision((v) => v + 1);
          }
          if (typeof data.pageSlug === "string") {
            setPreviewPage(data.pageSlug);
          }
          assistantVersionRef.current += 1;
          appendEntries([
            createEntry(
              "assistant",
              `Page added: ${data.pageTitle ?? data.pageSlug ?? "New page"}`,
              [
                `Slug: /${data.pageSlug ?? ""}`,
                data.knowledgeUsed ? "Content generated from your business documents." : null
              ]
                .filter(Boolean)
                .join(" · ")
            )
          ]);
          return true;
        }

        const resolvedDocument = parseRenderDocument(data?.siteDocument);
        if (!resolvedDocument) {
          throw new Error("The edit completed without a valid preview document.");
        }

        const previousDocument = siteSnapshot.renderDocument;
        setSiteSnapshot((current) =>
          current
            ? {
                ...current,
                renderDocument: resolvedDocument,
                updatedAt: new Date().toISOString()
              }
            : current
        );
        setPreviewRevision((current) => current + 1);
        clearStageTimers();
        setLiveStatus(null);
        assistantVersionRef.current += 1;
        appendEntries([
          buildRenderDocumentChangeEntry({
            previous: previousDocument,
            next: resolvedDocument,
            operation: "edit",
            versionNumber: assistantVersionRef.current,
            durationMs: Date.now() - startedAt,
            traceSteps: buildEditTraceSteps({
              referenceImagesCount: Number(data?.referenceImagesUsed ?? files.length ?? 0),
              thinkMode: Boolean(data?.thinkMode ?? thinkMode),
              aiRefinementUsed: Boolean(data?.aiRefinementUsed),
              imageRefreshUsed: Boolean(data?.imageRefreshUsed),
              durationMs: Date.now() - startedAt
            }),
            appliedChanges: Array.isArray(data?.appliedChanges) ? data.appliedChanges : [],
            analysisNotes: Array.isArray(data?.analysisNotes) ? data.analysisNotes : [],
            customTitle: successSummary
              ? `${successSummary}. The updated preview is ready below.`
              : undefined
          })
        ]);
        return true;
      } catch (editError) {
        clearStageTimers();
        setLiveStatus(null);
        const message =
          editError instanceof Error ? editError.message : "We couldn’t apply that edit.";
        setError(message);
        appendEntries([createEntry("error", errorTitle, message)]);
        return false;
      } finally {
        setIsRunning(false);
      }
    },
    [appendEntries, buildActivityAttachments, clearStageTimers, isRunning, queueStages, siteId, siteSnapshot]
  );

  const updateAssetTargetSlot = useCallback(
    async (assetId: string, targetSlot: BuilderImageSlot) => {
      if (assetSlotSavingId || assetsUploading) return;
      setAssetSlotSavingId(assetId);
      setError(null);

      try {
        const response = await fetch("/api/builder/upload-image", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId, assetId, targetSlot })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to update image placement.");
        }

        await refreshSiteAssets();

        if (siteSnapshot?.renderDocument) {
          await runStudioEditRequest({
            request:
              "Replace hero image and gallery images using the manually assigned uploaded business photos. Use the selected upload slots exactly where they fit best.",
            appendUserEntry: false,
            stageLabels: ASSET_REFRESH_STAGES,
            errorTitle: "Image placement update failed",
            successSummary: "Updated image placement"
          });
          await refreshSiteAssets();
        }

        pushToast({
          title: "Image placement updated",
          message: "Manual slot choices now take priority over stock imagery.",
          variant: "success"
        });
      } catch (slotError) {
        const message =
          slotError instanceof Error ? slotError.message : "Unable to update image placement.";
        setError(message);
        pushToast({
          title: "Image placement failed",
          message,
          variant: "error"
        });
      } finally {
        setAssetSlotSavingId(null);
      }
    },
    [
      assetSlotSavingId,
      assetsUploading,
      pushToast,
      refreshSiteAssets,
      runStudioEditRequest,
      siteId,
      siteSnapshot?.renderDocument
    ]
  );

  const uploadBusinessPhotos = useCallback(
    async (files: FileList | File[] | null) => {
      const nextFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
      if (!nextFiles.length || assetsUploading) return;

      setAssetsUploading(true);
      setError(null);

      try {
        let fallbackHeroAssigned = siteAssets.some(
          (asset) => normalizeBuilderImageSlot(asset.target_slot, asset.kind === "hero" ? "hero" : "auto") === "hero"
        );

        for (const file of nextFiles.slice(0, 6)) {
          const targetSlot: BuilderImageSlot = fallbackHeroAssigned ? "auto" : "hero";
          const formData = new FormData();
          formData.append("siteId", siteId);
          formData.append("kind", resolveAssetKindFromSlot(targetSlot));
          formData.append("slot", targetSlot);
          formData.append("file", file);
          fallbackHeroAssigned = true;

          const response = await fetch("/api/builder/upload-image", {
            method: "POST",
            body: formData
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error ?? "Unable to upload business photos.");
          }
        }

        await refreshSiteAssets();
        pushToast({
          title: "Business photos uploaded",
          message: "These images will replace placeholder visuals where possible.",
          variant: "success"
        });

        if (siteSnapshot?.renderDocument) {
          await runStudioEditRequest({
            request:
              "Use the uploaded business photos as the primary imagery across the site. Replace hero image and gallery images with the uploaded business photos wherever appropriate.",
            appendUserEntry: false,
            stageLabels: ASSET_REFRESH_STAGES,
            errorTitle: "Image refresh failed",
            successSummary: "Uploaded business photos"
          });
          await refreshSiteAssets();
        }
      } catch (uploadError) {
        console.error("[GENERATION_ASSET_UPLOAD_ERROR]", uploadError);
        const message =
          uploadError instanceof Error ? uploadError.message : "Unable to upload business photos.";
        setError(message);
        pushToast({
          title: "Upload failed",
          message,
          variant: "error"
        });
      } finally {
        setAssetsUploading(false);
        setIsDraggingAssets(false);
        if (assetInputRef.current) {
          assetInputRef.current.value = "";
        }
      }
    },
    [assetsUploading, pushToast, refreshSiteAssets, runStudioEditRequest, siteAssets, siteId, siteSnapshot?.renderDocument]
  );

  useEffect(() => {
    let active = true;
    const storedBrief = loadBrief();
    if (storedBrief) {
      setBrief(storedBrief);
    }
    setBriefHydrated(true);

    loadSiteSnapshot().then((snapshot) => {
      if (!active) return;
      setSiteSnapshot(snapshot);
      setSiteHydrated(true);
      if (snapshot?.renderDocument) {
        setActivityEntries(buildHydratedEntries(storedBrief, snapshot.renderDocument));
        setPreviewLoading(false);
      }
    });

    loadSiteAssets().then((assets) => {
      if (!active) return;
      setSiteAssets(assets);
    });

    return () => {
      active = false;
    };
  }, [loadBrief, loadSiteAssets, loadSiteSnapshot]);

  useEffect(() => {
    if (!briefHydrated || !siteHydrated) return;
    if (!brief && !siteSnapshot?.renderDocument) {
      setError("We couldn't recover this generation brief. Return to Website Studio and start again.");
      return;
    }
    if (siteSnapshot?.renderDocument || !brief || initialGenerationStartedRef.current) {
      return;
    }
    initialGenerationStartedRef.current = true;
    void runInitialGeneration(brief);
  }, [brief, briefHydrated, runInitialGeneration, siteHydrated, siteSnapshot?.renderDocument]);

  useEffect(() => {
    if (!activityScrollRef.current) return;
    activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight;
  }, [activityEntries]);

  useEffect(() => {
    assistantVersionRef.current = activityEntries.filter((entry) => entry.kind === "assistant").length;
  }, [activityEntries]);

  useEffect(() => {
    if (previewDevice !== "desktop") return;
    const element = desktopPreviewViewportRef.current;
    if (!element) return;

    const updateScale = () => {
      const nextWidth = element.clientWidth;
      if (!nextWidth) return;
      setDesktopPreviewScale(clamp(nextWidth / DESKTOP_PREVIEW_VIEWPORT.width, 0.2, 1));
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(element);

    return () => observer.disconnect();
  }, [previewDevice, previewUrl, siteSnapshot?.renderDocument]);

  useEffect(() => {
    return () => {
      clearStageTimers();
      const attachmentUrls = [...activityAttachmentUrlsRef.current];
      attachmentUrls.forEach((url) => URL.revokeObjectURL(url));
      activityAttachmentUrlsRef.current = [];
    };
  }, [clearStageTimers]);

  const statusBadge = isRunning ? "Working" : siteSnapshot?.renderDocument ? "Ready" : "Waiting";
  const providerLabel = providerLabelForDocument(siteSnapshot?.renderDocument);
  const lastUpdatedLabel = formatUpdatedAtLabel(siteSnapshot?.updatedAt);
  const isPreviewReady = Boolean(siteSnapshot?.renderDocument);
  const previewFrame =
    previewDevice === "mobile" ? (
      <div className="relative mx-auto w-full max-w-[432px] shrink-0 py-3">
        <div className="pointer-events-none absolute inset-y-[18%] -left-[3px] z-20 flex flex-col justify-start gap-3">
          <span className="h-16 w-[3px] rounded-r-full bg-[#6e717b]" />
          <span className="h-24 w-[3px] rounded-r-full bg-[#6e717b]" />
          <span className="h-24 w-[3px] rounded-r-full bg-[#6e717b]" />
        </div>
        <div className="pointer-events-none absolute right-[-3px] top-[22%] z-20 h-24 w-[3px] rounded-l-full bg-[#6e717b]" />
        <div className="relative aspect-[430/932] rounded-[58px] bg-[linear-gradient(160deg,#7e828c_0%,#2e3138_18%,#070709_48%,#343840_82%,#9b9fa8_100%)] p-[6px] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
          <div className="h-full w-full rounded-[54px] border border-white/10 bg-[#020203] p-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.04)]">
            <div className="relative h-full overflow-hidden rounded-[46px] border border-white/10 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3">
                <div className="h-[35px] w-[148px] rounded-full border border-white/8 bg-[#050506] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_20px_rgba(0,0,0,0.45)]" />
              </div>
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Website preview"
                className="h-full w-full bg-white"
                onLoad={() => setPreviewLoading(false)}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2.5">
                <div className="h-1.5 w-28 rounded-full bg-white/18" />
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="relative mx-auto w-full max-w-[1480px] shrink-0 px-2 py-5">
        <div className="rounded-[34px] bg-[linear-gradient(180deg,#2b2d33_0%,#16171a_12%,#09090b_100%)] p-[8px] shadow-[0_40px_120px_rgba(0,0,0,0.46)]">
          <div className="rounded-[30px] border border-white/10 bg-[#0a0b0d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="mb-3 flex items-center justify-between rounded-[20px] border border-white/10 bg-[#15161a] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex min-w-0 flex-1 justify-center px-4">
                <div className="flex w-full max-w-[540px] items-center justify-center rounded-full border border-white/10 bg-[#0f1014] px-4 py-2 text-xs font-medium tracking-[0.08em] text-white/45">
                  Live desktop preview
                </div>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                1440px
              </div>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#030303] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div ref={desktopPreviewViewportRef} className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    width: DESKTOP_PREVIEW_VIEWPORT.width,
                    height: DESKTOP_PREVIEW_VIEWPORT.height,
                    transform: `scale(${desktopPreviewScale})`,
                    transformOrigin: "top left"
                  }}
                >
                  <iframe
                    key={previewUrl}
                    src={previewUrl}
                    title="Website preview"
                    className="h-full w-full bg-white"
                    onLoad={() => setPreviewLoading(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none mx-auto h-7 w-[28%] min-w-[220px] rounded-b-[24px] bg-[linear-gradient(180deg,#1f2025_0%,#09090b_100%)]" />
        <div className="pointer-events-none mx-auto h-4 w-[42%] min-w-[320px] rounded-full bg-black/45 blur-md" />
      </div>
    );

  const renderTraceIcon = (step: ActivityTraceStep) => {
    const className = "h-4.5 w-4.5";
    switch (step.kind) {
      case "inspect":
        return <Search className={className} />;
      case "think":
        return <BrainCog className={className} />;
      case "read":
        return <FileText className={className} />;
      case "render":
        return <RefreshCw className={className} />;
      case "apply":
      default:
        return <WandSparkles className={className} />;
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#09090b] text-[#f5f2ea]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 gap-4 p-4 pb-0">
          <aside className="flex min-h-0 w-[360px] min-w-[320px] max-w-[360px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#111113]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Website Studio
                  </p>
                  <h1 className="mt-2 text-lg font-semibold text-white">
                    {siteSnapshot?.businessName ?? brief?.businessName ?? "Website"}
                  </h1>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  {statusBadge}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <Sparkles className="h-3.5 w-3.5 text-[#ffd34d]" />
                  {providerLabel.startsWith("template:")
                    ? formatIdLabel(providerLabel.replace("template:", ""))
                    : providerLabel === "v0"
                      ? "Live v0"
                      : "SiroundChat"}
                </span>
                <Link
                  href={`/editor/${siteId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open editor
                </Link>
              </div>
            </div>

            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Business Imagery
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/50">
                    Upload real photos to replace placeholder or stock visuals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => assetInputRef.current?.click()}
                  disabled={assetsUploading}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assetsUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Images className="h-3.5 w-3.5" />
                  )}
                  Upload
                </button>
              </div>

              <input
                ref={assetInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void uploadBusinessPhotos(event.target.files)}
              />

              <button
                type="button"
                onClick={() => assetInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingAssets(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingAssets(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setIsDraggingAssets(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void uploadBusinessPhotos(event.dataTransfer.files);
                }}
                disabled={assetsUploading}
                className={`mt-4 flex min-h-[108px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed px-4 py-5 text-center transition ${
                  isDraggingAssets
                    ? "border-[#ffd34d] bg-[#ffd34d]/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                } ${assetsUploading ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <UploadCloud className="h-5 w-5 text-[#ffd34d]" />
                <span className="mt-3 text-sm font-semibold text-white">
                  {assetsUploading ? "Uploading business photos..." : "Upload or drag restaurant photos"}
                </span>
                <span className="mt-1 text-xs text-white/50">
                  Use your dining room, plating, ambiance, or team photos. Newer uploads take priority.
                </span>
              </button>

              <div className="mt-4">
                {assetsLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                    Loading uploaded photos…
                  </div>
                ) : siteAssets.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {siteAssets.slice(0, 6).map((asset, index) => (
                      <div key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <div className="relative aspect-[4/3]">
                          <Image
                            src={asset.url}
                            alt={`Business photo ${index + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div className="space-y-2 border-t border-white/10 px-2 py-2">
                          <select
                            value={asset.target_slot ?? "auto"}
                            onChange={(event) =>
                              void updateAssetTargetSlot(asset.id, event.target.value as BuilderImageSlot)
                            }
                            disabled={assetSlotSavingId === asset.id}
                            className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white outline-none disabled:opacity-60"
                          >
                            {BUILDER_IMAGE_SLOT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value} className="text-black">
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            {assetSlotSavingId === asset.id
                              ? "Updating"
                              : BUILDER_IMAGE_SLOT_OPTIONS.find(
                                  (option) => option.value === (asset.target_slot ?? "auto")
                                )?.label ?? "Auto"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                    No business photos uploaded yet.
                  </div>
                )}
                {siteAssets.length ? (
                  <p className="mt-3 text-xs leading-5 text-white/45">
                    Hero = first visual, Gallery = atmosphere or interior, About / Story = team or kitchen, Menu / Dishes = plating.
                    Manual slots override stock images.
                  </p>
                ) : null}
              </div>
            </div>

            <div ref={activityScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {activityEntries.length ? null : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                  Website generation activity will appear here.
                </div>
              )}

              {activityEntries.map((entry) => (
                entry.kind === "user" ? (
                  <div key={entry.id} className="space-y-3">
                    {entry.attachments?.length ? (
                      <div className="flex flex-wrap justify-end gap-3">
                        {entry.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="inline-flex max-w-full items-center gap-2 rounded-[14px] border border-white/14 bg-[#1c1c1f] px-3 py-2 text-[15px] text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          >
                            <div className="relative h-6 w-6 overflow-hidden rounded-[7px] border border-white/10 bg-white/[0.04]">
                              {attachment.previewUrl ? (
                                <Image
                                  src={attachment.previewUrl}
                                  alt={attachment.name}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Images className="h-3.5 w-3.5 text-white/45" />
                                </div>
                              )}
                            </div>
                            <span className="max-w-[220px] truncate">{attachment.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {entry.title ? (
                      <p className="max-w-[92%] text-[15px] leading-7 text-white/80">
                        {entry.title}
                      </p>
                    ) : null}
                  </div>
                ) : entry.kind === "assistant" ? (
                  <div key={entry.id} className="relative pl-3">
                    <div className="absolute left-0 top-3 bottom-3 w-px bg-white/10" />
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-[15px] text-white/60">
                        <FileText className="h-5 w-5 text-white/55" />
                        <span>{entry.title}</span>
                      </div>

                      {entry.patch ? (
                        <div className="rounded-[28px] border border-[#0b6cff] bg-[#0d1627] p-[5px] shadow-[0_0_0_1px_rgba(11,108,255,0.12),0_16px_40px_rgba(0,0,0,0.28)]">
                          <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-[#19191d] px-5 py-5">
                            <div className="flex min-w-0 items-center gap-3">
                              <ChevronRight className="h-5 w-5 shrink-0 text-white/65" />
                              <span className="truncate text-[19px] font-medium text-white">
                                {entry.patch.title}
                              </span>
                              <span className="shrink-0 text-[19px] text-white/45">
                                {entry.patch.versionLabel}
                              </span>
                            </div>
                            <div className="ml-4 flex shrink-0 items-center gap-4">
                              <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[18px] font-semibold text-[#58d06f]">
                                {entry.patch.deltaLabel}
                              </span>
                              <Undo2 className="h-5 w-5 text-white/35" />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {entry.traceSteps?.length ? (
                        <div className="space-y-2">
                          {entry.traceSteps.map((step, index) => (
                            <div key={`${entry.id}-${step.label}`} className="relative pl-10">
                              {index < entry.traceSteps!.length - 1 ? (
                                <div className="absolute left-[9px] top-7 h-[22px] w-px bg-white/10" />
                              ) : null}
                              <div className="absolute left-0 top-1 text-white/58">
                                {renderTraceIcon(step)}
                              </div>
                              <div className="text-[15px] leading-7 text-white/68">
                                {step.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {entry.detail ? (
                        <p className="text-[17px] leading-9 text-white/94">{entry.detail}</p>
                      ) : null}

                      {entry.bullets?.length ? (
                        <ol className="space-y-4 pl-7 text-[17px] leading-9 text-white/92">
                          {entry.bullets.map((bullet, index) => (
                            <li key={`${entry.id}-bullet-${index}`} className="pl-2">
                              <span className="font-semibold text-white">{bullet}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}

                      {typeof entry.durationMs === "number" ? (
                        <div className="flex items-center justify-between pt-2 text-[15px] text-white/48">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4.5 w-4.5" />
                            <span>
                              Worked for {formatDurationLabel(entry.durationMs)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4.5 w-4.5" />
                              <span>{formatActivityTimeLabel(entry.createdAt)}</span>
                            </div>
                            <MoreHorizontal className="h-4.5 w-4.5" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : entry.kind === "clarification" ? (
                  <div
                    key={entry.id}
                    className="rounded-[22px] border border-amber-500/30 bg-amber-950/30 px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-1 h-4.5 w-4.5 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{entry.title}</p>
                        {entry.detail ? (
                          <p className="mt-1 text-sm leading-6 text-amber-200/80">{entry.detail}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={entry.id}
                    className="rounded-[22px] border border-[#5d2a2a] bg-[#221416] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-1 h-4.5 w-4.5 text-[#f87171]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{entry.title}</p>
                        {entry.detail ? (
                          <p className="mt-1 text-sm leading-6 text-[#f7c7c7]">{entry.detail}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              ))}

              {liveStatus ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-[#ffd34d]" />
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                        Working
                      </div>
                      <div className="text-[15px] text-white/72">{liveStatus}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 p-4">
              <PromptInputBox
                variant="editor"
                value={composerValue}
                onValueChange={(nextValue) => {
                  setComposerValue(nextValue);
                  if (error) setError(null);
                }}
                thinkEnabled={composerThinkMode}
                onThinkEnabledChange={setComposerThinkMode}
                isLoading={isRunning}
                disabled={!siteSnapshot?.renderDocument}
                placeholder={promptPlaceholder(siteSnapshot?.renderDocument)}
                onSend={async (message, files, options) => {
                  const ok = await runStudioEditRequest({
                    request: message,
                    files,
                    thinkMode: options?.thinkMode ?? false
                  });
                  if (ok) {
                    setComposerValue("");
                  }
                  return ok;
                }}
              />
              {error ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#fca5a5]">
                  <span className="inline-flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </span>
                  {!siteSnapshot?.renderDocument && brief ? (
                    <button
                      type="button"
                      onClick={() => void runInitialGeneration(brief)}
                      disabled={isRunning}
                      className="rounded-full border border-[#5d2a2a] px-3 py-1 text-xs font-semibold text-[#fecaca] transition hover:bg-[#2a1518] disabled:opacity-60"
                    >
                      Retry generation
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#111113]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  Live Preview
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {isRunning ? liveStatus ?? "Updating preview" : "Preview stays primary while you iterate by prompt."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DeviceSwitch value={previewDevice} onChange={setPreviewDevice} />
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => void saveCurrentState()}
                  disabled={!isPreviewReady || saveState === "saving"}
                  className="h-11 rounded-full border-white/10 bg-transparent px-4 text-white hover:bg-white/5"
                >
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
                <PublishButtonWithModal
                  siteId={siteId}
                  siteName={siteSnapshot?.businessName ?? brief?.businessName ?? "Website"}
                  slug={siteSnapshot?.slug ?? null}
                  publishedUrl={siteSnapshot?.publishedUrl ?? null}
                  lastUpdatedLabel={lastUpdatedLabel}
                  hasPreview={isPreviewReady}
                  onBeforePublish={saveCurrentState}
                  onPublished={(url) => {
                    setSiteSnapshot((current) =>
                      current
                        ? {
                            ...current,
                            publishedUrl: url,
                            status: "published",
                            updatedAt: new Date().toISOString()
                          }
                        : current
                    );
                    void refreshSiteSnapshot();
                  }}
                />
                <Link
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open preview
                </Link>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-[#0b0b0d] p-4">
              {!siteSnapshot?.renderDocument ? (
                <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-[#0f0f12]">
                  <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                    {isRunning ? <Loader2 className="h-8 w-8 animate-spin text-[#ffd34d]" /> : <RefreshCw className="h-8 w-8 text-white/35" />}
                    <p className="text-lg font-semibold text-white">
                      {isRunning ? "Generating first pass" : "Preview will appear here"}
                    </p>
                    <p className="text-sm leading-6 text-white/55">
                      {isRunning
                        ? liveStatus ?? "Preparing your website."
                        : "Start from Website Studio to generate the first draft."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {previewLoading ? (
                    <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-[20px] border border-white/10 bg-black/40 backdrop-blur-sm">
                      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#111113] px-4 py-2 text-sm text-white/70">
                        <Loader2 className="h-4 w-4 animate-spin text-[#ffd34d]" />
                        {liveStatus ?? "Loading preview"}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex h-full items-start justify-center overflow-auto px-4 py-6">
                    <div className="w-full">{previewFrame}</div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
