"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ANNOUNCEMENT_PRESETS, type AnnouncementPresetKey } from "@/lib/announcements/presets";

type AnnouncementRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "scheduled" | "published" | "archived";
  audience: "all" | "business";
  business_id: string | null;
  emoji: string;
  preset: AnnouncementPresetKey;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_dismissible: boolean;
};

type BusinessOption = {
  id: string;
  name: string;
};

const formatDateTimeLocal = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (value: string) => {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export function AdminAnnouncementsClient({
  initialAnnouncements,
  businesses
}: {
  initialAnnouncements: AnnouncementRow[];
  businesses: BusinessOption[];
}) {
  const { push } = useToast();
  const [rows, setRows] = useState(initialAnnouncements);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    status: "draft",
    audience: "all",
    business_id: "",
    preset: "custom" as AnnouncementPresetKey,
    emoji: "📣",
    title: "",
    body: "",
    cta_label: "",
    cta_url: "",
    starts_at: formatDateTimeLocal(new Date().toISOString()),
    ends_at: "",
    is_dismissible: true
  });

  const businessMap = useMemo(() => new Map(businesses.map((business) => [business.id, business.name])), [businesses]);

  const refresh = async () => {
    const response = await fetch("/api/admin/announcements", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Failed to load announcements.");
    setRows(payload.announcements ?? []);
  };

  const applyPreset = (preset: AnnouncementPresetKey) => {
    const template = ANNOUNCEMENT_PRESETS[preset] ?? ANNOUNCEMENT_PRESETS.custom;
    setForm((prev) => ({
      ...prev,
      preset,
      emoji: template.emoji,
      title: template.title || prev.title,
      body: template.body || prev.body
    }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          audience: form.audience,
          business_id: form.audience === "business" ? form.business_id : null,
          emoji: form.emoji,
          preset: form.preset,
          title: form.title,
          body: form.body,
          cta_label: form.cta_label || null,
          cta_url: form.cta_url || null,
          starts_at: toIsoOrNull(form.starts_at),
          ends_at: toIsoOrNull(form.ends_at),
          is_dismissible: form.is_dismissible
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create announcement.");
      await refresh();
      push({ title: "Announcement created", variant: "success" });
      setForm({
        status: "draft",
        audience: "all",
        business_id: "",
        preset: "custom",
        emoji: "📣",
        title: "",
        body: "",
        cta_label: "",
        cta_url: "",
        starts_at: formatDateTimeLocal(new Date().toISOString()),
        ends_at: "",
        is_dismissible: true
      });
    } catch (error) {
      push({ title: "Create failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: AnnouncementRow["status"]) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update announcement.");
      await refresh();
      push({ title: "Announcement updated", variant: "success" });
    } catch (error) {
      push({ title: "Update failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard accent="blue">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">In-app announcements</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Announcements</h1>
        <p className="mt-1 text-sm text-white/65">Create targeted in-app updates for all businesses or one business.</p>
      </GlassCard>

      <GlassCard accent="green" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Create announcement</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={form.audience}
            onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
          >
            <option value="all">Everyone</option>
            <option value="business">One business</option>
          </select>
          {form.audience === "business" ? (
            <select
              className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
              value={form.business_id}
              onChange={(event) => setForm((prev) => ({ ...prev, business_id: event.target.value }))}
            >
              <option value="">Select business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={form.preset}
            onChange={(event) => applyPreset(event.target.value as AnnouncementPresetKey)}
          >
            <option value="custom">Custom</option>
            <option value="feature">Feature</option>
            <option value="maintenance">Maintenance</option>
            <option value="tips">Tips</option>
            <option value="promo">Promo</option>
            <option value="alert">Alert</option>
          </select>
          <Input value={form.emoji} onChange={(event) => setForm((prev) => ({ ...prev, emoji: event.target.value.slice(0, 2) }))} placeholder="Emoji" />
          <Input
            type="datetime-local"
            value={form.starts_at}
            onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
          />
          <Input
            type="datetime-local"
            value={form.ends_at}
            onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
          />
        </div>

        <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" />
        <Textarea value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} placeholder="Body" rows={4} />

        <div className="grid gap-2 md:grid-cols-2">
          <Input value={form.cta_label} onChange={(event) => setForm((prev) => ({ ...prev, cta_label: event.target.value }))} placeholder="CTA label (optional)" />
          <Input value={form.cta_url} onChange={(event) => setForm((prev) => ({ ...prev, cta_url: event.target.value }))} placeholder="CTA URL (optional)" />
        </div>

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={form.is_dismissible}
            onChange={(event) => setForm((prev) => ({ ...prev, is_dismissible: event.target.checked }))}
          />
          Dismissible
        </label>

        <Button onClick={submit} disabled={busy}>
          Create announcement
        </Button>
      </GlassCard>

      <GlassCard accent="none" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Recent announcements</h2>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    {row.emoji} {row.title}
                  </p>
                  <p className="text-xs text-white/55">
                    {row.audience === "all" ? "Everyone" : businessMap.get(row.business_id ?? "") ?? "Business"} · starts{" "}
                    {new Date(row.starts_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={row.status === "published" ? "success" : row.status === "archived" ? "default" : "info"}>
                    {row.status}
                  </Badge>
                  {row.status !== "published" ? (
                    <Button size="xs" variant="secondary" disabled={busy} onClick={() => void updateStatus(row.id, "published")}>
                      Publish
                    </Button>
                  ) : null}
                  {row.status !== "archived" ? (
                    <Button size="xs" variant="outline" disabled={busy} onClick={() => void updateStatus(row.id, "archived")}>
                      Archive
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-white/75">{row.body}</p>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-white/60">No announcements yet.</p> : null}
        </div>
      </GlassCard>
    </div>
  );
}

