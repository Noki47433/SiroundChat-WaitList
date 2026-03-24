"use client";

export const DASHBOARD_ONBOARDING_STORAGE_KEY = "siround_dashboard_onboarding_v2";
export const DASHBOARD_ONBOARDING_EVENT = "siround-dashboard-onboarding-updated";
const DASHBOARD_ONBOARDING_SCOPE_STORAGE_KEY = "siround_dashboard_onboarding_scope_v1";

export type ChecklistTaskId = "create_chatbot" | "create_website" | "train_documents";

export type ChecklistTask = {
  id: ChecklistTaskId;
  label: string;
  description: string;
  href: string;
};

export const CHECKLIST_TASKS: ChecklistTask[] = [
  {
    id: "create_chatbot",
    label: "Create chatbot",
    description: "Set your greeting, tone, and brand style.",
    href: "/dashboard/bot-settings"
  },
  {
    id: "create_website",
    label: "Create website",
    description: "Generate your first website from the builder.",
    href: "/dashboard/builder/new"
  },
  {
    id: "train_documents",
    label: "Upload and re-train",
    description: "Add your first document, then re-train it.",
    href: "/dashboard/documents"
  },
];

export type DashboardOnboardingState = {
  version: 4;
  hidden: boolean;
  completed: Record<ChecklistTaskId, boolean>;
  sectionSeen: Record<string, boolean>;
};

export type DashboardOnboardingScope = {
  userId?: string | null;
  businessId?: string | null;
};

const canUseBrowser = () => typeof window !== "undefined";

const defaultCompleted = (): Record<ChecklistTaskId, boolean> => ({
  create_chatbot: false,
  create_website: false,
  train_documents: false
});

const defaultState = (): DashboardOnboardingState => ({
  version: 4,
  hidden: false,
  completed: defaultCompleted(),
  sectionSeen: {}
});

const resolveScopeKey = () => {
  if (!canUseBrowser()) return `${DASHBOARD_ONBOARDING_STORAGE_KEY}:server`;
  const raw = window.localStorage.getItem(DASHBOARD_ONBOARDING_SCOPE_STORAGE_KEY);
  if (!raw) return `${DASHBOARD_ONBOARDING_STORAGE_KEY}:anonymous`;

  try {
    const scope = JSON.parse(raw) as DashboardOnboardingScope;
    const userPart = scope.userId?.trim() || "anonymous";
    const businessPart = scope.businessId?.trim() || "no-business";
    return `${DASHBOARD_ONBOARDING_STORAGE_KEY}:${userPart}:${businessPart}`;
  } catch {
    return `${DASHBOARD_ONBOARDING_STORAGE_KEY}:anonymous`;
  }
};

const normalizeState = (raw: unknown): DashboardOnboardingState => {
  const fallback = defaultState();
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as Partial<DashboardOnboardingState>;
  return {
    version: 4,
    hidden: Boolean(input.hidden),
    completed: {
      ...fallback.completed,
      ...(input.completed ?? {})
    },
    sectionSeen: {
      ...(input.sectionSeen ?? {})
    }
  };
};

const saveState = (next: DashboardOnboardingState) => {
  if (!canUseBrowser()) return;
  window.localStorage.setItem(resolveScopeKey(), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_EVENT, { detail: next }));
};

export const setDashboardOnboardingScope = (scope: DashboardOnboardingScope) => {
  if (!canUseBrowser()) return defaultState();
  window.localStorage.setItem(DASHBOARD_ONBOARDING_SCOPE_STORAGE_KEY, JSON.stringify(scope));
  const next = readDashboardOnboardingState();
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_EVENT, { detail: next }));
  return next;
};

export const readDashboardOnboardingState = (): DashboardOnboardingState => {
  if (!canUseBrowser()) return defaultState();
  const raw = window.localStorage.getItem(resolveScopeKey());
  if (!raw) return defaultState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
};

export const updateDashboardOnboardingState = (
  updater: (prev: DashboardOnboardingState) => DashboardOnboardingState
) => {
  const current = readDashboardOnboardingState();
  const next = normalizeState(updater(current));
  saveState(next);
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
  if (!pathname) return;
  updateDashboardOnboardingState((prev) => ({
    ...prev,
    sectionSeen: {
      ...prev.sectionSeen,
      [pathname]: true
    }
  }));
};

export const checklistCompletedCount = (state: DashboardOnboardingState) =>
  CHECKLIST_TASKS.reduce((count, task) => count + (state.completed[task.id] ? 1 : 0), 0);

export const isChecklistDone = (state: DashboardOnboardingState) =>
  CHECKLIST_TASKS.every((task) => state.completed[task.id]);
