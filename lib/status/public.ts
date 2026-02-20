import { getSupabasePublicClient } from "@/lib/supabase/server";

export type StatusComponent = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type StatusIncident = {
  id: string;
  started_at: string;
  resolved_at: string | null;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  title: string;
  summary: string;
};

export type StatusIncidentComponent = {
  incident_id: string;
  component_id: string;
  impact: "degraded" | "partial_outage" | "major_outage";
};

export type StatusUpdate = {
  id: string;
  incident_id: string;
  created_at: string;
  message: string;
};

export type PublicStatusPayload = {
  components: StatusComponent[];
  incidents: StatusIncident[];
  incidentComponents: StatusIncidentComponent[];
  updates: StatusUpdate[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_30_DAYS_MINUTES = 30 * 24 * 60;

const impactRank: Record<StatusIncidentComponent["impact"], number> = {
  degraded: 1,
  partial_outage: 2,
  major_outage: 3
};

export const loadPublicStatusPayload = async (): Promise<PublicStatusPayload> => {
  const supabase = getSupabasePublicClient();
  const nowIso = new Date().toISOString();
  const past30Iso = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [componentsResult, incidentsResult, linksResult, updatesResult] = await Promise.all([
    (supabase as any).from("system_components").select("id, key, name, description, sort_order").eq("is_public", true).order("sort_order"),
    (supabase as any)
      .from("status_incidents")
      .select("id, started_at, resolved_at, status, severity, title, summary")
      .eq("is_public", true)
      .or(`resolved_at.gte.${past30Iso},resolved_at.is.null`)
      .lte("started_at", nowIso)
      .order("started_at", { ascending: false }),
    (supabase as any).from("status_incident_components").select("incident_id, component_id, impact"),
    (supabase as any).from("status_updates").select("id, incident_id, created_at, message").order("created_at", { ascending: true })
  ]);

  return {
    components: (componentsResult.data ?? []) as StatusComponent[],
    incidents: (incidentsResult.data ?? []) as StatusIncident[],
    incidentComponents: (linksResult.data ?? []) as StatusIncidentComponent[],
    updates: (updatesResult.data ?? []) as StatusUpdate[]
  };
};

export const computeComponentStatus = (
  componentId: string,
  activeIncidentIds: Set<string>,
  links: StatusIncidentComponent[]
) => {
  let activeImpact: StatusIncidentComponent["impact"] | null = null;
  for (const link of links) {
    if (link.component_id !== componentId) continue;
    if (!activeIncidentIds.has(link.incident_id)) continue;
    if (!activeImpact || impactRank[link.impact] > impactRank[activeImpact]) {
      activeImpact = link.impact;
    }
  }

  if (!activeImpact) {
    return { label: "Operational", tone: "success" as const };
  }
  if (activeImpact === "major_outage") {
    return { label: "Major outage", tone: "warning" as const };
  }
  if (activeImpact === "partial_outage") {
    return { label: "Partial outage", tone: "warning" as const };
  }
  return { label: "Degraded", tone: "info" as const };
};

export const calculateUptimePercent30d = (
  componentId: string,
  incidents: StatusIncident[],
  links: StatusIncidentComponent[],
  now = new Date()
) => {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - 30 * DAY_MS;
  let downtimeMinutes = 0;

  for (const incident of incidents) {
    if (!incident.resolved_at) continue;
    const hasLink = links.some((link) => link.component_id === componentId && link.incident_id === incident.id);
    if (!hasLink) continue;

    const startedMs = new Date(incident.started_at).getTime();
    const resolvedMs = new Date(incident.resolved_at).getTime();
    if (!Number.isFinite(startedMs) || !Number.isFinite(resolvedMs)) continue;

    const start = Math.max(startedMs, windowStartMs);
    const end = Math.min(resolvedMs, nowMs);
    if (end <= start) continue;

    downtimeMinutes += (end - start) / (1000 * 60);
  }

  const uptime = ((RANGE_30_DAYS_MINUTES - downtimeMinutes) / RANGE_30_DAYS_MINUTES) * 100;
  return Math.max(0, Math.min(100, uptime));
};

export const computeOverallStatus = (
  components: StatusComponent[],
  activeIncidentIds: Set<string>,
  links: StatusIncidentComponent[]
) => {
  let maxRank = 0;
  for (const component of components) {
    const status = computeComponentStatus(component.id, activeIncidentIds, links).label;
    if (status === "Major outage") maxRank = Math.max(maxRank, 3);
    if (status === "Partial outage") maxRank = Math.max(maxRank, 2);
    if (status === "Degraded") maxRank = Math.max(maxRank, 1);
  }

  if (maxRank === 0) return "All Systems Operational";
  if (maxRank === 3) return "Major Service Outage";
  return "Degraded Performance";
};

