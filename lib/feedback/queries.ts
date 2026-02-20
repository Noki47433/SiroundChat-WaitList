import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  FEEDBACK_CATEGORY_VALUES,
  FEEDBACK_IMPORTANCE_VALUES,
  FEEDBACK_PRIORITY_VALUES,
  FEEDBACK_STATUS_VALUES,
  FEEDBACK_TRIAGE_STATUS_VALUES,
  adminFeedbackFiltersSchema,
  adminFeedbackPaginationSchema,
  feedbackIdSchema,
  normalizeTag
} from "@/lib/feedback/validation";

export type FeedbackReportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  category: string;
  importance: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  url: string | null;
  browser_info: string | null;
  attachments: Array<{ path: string; name: string; type: string; size: number }>;
  business_id: string | null;
  user_id: string | null;
  contact_email: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  triage_status: string;
  priority: string;
  assigned_to: string | null;
  due_at: string | null;
  first_response_at: string | null;
  last_activity_at: string;
  duplicate_of_id: string | null;
  tags: string[];
  internal_comments_count: number;
  repro_checklist: {
    reproduced?: boolean;
    environment?: string;
    notes?: string;
    steps_verified?: boolean;
  } | null;
};

export type FeedbackInternalCommentRow = {
  id: string;
  created_at: string;
  report_id: string;
  admin_user_id: string;
  type: "comment" | "status_change" | "assignment_change" | "tag_change" | "priority_change" | "link_change";
  message: string;
  meta: Record<string, unknown>;
};

export type FeedbackAdminListRow = FeedbackReportRow & {
  business_name: string | null;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
};

export type FeedbackAdminListResult = {
  rows: FeedbackAdminListRow[];
  page: number;
  pageSize: number;
  total: number;
  admins: Array<{
    id: string;
    full_name: string | null;
    role: string;
  }>;
  metrics: {
    newCount: number;
    needsReproCount: number;
    overdueCount: number;
    criticalOpenCount: number;
    avgFirstResponseSeconds: number | null;
  };
};

export type FeedbackAdminDetail = {
  report: FeedbackReportRow | null;
  comments: Array<
    FeedbackInternalCommentRow & {
      admin_name: string | null;
    }
  >;
  admins: Array<{
    id: string;
    full_name: string | null;
    role: string;
  }>;
  business_name: string | null;
};

export type VerifiedUserContext = {
  supabase: any;
  userId: string;
};

export type VerifiedAdminContext = {
  supabase: any;
  adminUserId: string;
};

const CLOSED_TRIAGE_STATUSES = ["resolved", "closed", "wontfix", "duplicate"];
const STATUS_IN_VALUES = `(${CLOSED_TRIAGE_STATUSES.join(",")})`;

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

const sanitizeSearch = (value: string) => value.replace(/,/g, " ").trim();

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

export const ensureAdminContext = async (context?: Partial<VerifiedAdminContext>): Promise<VerifiedAdminContext> => {
  const supabase = context?.supabase ?? getSupabaseServerClient();

  if (context?.supabase && context?.adminUserId) {
    return {
      supabase: context.supabase,
      adminUserId: context.adminUserId
    };
  }

  let adminUserId = context?.adminUserId ?? "";

  if (!adminUserId) {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Unauthorized");
    }

    adminUserId = user.id;
  }

  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, role")
    .eq("id", adminUserId)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    throw new Error("Forbidden");
  }

  return { supabase, adminUserId };
};

export async function listMyFeedbackReports(
  options?: Partial<VerifiedUserContext> & {
    limit?: number;
  }
): Promise<FeedbackReportRow[]> {
  const { supabase } = await ensureUserContext(options);
  const limit = Math.min(Math.max(Number(options?.limit ?? 10), 1), 50);

  const { data, error } = await (supabase as any)
    .from("feedback_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? "Failed to load feedback reports");
  }

  return (data ?? []) as FeedbackReportRow[];
}

export async function getMyFeedbackReport(
  id: string,
  options?: Partial<VerifiedUserContext>
): Promise<FeedbackReportRow | null> {
  const parsedId = feedbackIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("Invalid report id");
  }

  const { supabase } = await ensureUserContext(options);

  const { data, error } = await (supabase as any)
    .from("feedback_reports")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load feedback report");
  }

  return (data as FeedbackReportRow | null) ?? null;
}

