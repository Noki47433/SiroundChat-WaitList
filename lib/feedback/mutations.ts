import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/tenant";
import type { FeedbackReportRow, VerifiedAdminContext, VerifiedUserContext } from "@/lib/feedback/queries";
import { ensureAdminContext } from "@/lib/feedback/queries";
import { logActivity } from "@/lib/activity/log";
import {
  FEEDBACK_TRIAGE_STATUS_VALUES,
  adminBulkPatchSchema,
  adminCommentSchema,
  adminFeedbackPatchSchema,
  createFeedbackReportSchema,
  feedbackIdSchema,
  normalizeTag,
  normalizeTags,
  parseOptionalTimestamp,
  priorityForImportance
} from "@/lib/feedback/validation";

type CreateFeedbackOptions = Partial<VerifiedUserContext> & {
  businessId?: string | null;
};

const ensureUserContext = async (context?: Partial<VerifiedUserContext>): Promise<VerifiedUserContext> => {
  const supabase = context?.supabase ?? getSupabaseServerClient();

  if (context?.userId) {
    return { supabase, userId: context.userId };
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return {
    supabase,
    userId: user.id
  };
};

const getFeedbackReportById = async (supabase: any, id: string) => {
  const { data, error } = await (supabase as any).from("feedback_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load feedback report");
  return (data as FeedbackReportRow | null) ?? null;
};

const ensureReportExists = async (supabase: any, id: string) => {
  const { data, error } = await (supabase as any).from("feedback_reports").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to verify linked report");
  return Boolean(data?.id);
};

const parseDateTimeOrThrow = (value: string | null | undefined, label: string) => {
  if (value === null) return null;
  if (typeof value === "undefined") return undefined;
  const parsed = parseOptionalTimestamp(value);
  if (!parsed) throw new Error(`${label} must be a valid timestamp`);
  return parsed;
};

const pushSystemComment = async (
  supabase: any,
  reportId: string,
  adminUserId: string,
  type: "status_change" | "assignment_change" | "tag_change" | "priority_change" | "link_change",
  message: string,
  meta: Record<string, unknown>
) => {
  const { error } = await (supabase as any).from("feedback_internal_comments").insert({
    report_id: reportId,
    admin_user_id: adminUserId,
    type,
    message,
    meta
  });
  if (error) {
    throw new Error(error.message ?? "Failed to write feedback audit comment");
  }
};

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};

export async function createFeedbackReport(input: unknown, options?: CreateFeedbackOptions) {
  const parsed = createFeedbackReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid feedback report payload");
  }

  const { supabase, userId } = await ensureUserContext(options);
  const tenant = typeof options?.businessId !== "undefined" ? { businessId: options.businessId } : await getTenantFromSession(userId);

  const payload = parsed.data;
  const insertPayload = {
    status: "open",
    triage_status: "new",
    priority: priorityForImportance(payload.importance),
    category: payload.category,
    importance: payload.importance,
    title: payload.title.trim(),
    description: payload.description.trim(),
    steps_to_reproduce: payload.steps_to_reproduce,
    expected_behavior: payload.expected_behavior,
    actual_behavior: payload.actual_behavior,
    url: payload.url,
    browser_info: payload.browser_info,
    attachments: payload.attachments ?? [],
    business_id: tenant.businessId ?? null,
    user_id: userId,
    contact_email: payload.contact_email
  };

  const { data, error } = await (supabase as any).from("feedback_reports").insert(insertPayload).select("id").single();
  if (error) {
    throw new Error(error.message ?? "Failed to create feedback report");
  }

  const createdId = (data as { id: string }).id;
  if (tenant.businessId) {
    await logActivity({
      businessId: tenant.businessId,
      userId,
      actorType: "business_user",
      eventType: "feedback_report_submitted",
      summary: `Submitted feedback report: ${payload.title.trim()}`,
      meta: { feedback_report_id: createdId, category: payload.category, importance: payload.importance }
    });
  }

  return { id: createdId };
}

