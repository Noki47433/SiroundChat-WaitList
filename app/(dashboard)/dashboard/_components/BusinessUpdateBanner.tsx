"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Announcement = {
  id: string;
  emoji: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string;
  is_dismissible: boolean;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
};

export function BusinessUpdateBanner({ businessId }: { businessId?: string }) {
  const { push } = useToast();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAnnouncement = useCallback(async () => {
    setLoading(true);
    try {
      const query = businessId ? `?business_id=${encodeURIComponent(businessId)}` : "";
      const response = await fetch(`/api/announcements/current${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Failed to load announcement.");
      }
      setAnnouncement(payload.announcement ?? null);
      setHidden(false);
    } catch {
      setAnnouncement(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadAnnouncement();
  }, [loadAnnouncement]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadAnnouncement();
    }, 20000);
    return () => clearInterval(interval);
  }, [loadAnnouncement]);

  const publishedLabel = useMemo(() => (announcement ? formatDate(announcement.starts_at) : ""), [announcement]);

  const dismiss = async () => {
    if (!announcement || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/announcements/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_id: announcement.id,
          business_id: businessId ?? null
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to dismiss announcement.");
      }
      setHidden(true);
    } catch (error) {
      push({
        title: "Unable to dismiss announcement",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !announcement || hidden) return null;

  return (
    <div className="rounded-2xl border border-sky-400/35 bg-sky-500/10 p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-sky-100/80">Announcement</p>
          <h3 className="mt-1 text-sm font-semibold">
            <span className="mr-1">{announcement.emoji}</span>
            {announcement.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-sky-50/90">{announcement.body}</p>
          <p className="mt-2 text-[11px] text-sky-100/70">Published {publishedLabel}</p>
        </div>
        {announcement.is_dismissible ? (
          <button
            type="button"
            onClick={() => void dismiss()}
            className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/85 hover:bg-white/10"
            disabled={busy}
          >
            Dismiss
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {announcement.cta_label && announcement.cta_url ? (
          <Link
            href={announcement.cta_url}
            className="inline-flex h-8 items-center rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
            onClick={() => void dismiss()}
          >
            {announcement.cta_label}
          </Link>
        ) : null}
        <Button size="xs" variant="secondary" onClick={() => void dismiss()} disabled={busy}>
          Mark read
        </Button>
      </div>
    </div>
  );
}