const applyAdminFilters = (baseQuery: any, rawFilters: Record<string, unknown>) => {
  const parsed = adminFeedbackFiltersSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : {};
  let query = baseQuery;

  if (filters.queue) {
    if (filters.queue === "new") query = query.eq("triage_status", "new");
    if (filters.queue === "needs_repro") query = query.eq("triage_status", "needs_repro");
    if (filters.queue === "planned") query = query.eq("triage_status", "planned");
    if (filters.queue === "in_progress") query = query.eq("triage_status", "in_progress");
    if (filters.queue === "overdue") query = query.lt("due_at", new Date().toISOString()).not("triage_status", "in", STATUS_IN_VALUES);
    if (filters.queue === "resolved_recent") {
      const last14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      query = query.eq("triage_status", "resolved").gte("resolved_at", last14);
    }
  }

  if (filters.triage_status && FEEDBACK_TRIAGE_STATUS_VALUES.includes(filters.triage_status as any)) {
    query = query.eq("triage_status", filters.triage_status);
  }
  if (filters.status && FEEDBACK_STATUS_VALUES.includes(filters.status as any)) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority && FEEDBACK_PRIORITY_VALUES.includes(filters.priority as any)) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.importance && FEEDBACK_IMPORTANCE_VALUES.includes(filters.importance as any)) {
    query = query.eq("importance", filters.importance);
  }
  if (filters.category && FEEDBACK_CATEGORY_VALUES.includes(filters.category as any)) {
    query = query.eq("category", filters.category);
  }

  if (filters.assigned_to) {
    if (filters.assigned_to === "unassigned") {
      query = query.is("assigned_to", null);
    } else {
      query = query.eq("assigned_to", filters.assigned_to);
    }
  }

  if (toBoolean(filters.overdue)) {
    query = query.lt("due_at", new Date().toISOString()).not("triage_status", "in", STATUS_IN_VALUES);
  }

  if (filters.tag) {
    const normalizedTag = normalizeTag(filters.tag);
    if (normalizedTag) {
      query = query.contains("tags", [normalizedTag]);
    }
  }

  if (filters.search) {
    const search = sanitizeSearch(filters.search);
    if (search.length) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
  }

  return { query, filters };
};

const applyAdminSort = (query: any, sort: string | undefined) => {
  const value = sort ?? "last_activity_desc";
  if (value === "created_at_desc") {
    return query.order("created_at", { ascending: false });
  }
  if (value === "due_at_asc") {
    return query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  }
  if (value === "priority_asc") {
    return query.order("priority", { ascending: true }).order("last_activity_at", { ascending: false });
  }
  return query.order("last_activity_at", { ascending: false });
};

const withBusinessAndAssigneeLabels = async (supabase: any, rows: FeedbackReportRow[]): Promise<FeedbackAdminListRow[]> => {
  const businessIds = Array.from(new Set(rows.map((row) => row.business_id).filter(Boolean))) as string[];
  const assigneeIds = Array.from(new Set(rows.map((row) => row.assigned_to).filter(Boolean))) as string[];

  const [businessesResult, profilesResult] = await Promise.all([
    businessIds.length
      ? (supabase as any).from("businesses").select("id, name, business_name").in("id", businessIds)
      : Promise.resolve({ data: [] }),
    assigneeIds.length
      ? (supabase as any).from("profiles").select("id, full_name, role").in("id", assigneeIds)
      : Promise.resolve({ data: [] })
  ]);

  const businessMap = new Map<string, string>(
    ((businessesResult.data ?? []) as Array<{ id: string; name: string | null; business_name: string | null }>).map((row) => [
      row.id,
      row.name ?? row.business_name ?? "Unknown business"
    ])
  );

  const profileMap = new Map<string, { full_name: string | null; role: string }>(
    ((profilesResult.data ?? []) as Array<{ id: string; full_name: string | null; role: string }>).map((row) => [
      row.id,
      { full_name: row.full_name, role: row.role }
    ])
  );

  return rows.map((row) => ({
    ...row,
    business_name: row.business_id ? (businessMap.get(row.business_id) ?? null) : null,
    assigned_to_name: row.assigned_to ? (profileMap.get(row.assigned_to)?.full_name ?? row.assigned_to) : null,
    assigned_to_role: row.assigned_to ? (profileMap.get(row.assigned_to)?.role ?? null) : null
  }));
};

const getAdminFeedbackMetrics = async (supabase: any) => {
  const nowIso = new Date().toISOString();
  const last14Iso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [newCountResult, needsReproResult, overdueResult, criticalOpenResult, firstResponseRowsResult] = await Promise.all([
    (supabase as any).from("feedback_reports").select("id", { count: "exact", head: true }).eq("triage_status", "new"),
    (supabase as any).from("feedback_reports").select("id", { count: "exact", head: true }).eq("triage_status", "needs_repro"),
    (supabase as any)
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .lt("due_at", nowIso)
      .not("triage_status", "in", STATUS_IN_VALUES),
    (supabase as any)
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .eq("importance", "critical")
      .in("status", ["open", "in_progress"]),
    (supabase as any)
      .from("feedback_reports")
      .select("created_at, first_response_at")
      .not("first_response_at", "is", null)
      .gte("created_at", last14Iso)
      .limit(5000)
  ]);

  const firstResponseRows = (firstResponseRowsResult.data ?? []) as Array<{
    created_at: string;
    first_response_at: string | null;
  }>;

  const deltas = firstResponseRows
    .map((row) => {
      if (!row.first_response_at) return null;
      const createdAt = new Date(row.created_at).getTime();
      const firstResponseAt = new Date(row.first_response_at).getTime();
      if (!Number.isFinite(createdAt) || !Number.isFinite(firstResponseAt) || firstResponseAt < createdAt) return null;
      return (firstResponseAt - createdAt) / 1000;
    })
    .filter((value): value is number => typeof value === "number");

  const avgFirstResponseSeconds = deltas.length
    ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
    : null;

  return {
    newCount: newCountResult.count ?? 0,
    needsReproCount: needsReproResult.count ?? 0,
    overdueCount: overdueResult.count ?? 0,
    criticalOpenCount: criticalOpenResult.count ?? 0,
    avgFirstResponseSeconds
  };
};

