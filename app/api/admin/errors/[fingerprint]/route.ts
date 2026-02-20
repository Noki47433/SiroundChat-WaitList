import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { severityToFeedbackImportance } from "@/lib/errors/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["open", "muted", "resolved"]);

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: { fingerprint: string };
  }
) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const fingerprint = decodeURIComponent(params.fingerprint ?? "").trim();
  if (!fingerprint) {
    return NextResponse.json({ error: "Invalid fingerprint." }, { status: 400 });
  }

  const [groupResult, eventsResult] = await Promise.all([
    (guard.supabase as any).from("error_groups").select("*").eq("fingerprint", fingerprint).maybeSingle(),
    (guard.supabase as any)
      .from("error_events")
      .select("id, created_at, severity, environment, source, message, stack, route, url, user_agent, business_id, user_id, meta")
      .eq("fingerprint", fingerprint)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (groupResult.error) {
    return NextResponse.json({ error: groupResult.error.message ?? "Failed to load error group." }, { status: 400 });
  }
  if (!groupResult.data) {
    return NextResponse.json({ error: "Error group not found." }, { status: 404 });
  }

  const events = eventsResult.data ?? [];
  const businessIds = Array.from(new Set(events.map((event: any) => event.business_id).filter(Boolean)));
  const { data: businesses } = businessIds.length
    ? await (guard.supabase as any).from("businesses").select("id, name, business_name").in("id", businessIds)
    : { data: [] as any[] };

  const businessMap = new Map<string, string>(
    (businesses ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const linkedFeedbackId = groupResult.data.linked_feedback_id as string | null;
  const { data: linkedFeedback } = linkedFeedbackId
    ? await (guard.supabase as any).from("feedback_reports").select("id, title, status").eq("id", linkedFeedbackId).maybeSingle()
    : { data: null };

  return NextResponse.json(
    {
      group: groupResult.data,
      linked_feedback: linkedFeedback ?? null,
      events: events.map((event: any) => ({
        ...event,
        business_name: event.business_id ? businessMap.get(event.business_id) ?? null : null
      }))
    },
    { status: 200 }
  );
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: { fingerprint: string };
  }
) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const fingerprint = decodeURIComponent(params.fingerprint ?? "").trim();
  if (!fingerprint) {
    return NextResponse.json({ error: "Invalid fingerprint." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: string;
    linked_feedback_id?: string | null;
    create_feedback_report?: boolean;
  } | null;

  const updates: Record<string, unknown> = {};

  if (typeof body?.status === "string") {
    const status = body.status.trim();
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
  }

  if (typeof body?.linked_feedback_id !== "undefined") {
    if (body.linked_feedback_id === null || body.linked_feedback_id === "") {
      updates.linked_feedback_id = null;
    } else {
      const { data: feedbackExists } = await (guard.supabase as any)
        .from("feedback_reports")
        .select("id")
        .eq("id", body.linked_feedback_id)
        .maybeSingle();
      if (!feedbackExists) {
        return NextResponse.json({ error: "Feedback report not found." }, { status: 404 });
      }
      updates.linked_feedback_id = body.linked_feedback_id;
    }
  }

  if (body?.create_feedback_report) {
    const [groupResult, latestEventResult] = await Promise.all([
      (guard.supabase as any)
        .from("error_groups")
        .select("fingerprint, title, sample_message, sample_stack, sample_route, linked_feedback_id")
        .eq("fingerprint", fingerprint)
        .maybeSingle(),
      (guard.supabase as any)
        .from("error_events")
        .select("business_id, user_id, severity, route, stack, message")
        .eq("fingerprint", fingerprint)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (!groupResult.data) {
      return NextResponse.json({ error: "Error group not found." }, { status: 404 });
    }

    if (groupResult.data.linked_feedback_id) {
      updates.linked_feedback_id = groupResult.data.linked_feedback_id;
    } else {
      const severity = (latestEventResult.data?.severity ?? "error") as "info" | "warn" | "error" | "fatal";
      const importance = severityToFeedbackImportance(severity);
      const message = latestEventResult.data?.message ?? groupResult.data.sample_message ?? groupResult.data.title;
      const stack = latestEventResult.data?.stack ?? groupResult.data.sample_stack;
      const route = latestEventResult.data?.route ?? groupResult.data.sample_route;

      const title = (message.split("\n")[0] ?? groupResult.data.title).trim().slice(0, 80);
      const description = [
        `Created from error group fingerprint=${fingerprint}`,
        route ? `Route: ${route}` : null,
        stack ? `Stack:\n${stack}` : null
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data: createdFeedback, error: createError } = await (guard.supabase as any)
        .from("feedback_reports")
        .insert({
          status: "open",
          triage_status: "new",
          category: "bug",
          importance,
          title: title || "Error group issue",
          description: description || "Created from error group.",
          business_id: latestEventResult.data?.business_id ?? null,
          user_id: latestEventResult.data?.user_id ?? null,
          admin_notes: `Created from error group fingerprint=${fingerprint}`,
          url: route ?? null,
          browser_info: null
        })
        .select("id")
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message ?? "Failed to create feedback report." }, { status: 400 });
      }

      updates.linked_feedback_id = createdFeedback.id;
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await (guard.supabase as any)
    .from("error_groups")
    .update(updates)
    .eq("fingerprint", fingerprint)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message ?? "Failed to update error group." }, { status: 400 });
  }

  return NextResponse.json({ group: updated }, { status: 200 });
}

