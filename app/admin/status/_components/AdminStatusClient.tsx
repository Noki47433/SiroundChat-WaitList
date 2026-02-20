"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type StatusData = {
  components: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_public: boolean;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    summary: string;
    severity: "minor" | "major" | "critical";
    status: "investigating" | "identified" | "monitoring" | "resolved";
    started_at: string;
    resolved_at: string | null;
    is_public: boolean;
  }>;
  incident_components: Array<{
    incident_id: string;
    component_id: string;
    impact: "degraded" | "partial_outage" | "major_outage";
  }>;
  updates: Array<{
    id: string;
    incident_id: string;
    created_at: string;
    message: string;
  }>;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
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

export function AdminStatusClient({ initialData }: { initialData: StatusData }) {
  const { push } = useToast();
  const [data, setData] = useState(initialData);
  const [componentForm, setComponentForm] = useState({
    key: "",
    name: "",
    description: "",
    sort_order: 0
  });
  const [incidentForm, setIncidentForm] = useState({
    title: "",
    summary: "",
    severity: "minor",
    status: "investigating",
    impact: "degraded",
    initial_update: ""
  });
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const incidentComponentLabels = useMemo(() => {
    const componentMap = new Map(data.components.map((component) => [component.id, component.name]));
    const byIncident = new Map<string, string[]>();
    for (const link of data.incident_components) {
      const label = componentMap.get(link.component_id) ?? "Unknown";
      const current = byIncident.get(link.incident_id) ?? [];
      current.push(`${label} (${link.impact.replace("_", " ")})`);
      byIncident.set(link.incident_id, current);
    }
    return byIncident;
  }, [data.components, data.incident_components]);

  const updatesByIncident = useMemo(() => {
    const map = new Map<string, Array<{ id: string; created_at: string; message: string }>>();
    for (const update of data.updates) {
      const current = map.get(update.incident_id) ?? [];
      current.push(update);
      map.set(update.incident_id, current);
    }
    return map;
  }, [data.updates]);

  const reload = async () => {
    const response = await fetch("/api/admin/status", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Failed to refresh status data.");
    setData(payload);
  };

  const createComponent = async () => {
    if (!componentForm.key.trim() || !componentForm.name.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_component",
          key: componentForm.key.trim(),
          name: componentForm.name.trim(),
          description: componentForm.description.trim() || null,
          sort_order: componentForm.sort_order
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create component.");
      setComponentForm({ key: "", name: "", description: "", sort_order: 0 });
      await reload();
      push({ title: "Component created", variant: "success" });
    } catch (error) {
      push({ title: "Create failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createIncident = async () => {
    if (!incidentForm.title.trim() || !incidentForm.summary.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_incident",
          title: incidentForm.title.trim(),
          summary: incidentForm.summary.trim(),
          severity: incidentForm.severity,
          status: incidentForm.status,
          components: selectedComponents.map((componentId) => ({
            component_id: componentId,
            impact: incidentForm.impact
          })),
          initial_update: incidentForm.initial_update.trim() || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create incident.");
      setIncidentForm({
        title: "",
        summary: "",
        severity: "minor",
        status: "investigating",
        impact: "degraded",
        initial_update: ""
      });
      setSelectedComponents([]);
      await reload();
      push({ title: "Incident created", variant: "success" });
    } catch (error) {
      push({ title: "Create failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const resolveIncident = async (incidentId: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_incident", id: incidentId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to resolve incident.");
      await reload();
      push({ title: "Incident resolved", variant: "success" });
    } catch (error) {
      push({ title: "Update failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const addUpdate = async (incidentId: string) => {
    const message = window.prompt("Update message");
    if (!message?.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_update", incident_id: incidentId, message: message.trim() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to add update.");
      await reload();
      push({ title: "Update posted", variant: "success" });
    } catch (error) {
      push({ title: "Update failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard accent="blue">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Status management</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Status incidents</h1>
        <p className="mt-1 text-sm text-white/65">Manage public components, incidents, and timeline updates.</p>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard accent="green" className="space-y-3">
          <h2 className="text-lg font-semibold text-white">New component</h2>
          <Input
            value={componentForm.key}
            onChange={(event) => setComponentForm((prev) => ({ ...prev, key: event.target.value }))}
            placeholder="key (api, dashboard)"
          />
          <Input
            value={componentForm.name}
            onChange={(event) => setComponentForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Display name"
          />
          <Textarea
            value={componentForm.description}
            onChange={(event) => setComponentForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description (optional)"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={componentForm.sort_order}
              onChange={(event) => setComponentForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
              placeholder="Sort order"
            />
            <Button onClick={createComponent} disabled={busy}>
              Create
            </Button>
          </div>
        </GlassCard>

        <GlassCard accent="warning" className="space-y-3">
          <h2 className="text-lg font-semibold text-white">New incident</h2>
          <Input
            value={incidentForm.title}
            onChange={(event) => setIncidentForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Incident title"
          />
          <Textarea
            value={incidentForm.summary}
            onChange={(event) => setIncidentForm((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder="Incident summary"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={incidentForm.severity}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, severity: event.target.value }))}
              className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={incidentForm.status}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={incidentForm.impact}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, impact: event.target.value }))}
              className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            >
              <option value="degraded">Degraded</option>
              <option value="partial_outage">Partial outage</option>
              <option value="major_outage">Major outage</option>
            </select>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">Affected components</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.components.map((component) => (
                <label key={component.id} className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={selectedComponents.includes(component.id)}
                    onChange={(event) => {
                      setSelectedComponents((prev) =>
                        event.target.checked ? [...prev, component.id] : prev.filter((id) => id !== component.id)
                      );
                    }}
                  />
                  {component.name}
                </label>
              ))}
            </div>
          </div>
          <Textarea
            value={incidentForm.initial_update}
            onChange={(event) => setIncidentForm((prev) => ({ ...prev, initial_update: event.target.value }))}
            placeholder="Initial timeline update (optional)"
          />
          <Button onClick={createIncident} disabled={busy}>
            Create incident
          </Button>
        </GlassCard>
      </div>

      <GlassCard accent="none" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Components</h2>
        <div className="space-y-2">
          {data.components.map((component) => (
            <div key={component.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <p className="text-sm font-medium text-white">{component.name}</p>
                <p className="text-xs text-white/55">
                  {component.key} · order {component.sort_order}
                </p>
              </div>
              <Badge variant={component.is_public ? "success" : "default"}>{component.is_public ? "public" : "private"}</Badge>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard accent="danger" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Incidents</h2>
        <div className="space-y-3">
          {data.incidents.map((incident) => (
            <div key={incident.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{incident.title}</p>
                  <p className="mt-1 text-xs text-white/55">
                    {formatDateTime(incident.started_at)} {incident.resolved_at ? `→ ${formatDateTime(incident.resolved_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={incident.severity === "critical" || incident.severity === "major" ? "warning" : "info"}>
                    {incident.severity}
                  </Badge>
                  <Badge variant={incident.status === "resolved" ? "success" : "warning"}>{incident.status}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/75">{incident.summary}</p>
              <p className="mt-2 text-xs text-white/60">
                {(incidentComponentLabels.get(incident.id) ?? []).join(", ") || "No component links"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="xs" variant="secondary" disabled={busy} onClick={() => void addUpdate(incident.id)}>
                  Add update
                </Button>
                {incident.status !== "resolved" ? (
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => void resolveIncident(incident.id)}>
                    Resolve
                  </Button>
                ) : null}
                <span className="text-xs text-white/55">{updatesByIncident.get(incident.id)?.length ?? 0} updates</span>
              </div>
            </div>
          ))}
          {!data.incidents.length ? <p className="text-sm text-white/60">No incidents yet.</p> : null}
        </div>
      </GlassCard>
    </div>
  );
}

