import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeErrorFingerprint, firstMessageLine, severityToFeedbackImportance, stackTopLines } from "@/lib/errors/ingest";
import { logActivity } from "@/lib/activity/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IngestPayload = {
  source?: string;
  environment?: string;
  severity?: "info" | "warn" | "error" | "fatal";
  message?: string;
  stack?: string | null;
  route?: string | null;
  url?: string | null;
  user_agent?: string | null;
  business_id?: string | null;
  meta?: Record<string, unknown>;
};

const VALID_ENV = new Set(["dev", "staging", "prod"]);
const VALID_SEVERITY = new Set(["info", "warn", "error", "fatal"]);
const HOT_THRESHOLD = 25;
const DUPLICATE_WINDOW_MS = 5000;
const recentIngestByKey = new Map<string, number>();

const resolveOwnedBusiness = async (supabase: any, userId: string, requestedBusinessId: string | null) => {
  if (requestedBusinessId) {
    const { data } = await (supabase as any)
      .from("businesses")
      .select("id")
      .eq("id", requestedBusinessId)
      .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
      .eq("launch_access", true)
      .maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await (supabase as any)
    .from("businesses")
    .select("id")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
};

const isSecretAuthorized = (request: Request) => {
  const secret = request.headers.get("x-error-ingest-secret");
  return Boolean(secret && process.env.ERROR_INGEST_SECRET && secret === process.env.ERROR_INGEST_SECRET);
};

const sanitizeMessage = (value: string) => value.trim().slice(0, 8000);

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as IngestPayload | null;
  if (!payload || typeof payload.message !== "string" || !payload.message.trim()) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const secretAuthorized = isSecretAuthorized(request);
  const routeClient = getSupabaseRouteClient();
  const admin = getSupabaseAdminClient();

  let userId: string | null = null;
  let businessId: string | null = null;

  if (!secretAuthorized) {
    const {
      data: { user }
    } = await routeClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    userId = user.id;
    businessId = await resolveOwnedBusiness(routeClient, user.id, payload.business_id ?? null);
  } else {
    businessId = payload.business_id ?? null;
  }

  const message = sanitizeMessage(payload.message);
  const stack = typeof payload.stack === "string" ? payload.stack.slice(0, 12000) : null;
  const route = typeof payload.route === "string" ? payload.route.slice(0, 1200) : null;
  const fingerprint = computeErrorFingerprint({ message, stack, route });
  const severity = VALID_SEVERITY.has(payload.severity ?? "") ? payload.severity! : "error";
  const environment = VALID_ENV.has(payload.environment ?? "") ? payload.environment! : "prod";
  const source = (payload.source ?? "client").trim().slice(0, 64) || "client";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const throttleIdentity = userId ?? ip;
  const throttleKey = `${throttleIdentity}:${fingerprint}`;
  const nowMs = Date.now();
  const lastSeenMs = recentIngestByKey.get(throttleKey) ?? 0;
  if (nowMs - lastSeenMs < DUPLICATE_WINDOW_MS) {
    return NextResponse.json(
      {
        fingerprint,
        deduped: true
      },
      { status: 202 }
    );
  }
  recentIngestByKey.set(throttleKey, nowMs);
  if (recentIngestByKey.size > 5000) {
    for (const [key, seenAt] of recentIngestByKey.entries()) {
      if (nowMs - seenAt > 60_000) {
        recentIngestByKey.delete(key);
      }
    }
  }

  const { data: insertedEvent, error: eventError } = await (admin as any)
    .from("error_events")
    .insert({
      source,
      environment,
      severity,
      fingerprint,
      message,
      stack,
      route,
      url: payload.url?.slice(0, 2000) ?? null,
      user_agent: payload.user_agent?.slice(0, 1200) ?? null,
      business_id: businessId,
      user_id: userId,
      meta: payload.meta ?? {}
    })
    .select("id, created_at, business_id")
    .single();

  if (eventError) {
    return NextResponse.json({ error: eventError.message ?? "Failed to ingest error event." }, { status: 400 });
  }

  const { data: existingGroup } = await (admin as any)
    .from("error_groups")
    .select("fingerprint, occurrences, status, linked_feedback_id, sample_stack, sample_route, sample_message")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let nextOccurrences = (existingGroup?.occurrences ?? 0) + 1;

  if (!existingGroup) {
    const { error: insertGroupError } = await (admin as any).from("error_groups").insert({
      fingerprint,
      occurrences: 1,
      status: "open",
      title: firstMessageLine(message).slice(0, 200),
      sample_message: firstMessageLine(message).slice(0, 2000),
      sample_stack: stackTopLines(stack, 10),
      sample_route: route
    });
    if (insertGroupError) {
      return NextResponse.json({ error: insertGroupError.message ?? "Failed to create error group." }, { status: 400 });
    }
    nextOccurrences = 1;
  } else {
    const { error: updateGroupError } = await (admin as any)
      .from("error_groups")
      .update({
        occurrences: nextOccurrences,
        last_seen_at: new Date().toISOString(),
        sample_message: existingGroup.sample_message || firstMessageLine(message).slice(0, 2000),
        sample_stack: existingGroup.sample_stack || stackTopLines(stack, 10),
        sample_route: existingGroup.sample_route || route
      })
      .eq("fingerprint", fingerprint);

    if (updateGroupError) {
      return NextResponse.json({ error: updateGroupError.message ?? "Failed to update error group." }, { status: 400 });
    }
  }

  let autoCreatedFeedbackId: string | null = null;
  let hot = false;

  const last24Iso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: recentCount }, { data: groupNow }] = await Promise.all([
    (admin as any)
      .from("error_events")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint", fingerprint)
      .gte("created_at", last24Iso),
    (admin as any)
      .from("error_groups")
      .select("fingerprint, status, linked_feedback_id")
      .eq("fingerprint", fingerprint)
      .maybeSingle()
  ]);

  const recentOccurrences = recentCount ?? 0;
  hot = recentOccurrences >= HOT_THRESHOLD;

  if (hot && groupNow && groupNow.status === "open" && !groupNow.linked_feedback_id) {
    const importance = severityToFeedbackImportance(severity as any);
    const title = firstMessageLine(message).slice(0, 80);
    const descriptionParts = [
      `Auto-created from hot error group fingerprint=${fingerprint}`,
      route ? `Route: ${route}` : null,
      stack ? `Stack:\n${stackTopLines(stack, 20)}` : null
    ].filter(Boolean);

    const { data: feedback, error: feedbackError } = await (admin as any)
      .from("feedback_reports")
      .insert({
        status: "open",
        triage_status: "new",
        category: "bug",
        importance,
        title,
        description: descriptionParts.join("\n\n"),
        business_id: businessId,
        user_id: userId,
        url: payload.url ?? null,
        browser_info: payload.user_agent ?? null,
        admin_notes: `Auto-created from error group fingerprint=${fingerprint}`
      })
      .select("id")
      .maybeSingle();

    if (!feedbackError && feedback?.id) {
      autoCreatedFeedbackId = feedback.id;
      await (admin as any).from("error_groups").update({ linked_feedback_id: feedback.id }).eq("fingerprint", fingerprint);

      if (businessId) {
        await logActivity({
          businessId,
          userId,
          actorType: "system",
          eventType: "error_hot_group_auto_created",
          summary: `Auto-created feedback report from hot error group (${title})`,
          meta: {
            fingerprint,
            feedback_report_id: feedback.id,
            recent_occurrences_24h: recentOccurrences
          }
        });
      }
    }
  }

  return NextResponse.json(
    {
      event_id: insertedEvent.id,
      fingerprint,
      occurrences: nextOccurrences,
      hot,
      auto_created_feedback_id: autoCreatedFeedbackId
    },
    { status: 201 }
  );
}
