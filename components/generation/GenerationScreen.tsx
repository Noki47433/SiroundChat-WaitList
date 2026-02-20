"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GenerationCanvas } from "@/components/generation/GenerationCanvas";
import { GenerationSidebar } from "@/components/generation/GenerationSidebar";
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
      return JSON.parse(stored);
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
      const resolvedTemplateId = resolveTemplateId(data.template_id, data.industry);
      return {
        siteId,
        businessId: data.business_id,
        businessName: data.business_name ?? "",
        industry: data.industry ?? "Service",
        description: data.description ?? "",
        tone: data.tone ?? "friendly",
        pagesMode: data.pages_mode ?? "one",
        templateId: resolvedTemplateId,
        primaryColor: data.primary_color ?? "#111827",
        secondaryColor: data.secondary_color ?? "#F3F4F6",
        fontFamily: data.font_family ?? "Sora, Inter, system-ui, sans-serif",
        logoUrl: data.logo_url ?? null,
        contact: {
          email: data.contact_email ?? null,
          phone: data.contact_phone ?? null,
          address: data.contact_address ?? null
        },
        openingHours: data.opening_hours ?? null,
        socials: data.socials ?? {},
        features: {
          includeServices: data.include_services ?? true,
          includeTestimonials: data.include_testimonials ?? false,
          includePricing: data.include_pricing ?? false,
          includeFaq: data.include_faq ?? false,
          includeContact: data.include_contact ?? true,
          includeReservation: data.include_reservation ?? false,
          includeGallery: data.include_gallery ?? false
        },
        hasOwnPhotos: Boolean(data.has_own_photos)
      };
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

    const resolvedTemplateId = resolveTemplateId(payload?.templateId, payload?.industry);
    const normalizedPayload = {
      tone: payload?.tone ?? "professional",
      pagesMode: payload?.pagesMode ?? "one",
      templateId: resolvedTemplateId,
      primaryColor: payload?.primaryColor ?? "#111827",
      secondaryColor: payload?.secondaryColor ?? "#F3F4F6",
      fontFamily: payload?.fontFamily ?? "Sora, Inter, system-ui, sans-serif",
      contact: payload?.contact ?? {
        email: null,
        phone: null,
        address: null
      },
      socials: payload?.socials ?? {},
      features: payload?.features ?? {},
      ...payload
    };

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
        const message = data?.error ?? "Generate failed";
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
              ...stored,
              ...fallback,
              goal: stored.goal ?? fallback.goal,
              pages: stored.pages ?? fallback.pages
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
    setBrief(draft);
    window.localStorage.setItem(`sc_generation_brief:${siteId}`, JSON.stringify(draft));
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
                    setDraft((prev) => ({ ...(prev ?? ({} as any)), tone: event.target.value }))
                  }
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="modern">Modern</option>
                  <option value="bold">Bold</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Primary goal</span>
                <input
                  className="mt-2 h-9 w-full rounded-xl border border-[#e5e1d8] px-3 text-sm"
                  value={draft?.goal ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...(prev ?? ({} as any)), goal: event.target.value }))
                  }
                />
              </label>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Pages</span>
                <div className="mt-2 grid gap-2 text-xs text-neutral-700">
                  {["Home", "About", "Services", "Contact"].map((page) => {
                    const pages = draft?.pages ?? [];
                    const checked = pages.includes(page);
                    return (
                      <label key={page} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...pages, page]
                              : pages.filter((item) => item !== page);
                            setDraft((prev) => ({ ...(prev ?? ({} as any)), pages: next }));
                          }}
                        />
                        {page}
                      </label>
                    );
                  })}
                </div>
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