export async function adminUpdateFeedbackReport(
  id: string,
  patchInput: unknown,
  context?: Partial<VerifiedAdminContext>
) {
  const parsedId = feedbackIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("Invalid report id");
  }

  const parsedPatch = adminFeedbackPatchSchema.safeParse(patchInput ?? {});
  if (!parsedPatch.success) {
    throw new Error(parsedPatch.error.issues[0]?.message ?? "Invalid feedback patch");
  }

  const { supabase, adminUserId } = await ensureAdminContext(context);
  const current = await getFeedbackReportById(supabase, parsedId.data);
  if (!current) {
    throw new Error("Feedback report not found");
  }

  const patch = parsedPatch.data;
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (typeof patch.status !== "undefined") updates.status = patch.status;
  if (typeof patch.triage_status !== "undefined") updates.triage_status = patch.triage_status;
  if (typeof patch.priority !== "undefined") updates.priority = patch.priority;
  if (typeof patch.assigned_to !== "undefined") updates.assigned_to = patch.assigned_to;
  if (typeof patch.due_at !== "undefined") updates.due_at = patch.due_at ? parseDateTimeOrThrow(patch.due_at, "due_at") : null;
  if (typeof patch.duplicate_of_id !== "undefined") updates.duplicate_of_id = patch.duplicate_of_id;
  if (typeof patch.admin_notes !== "undefined") updates.admin_notes = patch.admin_notes;
  if (typeof patch.resolution_summary !== "undefined") updates.resolution_summary = patch.resolution_summary;
  if (typeof patch.resolved_at !== "undefined") updates.resolved_at = patch.resolved_at ? parseDateTimeOrThrow(patch.resolved_at, "resolved_at") : null;
  if (typeof patch.repro_checklist !== "undefined") updates.repro_checklist = patch.repro_checklist ?? {};

  if (typeof patch.tags !== "undefined") {
    const normalizedCandidates = patch.tags.map((value) => normalizeTag(value)).filter(Boolean);
    if (normalizedCandidates.some((tag) => tag.length > 24)) {
      throw new Error("Each tag must be 24 characters or less");
    }
    if (new Set(normalizedCandidates).size > 20) {
      throw new Error("A maximum of 20 tags is allowed");
    }
    const normalized = normalizeTags(normalizedCandidates);
    updates.tags = normalized;
  }

  const nextTriageStatus = (updates.triage_status as string | undefined) ?? current.triage_status;
  const nextAdminNotes = (typeof updates.admin_notes !== "undefined" ? updates.admin_notes : current.admin_notes) as string | null;
  const nextResolutionSummary = (typeof updates.resolution_summary !== "undefined"
    ? updates.resolution_summary
    : current.resolution_summary) as string | null;
  const nextDuplicateOf = (typeof updates.duplicate_of_id !== "undefined"
    ? updates.duplicate_of_id
    : current.duplicate_of_id) as string | null;

  if (
    current.triage_status === "new" &&
    FEEDBACK_TRIAGE_STATUS_VALUES.includes(nextTriageStatus as any) &&
    nextTriageStatus !== "new" &&
    !current.first_response_at
  ) {
    updates.first_response_at = nowIso;
  }

  if (nextTriageStatus === "resolved") {
    if (!nextResolutionSummary || nextResolutionSummary.trim().length < 10) {
      throw new Error("resolution_summary is required (min 10 chars) when marking resolved");
    }
    updates.status = "resolved";
    if (!current.resolved_at && !updates.resolved_at) {
      updates.resolved_at = nowIso;
    }
  }

  if (nextTriageStatus === "closed") {
    updates.status = "closed";
  }

  if (nextTriageStatus === "wontfix") {
    if (!nextAdminNotes || nextAdminNotes.trim().length < 10) {
      throw new Error("admin_notes is required (min 10 chars) when marking wontfix");
    }
    updates.status = "closed";
  }

  if (nextTriageStatus === "duplicate") {
    if (!nextDuplicateOf) {
      throw new Error("duplicate_of_id is required when marking duplicate");
    }
    if (nextDuplicateOf === current.id) {
      throw new Error("duplicate_of_id cannot match the current report id");
    }
    const linkedExists = await ensureReportExists(supabase, nextDuplicateOf);
    if (!linkedExists) {
      throw new Error("duplicate_of_id must reference an existing feedback report");
    }
    updates.status = "closed";
  }

  const { data: updatedData, error: updateError } = await (supabase as any)
    .from("feedback_reports")
    .update(updates)
    .eq("id", current.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message ?? "Failed to update feedback report");
  }

  const updated = updatedData as FeedbackReportRow;
  const systemEvents: Array<{
    type: "status_change" | "assignment_change" | "tag_change" | "priority_change" | "link_change";
    message: string;
    meta: Record<string, unknown>;
  }> = [];

  if (current.triage_status !== updated.triage_status) {
    systemEvents.push({
      type: "status_change",
      message: `Triage status changed from "${current.triage_status}" to "${updated.triage_status}".`,
      meta: { from: current.triage_status, to: updated.triage_status }
    });
  }

  if (current.assigned_to !== updated.assigned_to) {
    systemEvents.push({
      type: "assignment_change",
      message: "Assignment updated.",
      meta: { from: current.assigned_to, to: updated.assigned_to }
    });
  }

  if (current.priority !== updated.priority) {
    systemEvents.push({
      type: "priority_change",
      message: `Priority changed from "${current.priority}" to "${updated.priority}".`,
      meta: { from: current.priority, to: updated.priority }
    });
  }

  const currentTags = normalizeTags(current.tags ?? []);
  const updatedTags = normalizeTags(updated.tags ?? []);
  if (!arraysEqual(currentTags, updatedTags)) {
    systemEvents.push({
      type: "tag_change",
      message: "Tags updated.",
      meta: { from: currentTags, to: updatedTags }
    });
  }

  if (current.duplicate_of_id !== updated.duplicate_of_id) {
    systemEvents.push({
      type: "link_change",
      message: "Duplicate link updated.",
      meta: { from: current.duplicate_of_id, to: updated.duplicate_of_id }
    });
  }

  if (systemEvents.length) {
    await Promise.all(
      systemEvents.map((event) => pushSystemComment(supabase, updated.id, adminUserId, event.type, event.message, event.meta))
    );
  }

  return updated;
}

