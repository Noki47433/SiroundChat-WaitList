"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GenerationCanvas } from "@/components/generation/GenerationCanvas";
import { GenerationSidebar } from "@/components/generation/GenerationSidebar";
import {
  CONTENT_LANGUAGES,
  CTA_GOALS,
  QUALITY_MODES,
  createEmptyGenerationBrief,
  isGenerationBriefComplete,
  normalizeContentLanguage,
  normalizeGenerationBriefForForm,
  normalizeQualityMode,
  primaryGoalLabel,
  sanitizeGenerationBrief,
  type GenerationBriefData
} from "@/lib/builder/generation-config";
import { TEMPLATE_META } from "@/lib/website-builder/templates/registry";
import { useGenerationStore } from "@/state/generation";
import type { GenerationBrief } from "@/state/generation";

const PROGRESS_STEPS = [
  "Finding the right site apps for you",
  "Planning site structure",
  "Designing layout",
  "Curating content & visuals",
  "Final touches"
];

const STEP_DURATIONS = [1800, 2200, 2000, 2300, 1800];

type GenerationScreenProps = {
  siteId: string;
};

const resolveTemplateId = (templateId?: string | null, industry?: string | null) => {
  const trimmed = (templateId ?? "").trim();
  if (trimmed && TEMPLATE_META.some((template) => template.id === trimmed)) return trimmed;
  const normalized = (industry ?? "").toLowerCase();
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

const normalizeStoredBrief = (value: any, siteId: string): GenerationBrief | null => {
  if (!value || typeof value !== "object") return null;
  const tone = normalizeTextOrNull(value.tone) ?? "professional";
  return {
    siteId,
    businessId: String(value.businessId ?? value.business_id ?? ""),
    businessName: normalizeTextOrNull(value.businessName ?? value.business_name) ?? "",
    industry: normalizeTextOrNull(value.industry) ?? "Service",
    contentLanguage: normalizeContentLanguage(value.contentLanguage ?? value.language ?? value.content_language),
    qualityMode: normalizeQualityMode(value.qualityMode),
    generationBrief: normalizeGenerationBriefForForm(
      value.generationBrief ?? value.brief ?? value.generation_brief,
      tone
    ),
    tone,
    pagesMode: normalizeTextOrNull(value.pagesMode ?? value.pages_mode) ?? "one",
    templateId: normalizeTextOrNull(value.templateId ?? value.template_id) ?? undefined,
    primaryColor: normalizeTextOrNull(value.primaryColor ?? value.primary_color) ?? "#111827",
    secondaryColor: normalizeTextOrNull(value.secondaryColor ?? value.secondary_color) ?? "#F3F4F6",
    fontFamily:
      normalizeTextOrNull(value.fontFamily ?? value.font_family) ??
      "Sora, Inter, system-ui, sans-serif",
    logoUrl: normalizeTextOrNull(value.logoUrl ?? value.logo_url),
    description: normalizeTextOrNull(value.description) ?? "",
    contact: {
      email: normalizeEmailOrNull(value.contact?.email ?? value.contact_email),
      phone: normalizeTextOrNull(value.contact?.phone ?? value.contact_phone),
      address: normalizeTextOrNull(value.contact?.address ?? value.contact_address)
    },
    openingHours: normalizeTextOrNull(value.openingHours ?? value.opening_hours),
    socials: normalizeSocials(value.socials),
    features: {
      ...normalizeFeatures(value.features),
      includeReservation: Boolean(
        value.features?.includeReservation ?? value.include_reservation
      )
    },
    hasOwnPhotos: Boolean(value.hasOwnPhotos ?? value.has_own_photos),
    chatbotEmbedSnippet: normalizeTextOrNull(
      value.chatbotEmbedSnippet ?? value.chatbot_embed_snippet
    )
  };
};

export function GenerationScreen({ siteId }: GenerationScreenProps) {
  const router = useRouter();
  const {
    brief,
    status,
    progressStepIndex,
    progressStatus,
    error,
    canceled,
    setBrief,
    setStatus,
    setError,
    setProgressStep,
    setProgressStatus,
    setCanceled,
    resetProgress
  } = useGenerationStore();
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState(brief);
  const controllerRef = useRef<AbortController | null>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartRef = useRef<number>(0);

  const stepLabel = PROGRESS_STEPS[Math.min(progressStepIndex, PROGRESS_STEPS.length - 1)];
  const resolvedTemplateId = resolveTemplateId(brief?.templateId, brief?.industry);
  const templateMeta = TEMPLATE_META.find((template) => template.id === resolvedTemplateId);
  const personalLine =
    brief?.businessName && brief?.tone
      ? `${brief.businessName}'s website wants to be ${brief.tone}.`
      : null;
  const showPersonalLine =
    stepLabel.toLowerCase().includes("final") ? personalLine : null;
  const templateLine = templateMeta ? `Building a ${templateMeta.name} experience` : null;

  const statusLabel = useMemo(() => {
    if (status === "error") return "Generation failed";
    if (status === "done") return "Site generated";
    if (status === "generating") return "Working on your site";
    return "Waiting to start";
  }, [status]);
  const progressPercent = Math.round(((progressStepIndex + 1) / PROGRESS_STEPS.length) * 100);

  const loadBrief = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(`sc_generation_brief:${siteId}`);
      if (!stored) return null;
      return normalizeStoredBrief(JSON.parse(stored), siteId);
    } catch {
      return null;
    }
  }, [siteId]);

  const isValidUuid = (value?: string | null) =>
    Boolean(
      value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        )
    );

  const loadBriefFromSite = useCallback(async (): Promise<GenerationBrief | null> => {
    try {
      if (!isValidUuid(siteId)) return null;
      const response = await fetch(`/api/builder/site?siteId=${siteId}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.id || !data?.business_id) return null;
      const normalized = normalizeStoredBrief(
        {
          ...data,
          templateId: resolveTemplateId(data.template_id, data.industry),
          contentLanguage: data.content_language,
          generationBrief: data.generation_brief
        },
        siteId
      );
      return normalized;
    } catch {
      return null;
    }
  }, [siteId]);

  const startFakeProgress = useCallback((fastForward = false, startIndex = 0) => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
    }
    const advance = (index: number) => {
      if (index >= PROGRESS_STEPS.length) {
        setProgressStatus("completed");
        return;
      }
      setProgressStep(index);
      stepStartRef.current = Date.now();
      const delay = fastForward ? 300 : STEP_DURATIONS[index] ?? 2000;
      stepTimerRef.current = setTimeout(() => advance(index + 1), delay);
    };
    advance(startIndex);
  }, [setProgressStatus, setProgressStep]);

  const runGeneration = useCallback(async (payload: any) => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    setStatus("generating");
    setError(null);
    setCanceled(false);
    resetProgress();
    startFakeProgress(false, 0);

    const businessName = normalizeTextOrNull(payload?.businessName) ?? "Business";
    const industry = normalizeTextOrNull(payload?.industry) ?? "Service";
    const description =
      normalizeTextOrNull(payload?.description) ?? `${businessName} ${industry} website`;
    const resolvedTemplateId = resolveTemplateId(payload?.templateId, industry);
    const tone = normalizeTextOrNull(payload?.tone) ?? "professional";
    const generationBrief = sanitizeGenerationBrief(
      payload?.generationBrief ?? payload?.brief,
      tone
    );
    if (!isGenerationBriefComplete(generationBrief)) {
      throw new Error("Complete the generation brief before starting generation.");
    }

    const contactRaw = payload?.contact && typeof payload.contact === "object" ? payload.contact : {};
    const contact = {
      email: normalizeEmailOrNull((contactRaw as Record<string, unknown>).email),
      phone: normalizeTextOrNull((contactRaw as Record<string, unknown>).phone),
      address: normalizeTextOrNull((contactRaw as Record<string, unknown>).address)
    };

    const normalizedPayload = {
      siteId,
      businessId: payload?.businessId,
      businessName,
      industry,
      description,
      tone,
      language: normalizeContentLanguage(payload?.contentLanguage ?? payload?.language),
      qualityMode: normalizeQualityMode(payload?.qualityMode),
      brief: generationBrief,
      pagesMode: payload?.pagesMode === "multi" ? "multi" : "one",
      templateId: resolvedTemplateId,
      primaryColor: isHexColor(payload?.primaryColor) ? payload.primaryColor : "#111827",
      secondaryColor: isHexColor(payload?.secondaryColor) ? payload.secondaryColor : "#F3F4F6",
      fontFamily: normalizeTextOrNull(payload?.fontFamily) ?? "Sora, Inter, system-ui, sans-serif",
      logoUrl: normalizeTextOrNull(payload?.logoUrl),
      openingHours: normalizeTextOrNull(payload?.openingHours),
      contact,
      socials: normalizeSocials(payload?.socials),
      targetCustomer: generationBrief.audience,
      services: generationBrief.topServices,
      proofAssets: generationBrief.proofPoints,
      features: normalizeFeatures(payload?.features),
      hasOwnPhotos: Boolean(payload?.hasOwnPhotos),
      chatbotEmbedSnippet: normalizeTextOrNull(payload?.chatbotEmbedSnippet)
    };

    if (!isValidUuid(normalizedPayload.businessId)) {
      throw new Error("Missing business context for generation. Please refresh and try again.");
    }

    window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(normalizedPayload));

    try {
      const response = await fetch("/api/builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
        signal: controllerRef.current.signal
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error || "Generate failed";
        throw new Error(message);
      }
      setStatus("done");
      startFakeProgress(true, Math.max(progressStepIndex, 0));
      setTimeout(() => {
        router.replace(`/editor/${siteId}`);
      }, 800);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return;
      }
      setStatus("error");
      setError(err?.message ?? "We couldn’t generate your site. Please try again.");
    }
  }, [
    progressStepIndex,
    resetProgress,
    router,
    setCanceled,
    setError,
    setStatus,
    siteId,
    startFakeProgress
  ]);

  useEffect(() => {
    if (brief) return;
    const stored = loadBrief();
    if (stored) {
      setBrief(stored);
      setDraft(stored);
    }
    loadBriefFromSite()
      .then((fallback) => {
        if (!fallback) return;
        const merged = stored
          ? {
              ...fallback,
              ...stored,
              generationBrief: stored.generationBrief ?? fallback.generationBrief,
              contentLanguage: stored.contentLanguage ?? fallback.contentLanguage,
              qualityMode: stored.qualityMode ?? fallback.qualityMode
            }
          : fallback;
        setBrief(merged);
        setDraft(merged);
        window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(merged));
      })
      .catch(() => null);
  }, [brief, loadBrief, loadBriefFromSite, setBrief, siteId]);

  useEffect(() => {
    if (!brief || status !== "idle") return;
    runGeneration(brief);
  }, [brief, runGeneration, status]);

  useEffect(() => {
    const previous = window.onbeforeunload;
    window.onbeforeunload = null;
    return () => {
      window.onbeforeunload = previous ?? null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const handleCancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
    }
    setStatus("idle");
    setCanceled(true);
    setProgressStatus("completed");
    router.replace("/dashboard/builder/new");
  }, [router, setCanceled, setProgressStatus, setStatus]);

  const handleRetry = () => {
    if (!brief) return;
    runGeneration(brief);
  };

  const handleSaveBrief = () => {
    if (!draft) return;
    const normalizedDraft = {
      ...draft,
      contentLanguage: normalizeContentLanguage(draft.contentLanguage),
      qualityMode: normalizeQualityMode(draft.qualityMode),
      generationBrief: sanitizeGenerationBrief(draft.generationBrief, draft.tone ?? "professional")
    };
    setBrief(normalizedDraft);
    setDraft(normalizedDraft);
    window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(normalizedDraft));
    setShowEdit(false);
  };

  return (
    <div className="flex min-h-screen w-full items-stretch overflow-hidden bg-[#f7f4f1] text-neutral-900">
      <div className="flex w-full gap-6 px-10 py-10">
        <GenerationSidebar brief={brief} onEditBrief={() => setShowEdit(true)} />
        <GenerationCanvas
          stepLabel={stepLabel}
          statusLabel={statusLabel}
          error={status === "error" ? error : null}
          onRetry={handleRetry}
          personalLine={showPersonalLine}
          templateLine={templateLine}
          progress={progressPercent}
        />
      </div>

      <div className="fixed bottom-8 left-10 flex items-center gap-4 text-xs text-neutral-500">
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="rounded-full border border-[#e5e1d8] px-4 py-2 text-xs font-semibold text-neutral-700"
        >
          Edit site brief
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-neutral-400"
        >
          Cancel generation
        </button>
        {(status === "error" || canceled) ? (
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Regenerate site
          </button>
        ) : null}
      </div>

      {showEdit ? (
        <div className="fixed inset-0 z-20 bg-black/20">
          <div className="absolute right-0 top-0 h-full w-[360px] bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Edit site brief</h2>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="text-xs font-semibold text-neutral-500"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4 text-xs text-neutral-700">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Business name</span>
                <input
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.businessName ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...(prev ?? ({} as any)), businessName: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Industry</span>
                <input
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.industry ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...(prev ?? ({} as any)), industry: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Tone</span>
                <select
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.tone ?? "professional"}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      tone: event.target.value,
                      generationBrief: {
                        ...(prev?.generationBrief ?? createEmptyGenerationBrief(event.target.value)),
                        tone: event.target.value
                      }
                    }))
                  }
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="modern">Modern</option>
                  <option value="bold">Bold</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Content language</span>
                <select
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.contentLanguage ?? "en"}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      contentLanguage: normalizeContentLanguage(event.target.value)
                    }))
                  }
                >
                  {CONTENT_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Quality mode</span>
                <select
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.qualityMode ?? "balanced"}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      qualityMode: normalizeQualityMode(event.target.value)
                    }))
                  }
                >
                  {QUALITY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Audience</span>
                <input
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.generationBrief?.audience ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      generationBrief: {
                        ...(prev?.generationBrief ?? createEmptyGenerationBrief(prev?.tone ?? "professional")),
                        audience: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Core offer</span>
                <input
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.generationBrief?.coreOffer ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      generationBrief: {
                        ...(prev?.generationBrief ?? createEmptyGenerationBrief(prev?.tone ?? "professional")),
                        coreOffer: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Primary CTA goal</span>
                <select
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.generationBrief?.primaryCtaGoal ?? "contact"}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...(prev ?? ({} as any)),
                      generationBrief: {
                        ...(prev?.generationBrief ?? createEmptyGenerationBrief(prev?.tone ?? "professional")),
                        primaryCtaGoal: event.target.value as GenerationBriefData["primaryCtaGoal"]
                      }
                    }))
                  }
                >
                  {CTA_GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {primaryGoalLabel(goal)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Top services</span>
                {[0, 1, 2].map((index) => (
                  <input
                    key={`service-${index}`}
                    className="h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                    value={draft?.generationBrief?.topServices?.[index] ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const current = prev?.generationBrief ?? createEmptyGenerationBrief(prev?.tone ?? "professional");
                        const topServices = [...current.topServices];
                        topServices[index] = event.target.value;
                        return {
                          ...(prev ?? ({} as any)),
                          generationBrief: {
                            ...current,
                            topServices
                          }
                        };
                      })
                    }
                    placeholder={`Top service ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveBrief}
                  className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Save brief
                </button>
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-full border border-[#e5e1d8] px-4 py-2 text-xs font-semibold text-neutral-600"
                >
                  Cancel
                </button>
              </div>
              {status === "error" ? (
                <div className="rounded-xl border border-[#e5e1d8] bg-[#faf9f6] p-3 text-xs text-neutral-500">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
