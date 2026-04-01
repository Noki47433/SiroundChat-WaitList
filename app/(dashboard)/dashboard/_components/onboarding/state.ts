"use client";

import {
  CHECKLIST_TASKS,
  checklistCompletedCount,
  defaultDashboardOnboardingState,
  isChecklistDone,
  normalizeDashboardOnboardingState,
  type ChecklistTask,
  type ChecklistTaskId,
  type DashboardOnboardingScope,
  type DashboardOnboardingState
} from "@/lib/dashboard/onboarding";

export { CHECKLIST_TASKS, checklistCompletedCount, isChecklistDone };
export type { ChecklistTask, ChecklistTaskId, DashboardOnboardingScope, DashboardOnboardingState };

export const DASHBOARD_ONBOARDING_EVENT = "siround-dashboard-onboarding-updated";

const canUseBrowser = () => typeof window !== "undefined";
const defaultState = () => defaultDashboardOnboardingState();
const currentScopeKey = (scope: DashboardOnboardingScope) =>
  `${scope.userId?.trim() || "anonymous"}:${scope.businessId?.trim() || "no-business"}`;

let currentScope: DashboardOnboardingScope = {};
let cachedState: DashboardOnboardingState = defaultState();
let hydratedScopeKey: string | null = null;
let hydratePromise: Promise<DashboardOnboardingState> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

const dispatchState = (next: DashboardOnboardingState) => {
  cachedState = next;
  if (!canUseBrowser()) return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_EVENT, { detail: next }));
};

const patchDashboardOnboardingState = async (next: DashboardOnboardingState) => {
  const businessId = currentScope.businessId?.trim();
  if (!businessId || !canUseBrowser()) return;

  const response = await fetch("/api/dashboard/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: next })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error((payload as { error?: string } | null)?.error ?? "Failed to save onboarding state");
  }

  const payload = (await response.json().catch(() => null)) as { state?: unknown } | null;
  if (payload?.state) {
    dispatchState(normalizeDashboardOnboardingState(payload.state));
  }
};

const enqueuePersist = (next: DashboardOnboardingState) => {
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await patchDashboardOnboardingState(next);
      } catch (error) {
        console.error("[DASHBOARD_ONBOARDING_PERSIST_ERROR]", error);
      }
    });
};

export const setDashboardOnboardingScope = (scope: DashboardOnboardingScope) => {
  currentScope = scope;
  const nextScopeKey = currentScopeKey(scope);

  if (hydratedScopeKey !== nextScopeKey) {
    hydratedScopeKey = null;
    hydratePromise = null;
    dispatchState(defaultState());
  }

  void hydrateDashboardOnboardingState();
  return cachedState;
};

export const hydrateDashboardOnboardingState = async (force = false) => {
  const businessId = currentScope.businessId?.trim();
  const scopeKey = currentScopeKey(currentScope);

  if (!businessId) {
    dispatchState(defaultState());
    hydratedScopeKey = scopeKey;
    return cachedState;
  }

  if (!force && hydratedScopeKey === scopeKey) {
    return cachedState;
  }

  if (!force && hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = fetch("/api/dashboard/onboarding", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error((payload as { error?: string } | null)?.error ?? "Failed to load onboarding state");
      }

      const payload = (await response.json().catch(() => null)) as { state?: unknown } | null;
      const next = normalizeDashboardOnboardingState(payload?.state);
      hydratedScopeKey = scopeKey;
      dispatchState(next);
      return next;
    })
    .catch((error) => {
      console.error("[DASHBOARD_ONBOARDING_LOAD_ERROR]", error);
      const fallback = defaultState();
      dispatchState(fallback);
      return fallback;
    })
    .finally(() => {
      hydratePromise = null;
    });

  return hydratePromise;
};

export const readDashboardOnboardingState = (): DashboardOnboardingState => cachedState;

export const updateDashboardOnboardingState = (
  updater: (prev: DashboardOnboardingState) => DashboardOnboardingState
) => {
  const next = normalizeDashboardOnboardingState(updater(cachedState));
  dispatchState(next);
  enqueuePersist(next);
  return next;
};

export const setDashboardOnboardingHidden = (hidden: boolean) =>
  updateDashboardOnboardingState((prev) => ({
    ...prev,
    hidden
  }));

export const markChecklistTaskComplete = (taskId: ChecklistTaskId, value = true) =>
  updateDashboardOnboardingState((prev) => ({
    ...prev,
    completed: {
      ...prev.completed,
      [taskId]: value
    }
  }));

export const markTutorialSectionSeen = (pathname: string) => {
  if (!pathname) return cachedState;
  return updateDashboardOnboardingState((prev) => ({
    ...prev,
    sectionSeen: {
      ...prev.sectionSeen,
      [pathname]: true
    }
  }));
};