export async function adminAddInternalComment(
  reportId: string,
  message: string,
  context?: Partial<VerifiedAdminContext>
) {
  const parsed = adminCommentSchema.safeParse({ report_id: reportId, message });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid comment payload");
  }

  const { supabase, adminUserId } = await ensureAdminContext(context);
  const report = await getFeedbackReportById(supabase, parsed.data.report_id);
  if (!report) {
    throw new Error("Feedback report not found");
  }

  const { data, error } = await (supabase as any)
    .from("feedback_internal_comments")
    .insert({
      report_id: parsed.data.report_id,
      admin_user_id: adminUserId,
      type: "comment",
      message: parsed.data.message.trim(),
      meta: {}
    })
    .select("id, created_at, report_id, admin_user_id, type, message, meta")
    .single();

  if (error) {
    throw new Error(error.message ?? "Failed to create internal comment");
  }

  return data;
}

export async function adminBulkUpdateFeedbackReports(
  ids: string[],
  patchInput: unknown,
  context?: Partial<VerifiedAdminContext>
) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new Error("No report ids provided");
  }
  if (uniqueIds.length > 200) {
    throw new Error("A maximum of 200 reports can be updated at once");
  }
  uniqueIds.forEach((value) => {
    const parsed = feedbackIdSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`Invalid report id: ${value}`);
    }
  });

  const parsedPatch = adminBulkPatchSchema.safeParse(patchInput ?? {});
  if (!parsedPatch.success) {
    throw new Error(parsedPatch.error.issues[0]?.message ?? "Invalid bulk update payload");
  }

  const patch = parsedPatch.data;
  if (patch.triage_status && ["resolved", "wontfix", "duplicate"].includes(patch.triage_status)) {
    throw new Error("Bulk triage updates cannot set resolved, wontfix, or duplicate states");
  }

  const adminContext = await ensureAdminContext(context);
  const { supabase } = adminContext;

  const { data: existingRows, error: rowsError } = await (supabase as any)
    .from("feedback_reports")
    .select("id, tags")
    .in("id", uniqueIds);

  if (rowsError) {
    throw new Error(rowsError.message ?? "Failed to load reports for bulk update");
  }

  const rowsById = new Map<string, { id: string; tags: string[] }>(
    ((existingRows ?? []) as Array<{ id: string; tags: string[] | null }>).map((row) => [row.id, { id: row.id, tags: row.tags ?? [] }])
  );

  const updatedIds: string[] = [];

  for (const id of uniqueIds) {
    const row = rowsById.get(id);
    if (!row) continue;

    const patchForRow: Record<string, unknown> = {};

    if (typeof patch.triage_status !== "undefined") patchForRow.triage_status = patch.triage_status;
    if (typeof patch.priority !== "undefined") patchForRow.priority = patch.priority;
    if (typeof patch.assigned_to !== "undefined") patchForRow.assigned_to = patch.assigned_to;

    if (patch.add_tag || patch.remove_tag) {
      let nextTags = normalizeTags(row.tags);
      if (patch.add_tag) {
        const addTag = normalizeTag(patch.add_tag);
        if (addTag && addTag.length > 24) {
          throw new Error("Tag must be 24 characters or less");
        }
        if (addTag) {
          const candidateSet = new Set([...nextTags, addTag]);
          if (candidateSet.size > 20) {
            throw new Error("A maximum of 20 tags is allowed");
          }
          nextTags = normalizeTags(Array.from(candidateSet));
        }
      }
      if (patch.remove_tag) {
        const removeTag = normalizeTag(patch.remove_tag);
        if (removeTag) {
          nextTags = nextTags.filter((tag) => tag !== removeTag);
        }
      }
      patchForRow.tags = nextTags;
    }

    await adminUpdateFeedbackReport(id, patchForRow, adminContext);
    updatedIds.push(id);
  }

  return {
    updated: updatedIds.length,
    ids: updatedIds
  };
}
