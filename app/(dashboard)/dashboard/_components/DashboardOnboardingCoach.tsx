"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import {
  CHECKLIST_TASKS,
  DASHBOARD_ONBOARDING_EVENT,
  checklistCompletedCount,
  hydrateDashboardOnboardingState,
  isChecklistDone,
  markChecklistTaskComplete,
  markTutorialSectionSeen,
  readDashboardOnboardingState,
  setDashboardOnboardingScope,
  setDashboardOnboardingHidden,
  type DashboardOnboardingState
} from "@/app/(dashboard)/dashboard/_components/onboarding/state";
import { resolveTutorialGuide } from "@/app/(dashboard)/dashboard/_components/onboarding/config";

const HIGHLIGHT_CLASS = "dashboard-tutorial-highlight";

const computeTarget = (primary: string, fallback?: string) => {
  const target = document.querySelector<HTMLElement>(primary);
  if (target) return target;
  if (!fallback) return null;
  return document.querySelector<HTMLElement>(fallback);
};

type DashboardOnboardingCoachProps = {
  userId?: string | null;
  businessId?: string | null;
};

export function DashboardOnboardingCoach({ userId, businessId }: DashboardOnboardingCoachProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<DashboardOnboardingState>(() => ({
    version: 4,
    hidden: false,
    completed: {
      create_chatbot: false,
      create_website: false,
      train_documents: false
    },
    sectionSeen: {}
  }));
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [highlightTick, setHighlightTick] = useState(0);

  const guide = useMemo(() => resolveTutorialGuide(pathname), [pathname]);
  const completedCount = checklistCompletedCount(state);
  const totalTasks = CHECKLIST_TASKS.length;
  const progress = totalTasks ? Math.round((completedCount / totalTasks) * 100) : 0;
  const done = isChecklistDone(state);
  const remaining = Math.max(totalTasks - completedCount, 0);
  const inlineChecklist = pathname === "/dashboard" && !done;
  const guideCompleted = guide?.checklistTaskId ? Boolean(state.completed[guide.checklistTaskId]) : false;
  const guideSeen = guide ? Boolean(state.sectionSeen[guide.route]) : false;
  const shouldShowGuide = Boolean(guide && !guideDismissed && !guideCompleted && !guideSeen);
  const activeGuide = shouldShowGuide ? guide : null;

  useEffect(() => {
    let active = true;
    setDashboardOnboardingScope({ userId, businessId });
    setState(readDashboardOnboardingState());

    hydrateDashboardOnboardingState()
      .then((next) => {
        if (!active) return;
        setState(next);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setState(readDashboardOnboardingState());
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, [businessId, userId]);

  useEffect(() => {
    if (!ready) return;
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<DashboardOnboardingState>).detail;
      if (detail && detail.version === 4) {
        setState(detail);
        return;
      }
      setState(readDashboardOnboardingState());
    };

    window.addEventListener(DASHBOARD_ONBOARDING_EVENT, onUpdated as EventListener);
    return () => window.removeEventListener(DASHBOARD_ONBOARDING_EVENT, onUpdated as EventListener);
  }, [ready]);

  useEffect(() => {
    if (!ready || !pathname) return;
    setGuideDismissed(false);
    setGuideStep(0);

    if (pathname === "/dashboard" && !done && !state.hidden) {
      setChecklistOpen(true);
    }
  }, [done, pathname, ready, state.hidden]);

  useEffect(() => {
    if (!ready || !guide || !shouldShowGuide) return;
    const step = guide.steps[guideStep] ?? guide.steps[0];
    if (!step) return;
    const target = computeTarget(step.selector, step.fallbackSelector);
    if (!target) return;
    target.classList.add(HIGHLIGHT_CLASS);
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    return () => {
      target.classList.remove(HIGHLIGHT_CLASS);
    };
  }, [guide, guideStep, highlightTick, ready, shouldShowGuide]);

  useEffect(() => {
    if (!guide || !guide.checklistTaskId) return;
    if (!state.completed[guide.checklistTaskId]) return;
    if (state.sectionSeen[guide.route]) return;
    markTutorialSectionSeen(guide.route);
    setGuideDismissed(true);
  }, [guide, state]);

  useEffect(() => {
    if (!shouldShowGuide || !guide) return;
    const step = guide.steps[guideStep] ?? guide.steps[0];
    if (!step) return;
    const target = computeTarget(step.selector, step.fallbackSelector);
    if (!target) return;

    const closeGuide = () => {
      markTutorialSectionSeen(guide.route);
      setGuideDismissed(true);
    };

    const isInputLike =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (isInputLike) {
      target.addEventListener("input", closeGuide, { once: true });
      target.addEventListener("change", closeGuide, { once: true });
      return () => {
        target.removeEventListener("input", closeGuide);
        target.removeEventListener("change", closeGuide);
      };
    }

    target.addEventListener("click", closeGuide, { once: true });
    return () => target.removeEventListener("click", closeGuide);
  }, [guide, guideStep, shouldShowGuide]);

  if (!ready) return null;

  const closeChecklist = () => {
    setChecklistOpen(false);
    markTutorialSectionSeen("/dashboard");
    const next = setDashboardOnboardingHidden(true);
    setState(next);
  };

  const openChecklist = () => {
    setChecklistOpen(true);
    const next = setDashboardOnboardingHidden(false);
    setState(next);
  };

  const completeGuideTask = () => {
    if (!guide?.checklistTaskId) return;
    const next = markChecklistTaskComplete(guide.checklistTaskId, true);
    setState(next);
    markTutorialSectionSeen(guide.route);
    setGuideDismissed(true);
  };

  const currentStep = activeGuide?.steps[guideStep] ?? null;
  const guideTaskComplete = activeGuide?.checklistTaskId
    ? state.completed[activeGuide.checklistTaskId]
    : false;

  return (
    <div className="space-y-4">
      {inlineChecklist ? (
        <Card data-onboarding-checklist className="overflow-hidden border-emerald-300/20 bg-white/10 p-0">
          <div className="border-b border-white/10 bg-gradient-to-r from-emerald-400/15 via-teal-300/5 to-transparent px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">Hey, Let&apos;s Start Now!</p>
                <p className="text-sm text-white/70">
                  Complete these setup tasks before diving into the full overview.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={closeChecklist}
                aria-label="Close onboarding checklist"
              >
                x
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="text-lg">🚀</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-semibold text-white/80">{progress}%</span>
            </div>

            <div className="space-y-2">
              {CHECKLIST_TASKS.map((task, index) => {
                const completed = state.completed[task.id];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setChecklistOpen(false);
                      router.push(task.href);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                      completed
                        ? "border-emerald-400/30 bg-emerald-500/10 text-white"
                        : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                          completed ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-white/25 text-white/70"
                        )}
                      >
                        {completed ? "✓" : index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{task.label}</p>
                        <p className="mt-0.5 text-xs text-white/60">{task.description}</p>
                      </div>
                    </div>
                    <span className="text-sm text-white/60">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      {checklistOpen && !inlineChecklist ? (
        <div className="fixed bottom-6 right-6 z-40 w-[min(360px,calc(100vw-2rem))]">
          <Card className="border-emerald-300/20 bg-neutral-950/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-white">Onboarding checklist</p>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                  onClick={closeChecklist}
                  aria-label="Close onboarding checklist"
                >
                  x
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-white/70">{progress}%</span>
              </div>
            </div>

            <div className="space-y-2 p-4">
              {CHECKLIST_TASKS.map((task, index) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setChecklistOpen(false);
                    router.push(task.href);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                    state.completed[task.id]
                      ? "border-emerald-400/30 bg-emerald-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                  )}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px]">
                    {state.completed[task.id] ? "✓" : index + 1}
                  </span>
                  <span className="text-sm">{task.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {!checklistOpen && !done ? (
        <button
          type="button"
          onClick={openChecklist}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-3 rounded-full border border-white/20 bg-neutral-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(0,0,0,0.35)] transition hover:bg-neutral-900"
        >
          <span>Let&apos;s Start</span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-400/20 px-2 text-xs text-emerald-100">
            {remaining}
          </span>
        </button>
      ) : null}

      {activeGuide ? (
        <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 to-transparent p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Tutorial</p>
              <h3 className="text-lg font-semibold text-white">{activeGuide.title}</h3>
              <p className="text-sm text-white/75">{activeGuide.summary}</p>
              <p className="text-sm font-medium text-cyan-100">{activeGuide.challenge}</p>
            </div>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                markTutorialSectionSeen(activeGuide.route);
                setGuideDismissed(true);
              }}
              aria-label="Close section tutorial"
            >
              x
            </button>
          </div>

          {currentStep ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                Step {guideStep + 1} of {activeGuide.steps.length}
              </p>
              <p className="text-sm text-white/85">{currentStep.instruction}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setHighlightTick((value) => value + 1)}>
                  Highlight step
                </Button>
                {activeGuide.checklistTaskId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={completeGuideTask}
                    disabled={guideTaskComplete}
                  >
                    {guideTaskComplete ? "Task completed" : "Mark task done"}
                  </Button>
                ) : null}
                {activeGuide.steps.length > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGuideStep((value) => (value + 1 >= activeGuide.steps.length ? 0 : value + 1))
                    }
                  >
                    Next step
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
