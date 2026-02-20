import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_IMPACTS = new Set(["degraded", "partial_outage", "major_outage"]);
const VALID_INCIDENT_STATUS = new Set(["investigating", "identified", "monitoring", "resolved"]);
const VALID_SEVERITIES = new Set(["minor", "major", "critical"]);

export async function GET() {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const [componentsResult, incidentsResult, linksResult, updatesResult] = await Promise.all([
    (guard.supabase as any).from("system_components").select("*").order("sort_order", { ascending: true }),
    (guard.supabase as any).from("status_incidents").select("*").order("started_at", { ascending: false }).limit(200),
    (guard.supabase as any).from("status_incident_components").select("*"),
    (guard.supabase as any).from("status_updates").select("*").order("created_at", { ascending: false }).limit(500)
  ]);

  if (componentsResult.error || incidentsResult.error || linksResult.error || updatesResult.error) {
    return NextResponse.json(
      {
        error:
          componentsResult.error?.message ??
          incidentsResult.error?.message ??
          linksResult.error?.message ??
          updatesResult.error?.message ??
          "Failed to load status data."
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      components: componentsResult.data ?? [],
      incidents: incidentsResult.data ?? [],
      incident_components: linksResult.data ?? [],
      updates: updatesResult.data ?? []
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as
    | {
        action?: "create_component";
        key?: string;
        name?: string;
        description?: string | null;
        is_public?: boolean;
        sort_order?: number;
      }
    | {
        action?: "create_incident";
        title?: string;
        summary?: string;
        severity?: string;
        status?: string;
        started_at?: string;
        is_public?: boolean;
        components?: Array<{ component_id: string; impact: string }>;
        initial_update?: string | null;
      }
    | {
        action?: "add_update";
        incident_id?: string;
        message?: string;
      }
    | null;

  if (body?.action === "create_component") {
    const key = body.key?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? "";
    if (!key || !name) {
      return NextResponse.json({ error: "key and name are required." }, { status: 400 });
    }

    const { data, error } = await (guard.supabase as any)
      .from("system_components")
      .insert({
        key,
        name,
        description: body.description?.trim() || null,
        is_public: body.is_public ?? true,
        sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to create component." }, { status: 400 });
    }

    return NextResponse.json({ component: data }, { status: 201 });
  }

  if (body?.action === "create_incident") {
    const title = body.title?.trim() ?? "";
    const summary = body.summary?.trim() ?? "";
    const severity = (body.severity ?? "minor").trim();
    const status = (body.status ?? "investigating").trim();
    const components = Array.isArray(body.components) ? body.components : [];

    if (!title || !summary) {
      return NextResponse.json({ error: "title and summary are required." }, { status: 400 });
    }
    if (!VALID_SEVERITIES.has(severity)) {
      return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
    }
    if (!VALID_INCIDENT_STATUS.has(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const startedAt = body.started_at ? new Date(body.started_at).toISOString() : new Date().toISOString();

    const { data: incident, error: incidentError } = await (guard.supabase as any)
      .from("status_incidents")
      .insert({
        title,
        summary,
        severity,
        status,
        started_at: startedAt,
        is_public: body.is_public ?? true
      })
      .select("*")
      .single();

    if (incidentError) {
      return NextResponse.json({ error: incidentError.message ?? "Failed to create incident." }, { status: 400 });
    }

    if (components.length) {
      const links = components
        .filter((item) => item.component_id && VALID_IMPACTS.has(item.impact))
        .map((item) => ({
          incident_id: incident.id,
          component_id: item.component_id,
          impact: item.impact
        }));

      if (links.length) {
        await (guard.supabase as any).from("status_incident_components").insert(links);
      }
    }

    if (body.initial_update?.trim()) {
      await (guard.supabase as any).from("status_updates").insert({
        incident_id: incident.id,
        message: body.initial_update.trim()
      });
    }

    return NextResponse.json({ incident }, { status: 201 });
  }

  if (body?.action === "add_update") {
    const incidentId = body.incident_id?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    if (!incidentId || !message) {
      return NextResponse.json({ error: "incident_id and message are required." }, { status: 400 });
    }

    const { data, error } = await (guard.supabase as any)
      .from("status_updates")
      .insert({ incident_id: incidentId, message })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to add incident update." }, { status: 400 });
    }

    return NextResponse.json({ update: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    action?: "update_component" | "update_incident" | "resolve_incident";
    id?: string;
    key?: string;
    name?: string;
    description?: string | null;
    is_public?: boolean;
    sort_order?: number;
    title?: string;
    summary?: string;
    severity?: string;
    status?: string;
    started_at?: string;
    resolved_at?: string | null;
    components?: Array<{ component_id: string; impact: string }>;
  } | null;

  const id = body?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (body?.action === "update_component") {
    const updates: Record<string, unknown> = {};
    if (typeof body.key === "string") updates.key = body.key.trim().toLowerCase();
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.description !== "undefined") updates.description = body.description?.trim() || null;
    if (typeof body.is_public === "boolean") updates.is_public = body.is_public;
    if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

    const { data, error } = await (guard.supabase as any)
      .from("system_components")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to update component." }, { status: 400 });
    }

    return NextResponse.json({ component: data }, { status: 200 });
  }

  if (body?.action === "update_incident" || body?.action === "resolve_incident") {
    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.summary === "string") updates.summary = body.summary.trim();
    if (typeof body.is_public === "boolean") updates.is_public = body.is_public;
    if (typeof body.started_at === "string") updates.started_at = new Date(body.started_at).toISOString();
    if (typeof body.severity === "string") {
      if (!VALID_SEVERITIES.has(body.severity)) {
        return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
      }
      updates.severity = body.severity;
    }
    if (typeof body.status === "string") {
      if (!VALID_INCIDENT_STATUS.has(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.action === "resolve_incident") {
      updates.status = "resolved";
      updates.resolved_at = body.resolved_at ? new Date(body.resolved_at).toISOString() : new Date().toISOString();
    } else if (typeof body.resolved_at !== "undefined") {
      updates.resolved_at = body.resolved_at ? new Date(body.resolved_at).toISOString() : null;
    }

    const { data, error } = await (guard.supabase as any)
      .from("status_incidents")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to update incident." }, { status: 400 });
    }

    if (Array.isArray(body.components)) {
      await (guard.supabase as any).from("status_incident_components").delete().eq("incident_id", id);
      const links = body.components
        .filter((item) => item.component_id && VALID_IMPACTS.has(item.impact))
        .map((item) => ({
          incident_id: id,
          component_id: item.component_id,
          impact: item.impact
        }));
      if (links.length) {
        await (guard.supabase as any).from("status_incident_components").insert(links);
      }
    }

    return NextResponse.json({ incident: data }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

