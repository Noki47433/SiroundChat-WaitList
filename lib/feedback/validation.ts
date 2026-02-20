import { z } from "zod";

export const FEEDBACK_STATUS_VALUES = ["open", "in_progress", "resolved", "closed"] as const;
export const FEEDBACK_CATEGORY_VALUES = ["bug", "feature_request", "ux_issue", "billing_issue", "other"] as const;
export const FEEDBACK_IMPORTANCE_VALUES = ["low", "medium", "high", "critical"] as const;
export const FEEDBACK_TRIAGE_STATUS_VALUES = [
  "new",
  "needs_repro",
  "acknowledged",
  "planned",
  "in_progress",
  "resolved",
  "closed",
  "wontfix",
  "duplicate"
] as const;
export const FEEDBACK_PRIORITY_VALUES = ["p0", "p1", "p2", "p3"] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORY_VALUES)[number];
export type FeedbackImportance = (typeof FEEDBACK_IMPORTANCE_VALUES)[number];
export type FeedbackTriageStatus = (typeof FEEDBACK_TRIAGE_STATUS_VALUES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITY_VALUES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      const normalized = value.trim();
      return normalized.length ? normalized : null;
    });

const attachmentSchema = z.object({
  path: z.string().trim().min(1).max(512),
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(128),
  size: z.number().int().nonnegative()
});

export const createFeedbackReportSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORY_VALUES),
  importance: z.enum(FEEDBACK_IMPORTANCE_VALUES),
  title: z.string().trim().min(5, "Title must be at least 5 characters.").max(80, "Title must be 80 characters or less."),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters.")
    .max(2000, "Description must be 2000 characters or less."),
  steps_to_reproduce: optionalText(2000),
  expected_behavior: optionalText(2000),
  actual_behavior: optionalText(2000),
  url: optionalText(1200),
  contact_email: optionalText(320).refine((value) => {
    if (!value) return true;
    return z.string().email().safeParse(value).success;
  }, "Contact email must be valid."),
  browser_info: optionalText(1200),
  attachments: z.array(attachmentSchema).max(3).optional().default([])
});

export type CreateFeedbackReportInput = z.infer<typeof createFeedbackReportSchema>;

export const feedbackIdSchema = z.string().uuid();

const reproChecklistSchema = z.object({
  reproduced: z.boolean().optional(),
  environment: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(3000).optional(),
  steps_verified: z.boolean().optional()
});

export const adminFeedbackPatchSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUS_VALUES).optional(),
    triage_status: z.enum(FEEDBACK_TRIAGE_STATUS_VALUES).optional(),
    priority: z.enum(FEEDBACK_PRIORITY_VALUES).optional(),
    assigned_to: z.string().uuid().optional().nullable(),
    due_at: z.string().trim().optional().nullable(),
    tags: z.array(z.string().trim().max(64)).max(20).optional(),
    duplicate_of_id: z.string().uuid().optional().nullable(),
    admin_notes: optionalText(6000),
    resolution_summary: optionalText(4000),
    resolved_at: z.string().trim().optional().nullable(),
    repro_checklist: reproChecklistSchema.optional()
  })
  .strict();

export type AdminFeedbackPatchInput = z.infer<typeof adminFeedbackPatchSchema>;

export const adminCommentSchema = z.object({
  report_id: z.string().uuid(),
  message: z.string().trim().min(1).max(4000)
});

export type AdminCommentInput = z.infer<typeof adminCommentSchema>;

export const adminBulkPatchSchema = z
  .object({
    triage_status: z.enum(FEEDBACK_TRIAGE_STATUS_VALUES).optional(),
    priority: z.enum(FEEDBACK_PRIORITY_VALUES).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    add_tag: z.string().trim().max(64).optional(),
    remove_tag: z.string().trim().max(64).optional()
  })
  .refine((value) => Boolean(value.triage_status || value.priority || value.assigned_to !== undefined || value.add_tag || value.remove_tag), {
    message: "At least one bulk update field is required."
  });

export type AdminBulkPatchInput = z.infer<typeof adminBulkPatchSchema>;

export const adminFeedbackFiltersSchema = z.object({
  queue: z.string().trim().optional(),
  triage_status: z.string().trim().optional(),
  status: z.string().trim().optional(),
  importance: z.string().trim().optional(),
  category: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  assigned_to: z.string().trim().optional(),
  overdue: z.union([z.boolean(), z.string()]).optional(),
  tag: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sort: z.string().trim().optional()
});

export const adminFeedbackPaginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25)
});

export type AdminFeedbackFiltersInput = z.infer<typeof adminFeedbackFiltersSchema>;
export type AdminFeedbackPaginationInput = z.infer<typeof adminFeedbackPaginationSchema>;

export const normalizeTag = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const normalizeTags = (tags: string[]) => {
  const unique = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;
    if (normalized.length > 24) continue;
    unique.add(normalized);
    if (unique.size >= 20) break;
  }
  return Array.from(unique);
};

export const priorityForImportance = (importance: FeedbackImportance): FeedbackPriority => {
  if (importance === "critical") return "p0";
  if (importance === "high") return "p1";
  if (importance === "medium") return "p2";
  return "p3";
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const suggestedDueAtForPriority = (priority: FeedbackPriority, now = new Date()) => {
  const daysByPriority: Record<FeedbackPriority, number> = {
    p0: 1,
    p1: 3,
    p2: 7,
    p3: 14
  };
  const days = daysByPriority[priority];
  return new Date(now.getTime() + days * DAY_MS).toISOString();
};

export const parseOptionalTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};
