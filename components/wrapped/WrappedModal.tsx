"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeWrapped, type Period, type WrappedComputed, type WrappedRaw } from "@/lib/wrapped/computeWrapped";
import { WrappedControls } from "@/components/wrapped/WrappedControls";
import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { weeklySlides } from "@/components/wrapped/slides/WeeklySlides";
import { monthlySlides } from "@/components/wrapped/slides/MonthlySlides";
import type { SlideConfig } from "@/components/wrapped/slides/types";
import type { WrappedPostAction } from "@/components/wrapped/types";
import { useShareExport } from "@/components/wrapped/share/useShareExport";
import { cn } from "@/lib/utils/cn";

const comparisonLines = [
  "That’s basically one espresso ☕ worth of time.",
  "That’s a quick walk around the block.",
  "That’s the length of your favorite chorus.",
  "That’s enough time for a reset and a stretch."
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getComparisonLine = (businessId: string) => {
  const index = hashString(businessId) % comparisonLines.length;
  return comparisonLines[index] ?? comparisonLines[0];
};

const isLockedSlide = (slideKey: string, model: WrappedComputed, demoMode: boolean) => {
  if (demoMode) return false;
  switch (slideKey) {
    case "money":
    case "revenue":
      return model.revenueCents === null;
    case "leads-reservations":
      return model.leads === null && model.reservations === null;
    case "time-saved":
      return model.timeSavedMinutes === null;
    case "customers-helped":
      return model.customersHelped === null;
    case "mvp-chat":
      return !model.mvpConversation;
    case "peak-day":
      return !model.unlocks.peakDayUnlocked || !model.peakDayISO;
    case "top-question":
      return !model.unlocks.topQuestionUnlocked || !model.topQuestion;
    default:
      return false;
  }
};

const resolvePrimaryLabel = (slide: SlideConfig, model: WrappedComputed | null, demoMode: boolean) => {
  if (!model) return slide.primaryCtaLabel ?? "";
  return isLockedSlide(slide.key, model, demoMode) ? "How to unlock →" : slide.primaryCtaLabel ?? "";
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return reduced;
};

export function WrappedModal({
  open,
  mode,
  businessId,
  onClose
}: {
  open: boolean;
  mode: Period;
  businessId: string;
  onClose: (postAction?: WrappedPostAction) => void;
}) {
  const [raw, setRaw] = useState<WrappedRaw | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShareMode, setIsShareMode] = useState(false);
  const [postAction, setPostAction] = useState<WrappedPostAction | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const slides = mode === "weekly" ? weeklySlides : monthlySlides;
  const totalSlides = slides.length;
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = !prefersReducedMotion && !isShareMode;
  const comparisonLine = useMemo(() => getComparisonLine(businessId), [businessId]);

  const model = useMemo(() => (raw ? computeWrapped(raw, { forceUnlocked: isDemo }) : null), [raw, isDemo]);
  const { exporting, exportToPng, copyToClipboard } = useShareExport({ scale: 2 });

  const handleClose = useCallback(() => {
    const action = postAction ?? undefined;
    setIsShareMode(false);
    setPostAction(null);
    setCurrentIndex(0);
    onClose(action);
  }, [onClose, postAction]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleShareMode = useCallback((value: boolean) => {
    setIsShareMode(value);
  }, []);

  const buildCtaContext = useCallback(
    () => ({
      goNext,
      setPostAction,
      toggleShareMode,
      close: handleClose,
      model: model as WrappedComputed,
      mode
    }),
    [goNext, handleClose, model, mode, toggleShareMode]
  );

  const handlePrimaryCta = useCallback(
    (targetSlide: SlideConfig) => {
      if (!model) return;
      if (isLockedSlide(targetSlide.key, model, isDemo)) {
        setPostAction({ type: "impact-details" });
        goNext();
        return;
      }
      targetSlide.onPrimaryCta?.(buildCtaContext());
    },
    [buildCtaContext, goNext, isDemo, model]
  );

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setIsShareMode(false);
    setPostAction(null);
    setIsDemo(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const fetchWrapped = async () => {
      setLoading(true);
      setError(null);
      try {
        const demoParam = new URLSearchParams(window.location.search).get("demo") === "1";
        const demoQuery = demoParam ? "&demo=1" : "";
        const res = await fetch(`/api/impact-wrapped?businessId=${businessId}&period=${mode}${demoQuery}`, {
          signal: controller.signal
        });
        const payload = await res.json();
        if (!res.ok || !payload?.data) {
          throw new Error(payload?.error || "Failed to load wrapped data");
        }
        setRaw(payload.data as WrappedRaw);
        setIsDemo(Boolean(payload?.demo));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load wrapped data");
      } finally {
        setLoading(false);
      }
    };

    fetchWrapped();
    return () => controller.abort();
  }, [open, businessId, mode]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (!isShareMode && !isTypingTarget(event.target)) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          goNext();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goPrev();
        }
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
          ) ?? []
        ).filter((el) => !el.hasAttribute("disabled"));

        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const isShift = event.shiftKey;

        if (!isShift && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        if (isShift && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose, goNext, goPrev, isShareMode]);

  if (!open) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-10 backdrop-blur-[12px]">
        <div
          className="h-[min(600px,80vh)] w-[min(960px,96vw)]"
          style={{
            "--accent": "#FFD54A",
            "--glow": "#56FCA2"
          } as CSSProperties}
        >
          <WrappedSlideFrame isShareMode={false}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Impact wrapped</p>
            <p className="text-[32px] font-bold">Couldn’t load wrapped</p>
            <p className="text-sm text-white/60">{error}</p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15"
            >
              Close
            </button>
          </WrappedSlideFrame>
        </div>
      </div>
    );
  }

  if (loading || !model) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-10 backdrop-blur-[12px]">
        <div
          className="h-[min(600px,80vh)] w-[min(960px,96vw)]"
          style={{
            "--accent": "#FFD54A",
            "--glow": "#56FCA2"
          } as CSSProperties}
        >
          <WrappedSlideFrame isShareMode={false}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Preparing your wrapped</p>
            <p className="text-[40px] font-bold">Wrapping your impact…</p>
            <p className="text-sm text-white/60">This takes a second.</p>
          </WrappedSlideFrame>
        </div>
      </div>
    );
  }

  const slide = slides[currentIndex] ?? slides[0];
  const primaryLabel = resolvePrimaryLabel(slide, model, isDemo);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-10 backdrop-blur-[12px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex flex-col items-center">
        <div
          ref={cardRef}
          className={cn(
            "relative h-[min(600px,80vh)] w-[min(960px,96vw)] overflow-hidden rounded-[24px] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.45),_0_35px_120px_rgba(0,0,0,0.6)]",
            isShareMode ? "wrapped-share-freeze" : ""
          )}
          style={{
            "--accent": "#FFD54A",
            "--glow": "#56FCA2"
          } as CSSProperties}
        >
          <div
            className="flex h-full w-full"
            style={{
              transform: `translate3d(-${currentIndex * 100}%, 0, 0)`,
              transition: shouldAnimate ? "transform 320ms ease-out" : "none"
            }}
          >
            {slides.map((item, index) => {
              const Component = item.Component;
              const visualAnimate = shouldAnimate && index === currentIndex;
              return (
                <div key={item.key} className="h-full w-full shrink-0">
                  <Component
                    model={model}
                    mode={mode}
                    isShareMode={isShareMode}
                    isActive={index === currentIndex}
                    isDemo={isDemo}
                    visualAnimate={visualAnimate}
                    onPrimaryCTA={() => handlePrimaryCta(item)}
                    onShare={() => setIsShareMode(true)}
                    onSecondaryCTA={() => setPostAction({ type: "analytics" })}
                    onDone={handleClose}
                    comparisonLine={comparisonLine}
                  />
                </div>
              );
            })}
          </div>

          {isDemo && !isShareMode ? (
            <div className="absolute left-6 top-5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">
              Demo data
            </div>
          ) : null}

          {!isShareMode ? (
            <WrappedControls
              currentIndex={currentIndex}
              totalSlides={totalSlides}
              onPrev={goPrev}
              onNext={goNext}
              onClose={handleClose}
              onSelect={setCurrentIndex}
              disabled={false}
              closeButtonRef={closeButtonRef}
            />
          ) : null}

          {!isShareMode ? (
            <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
              <span className="text-xs text-white/50">{model.lastUpdatedLabel}</span>
              {primaryLabel ? (
                <button
                  type="button"
                  onClick={() => handlePrimaryCta(slide)}
                  className="rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--glow)] px-5 py-2 text-sm font-semibold text-neutral-950 shadow-[0_10px_20px_rgba(255,213,74,0.2)] transition hover:brightness-105 active:scale-[0.98]"
                >
                  {primaryLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isShareMode ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => exportToPng(cardRef.current)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/15"
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(cardRef.current)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/15"
              disabled={exporting}
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={() => setIsShareMode(false)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
            >
              Exit share mode
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