export async function adminListFeedbackReports(
  rawFilters: Record<string, unknown> = {},
  rawPagination?: Partial<{ page: number; pageSize: number }>,
  context?: Partial<VerifiedAdminContext>
): Promise<FeedbackAdminListResult> {
  const { supabase } = await ensureAdminContext(context);
  const parsedPagination = adminFeedbackPaginationSchema.parse(rawPagination ?? {});
  const { page, pageSize } = parsedPagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const baseQuery = (supabase as any).from("feedback_reports").select("*", { count: "exact" });
  const { query, filters } = applyAdminFilters(baseQuery, rawFilters);
  const sortedQuery = applyAdminSort(query, typeof filters.sort === "string" ? filters.sort : undefined).range(from, to);

  const [rowsResult, metrics, adminsResult] = await Promise.all([
    sortedQuery,
    getAdminFeedbackMetrics(supabase),
    (supabase as any).from("profiles").select("id, full_name, role").eq("role", "admin").order("full_name", { ascending: true })
  ]);

  if (rowsResult.error) {
    throw new Error(rowsResult.error.message ?? "Failed to list feedback reports");
  }

  const rows = (rowsResult.data ?? []) as FeedbackReportRow[];
  const labeledRows = await withBusinessAndAssigneeLabels(supabase, rows);

  return {
    rows: labeledRows,
    page,
    pageSize,
    total: rowsResult.count ?? 0,
    admins: (adminsResult.data ?? []) as Array<{ id: string; full_name: string | null; role: string }>,
    metrics
  };
}

export async function adminGetFeedbackReport(
  id: string,
  context?: Partial<VerifiedAdminContext>
): Promise<FeedbackAdminDetail> {
  const parsedId = feedbackIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("Invalid report id");
  }

  const { supabase } = await ensureAdminContext(context);

  const { data: report, error: reportError } = await (supabase as any)
    .from("feedback_reports")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (reportError) {
    throw new Error(reportError.message ?? "Failed to load feedback report");
  }

  const row = (report as FeedbackReportRow | null) ?? null;
  if (!row) {
    return {
      report: null,
      comments: [],
      admins: [],
      business_name: null
    };
  }

  const [{ data: comments }, { data: admins }, businessResult] = await Promise.all([
    (supabase as any)
      .from("feedback_internal_comments")
      .select("id, created_at, report_id, admin_user_id, type, message, meta")
      .eq("report_id", row.id)
      .order("created_at", { ascending: true }),
    (supabase as any).from("profiles").select("id, full_name, role").eq("role", "admin").order("full_name", { ascending: true }),
    row.business_id
      ? (supabase as any).from("businesses").select("id, name, business_name").eq("id", row.business_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const adminRows = ((admins ?? []) as Array<{ id: string; full_name: string | null; role: string }>).map((admin) => ({
    id: admin.id,
    full_name: admin.full_name,
    role: admin.role
  }));

  const adminNameMap = new Map<string, string | null>(adminRows.map((admin) => [admin.id, admin.full_name]));
  const typedComments = ((comments ?? []) as FeedbackInternalCommentRow[]).map((comment) => ({
    ...comment,
    admin_name: adminNameMap.get(comment.admin_user_id) ?? comment.admin_user_id
  }));

  const businessName = businessResult?.data
    ? ((businessResult.data as { name: string | null; business_name: string | null }).name ??
      (businessResult.data as { name: string | null; business_name: string | null }).business_name ??
      null)
    : null;

  return {
    report: row,
    comments: typedComments,
    admins: adminRows,
    business_name: businessName
  };
}

export async function adminSearchFeedbackReports(
  query: string,
  options?: {
    excludeId?: string;
    limit?: number;
  } & Partial<VerifiedAdminContext>
) {
  const { supabase } = await ensureAdminContext(options);
  const text = query.trim();
  if (!text) return [];

  const limit = Math.min(Math.max(Number(options?.limit ?? 10), 1), 20);
  const searchValue = sanitizeSearch(text);

  let dbQuery = (supabase as any)
    .from("feedback_reports")
    .select("id, title, created_at, triage_status, status")
    .or(`title.ilike.%${searchValue}%,description.ilike.%${searchValue}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.excludeId) {
    dbQuery = dbQuery.neq("id", options.excludeId);
  }

  const { data, error } = await dbQuery;
  if (error) {
    throw new Error(error.message ?? "Failed to search feedback reports");
  }

  return (data ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    triage_status: string;
    status: string;
  }>;
}
