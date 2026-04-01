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
  }
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

export const defaultCompleted = (): Record<ChecklistTaskId, boolean> => ({
  create_chatbot: false,
  create_website: false,
  train_documents: false
});

export const defaultDashboardOnboardingState = (): DashboardOnboardingState => ({
  version: 4,
  hidden: false,
  completed: defaultCompleted(),
  sectionSeen: {}
});

export const normalizeDashboardOnboardingState = (raw: unknown): DashboardOnboardingState => {
  const fallback = defaultDashboardOnboardingState();
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

export const isDashboardOnboardingStateEmpty = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return true;
  }

  const normalized = normalizeDashboardOnboardingState(raw);
  return (
    normalized.hidden === false &&
    Object.values(normalized.completed).every((value) => value === false) &&
    Object.keys(normalized.sectionSeen).length === 0
  );
};

export const checklistCompletedCount = (state: DashboardOnboardingState) =>
  CHECKLIST_TASKS.reduce((count, task) => count + (state.completed[task.id] ? 1 : 0), 0);

export const isChecklistDone = (state: DashboardOnboardingState) =>
  CHECKLIST_TASKS.every((task) => state.completed[task.id]);
