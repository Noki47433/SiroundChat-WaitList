import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  calculateUptimePercent30d,
  computeComponentStatus,
  computeOverallStatus,
  loadPublicStatusPayload
} from "@/lib/status/public";

export const dynamic = "force-dynamic";

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const severityVariant = (severity: string): "warning" | "info" | "default" => {
  if (severity === "critical" || severity === "major") return "warning";
  if (severity === "minor") return "info";
  return "default";
};

const statusVariant = (status: string): "warning" | "info" | "success" | "default" => {
  if (status === "investigating" || status === "identified") return "warning";
  if (status === "monitoring") return "info";
  if (status === "resolved") return "success";
  return "default";
};

export default async function StatusPage() {
  const { components, incidents, incidentComponents, updates } = await loadPublicStatusPayload();
  const activeIncidents = incidents.filter((incident) => incident.resolved_at === null);
  const pastIncidents = incidents.filter((incident) => incident.resolved_at !== null);
  const activeIncidentIds = new Set(activeIncidents.map((incident) => incident.id));
  const overall = computeOverallStatus(components, activeIncidentIds, incidentComponents);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-white sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Trust center</p>
        <h1 className="text-3xl font-semibold">System Status</h1>
        <p className="text-sm text-white/70">Current platform health, incident updates, and recent reliability history.</p>
      </header>

      <Card className="border-emerald-400/20 bg-emerald-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Overall status</p>
            <h2 className="mt-1 text-2xl font-semibold text-emerald-50">{overall}</h2>
          </div>
          <Badge variant={overall === "All Systems Operational" ? "success" : "warning"}>{overall}</Badge>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Components</h2>
        <div className="mt-4 space-y-3">
          {components.map((component) => {
            const state = computeComponentStatus(component.id, activeIncidentIds, incidentComponents);
            const uptime = calculateUptimePercent30d(component.id, incidents, incidentComponents);
            return (
              <div key={component.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-medium">{component.name}</p>
                  {component.description ? <p className="text-xs text-white/60">{component.description}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-white/60">{uptime.toFixed(2)}% uptime (30d)</p>
                  <Badge variant={state.tone}>{state.label}</Badge>
                </div>
              </div>
            );
          })}
          {!components.length ? <p className="text-sm text-white/60">No components configured yet.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Active incidents</h2>
        <div className="mt-4 space-y-4">
          {activeIncidents.map((incident) => {
            const incidentUpdates = updates.filter((update) => update.incident_id === incident.id);
            return (
              <div key={incident.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
                  <Badge variant={statusVariant(incident.status)}>{incident.status}</Badge>
                </div>
                <h3 className="mt-2 text-base font-semibold">{incident.title}</h3>
                <p className="mt-1 text-sm text-white/75">{incident.summary}</p>
                <p className="mt-2 text-xs text-white/50">Started {formatDateTime(incident.started_at)}</p>
                {incidentUpdates.length ? (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {incidentUpdates.map((update) => (
                      <div key={update.id}>
                        <p className="text-xs text-white/50">{formatDateTime(update.created_at)}</p>
                        <p className="text-sm text-white/80">{update.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!activeIncidents.length ? <p className="text-sm text-white/60">No active incidents.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Past incidents (30 days)</h2>
        <div className="mt-4 space-y-3">
          {pastIncidents.slice(0, 20).map((incident) => {
            const incidentUpdates = updates.filter((update) => update.incident_id === incident.id);
            return (
              <details key={incident.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{incident.title}</p>
                      <p className="text-xs text-white/50">
                        {formatDateTime(incident.started_at)} to {incident.resolved_at ? formatDateTime(incident.resolved_at) : "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
                      <Badge variant="success">resolved</Badge>
                    </div>
                  </div>
                </summary>
                <p className="mt-2 text-sm text-white/75">{incident.summary}</p>
                {incidentUpdates.length ? (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {incidentUpdates.map((update) => (
                      <div key={update.id}>
                        <p className="text-xs text-white/50">{formatDateTime(update.created_at)}</p>
                        <p className="text-sm text-white/80">{update.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </details>
            );
          })}
          {!pastIncidents.length ? <p className="text-sm text-white/60">No incidents in the last 30 days.</p> : null}
        </div>
      </Card>
    </div>
  );
}

