"use client";

import { useEffect, useRef, useState } from "react";
import { ImpactSummaryModal } from "@/components/impact/ImpactSummaryModal";

type Period = "weekly" | "monthly";

type Highlight = {
  key: string;
  title: string;
  value: string;
  subtext?: string;
  emoji?: string;
  tone?: "success" | "info" | "warning";
  cta?: { label: string; href: string };
};

type ImpactSummary = {
  id: string;
  period: Period;
  period_start: string;
  period_end: string;
  metrics?: Record<string, unknown> | null;
  highlights?: Highlight[] | null;
  shown_at?: string | null;
};

const PERIOD_DAYS: Record<Period, number> = {
  weekly: 7,
  monthly: 30
};

const isSummaryStale = (summary: ImpactSummary, days: number) => {
  if (!summary.period_end) return true;
  const end = new Date(summary.period_end);
  if (Number.isNaN(end.getTime())) return true;
  const maxAgeMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - end.getTime() >= maxAgeMs;
};

const fetchLatest = async (period: Period) => {
  const res = await fetch(`/api/impact/latest?period=${period}`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) return null;
  return (payload?.summary ?? null) as ImpactSummary | null;
};

const computeSummary = async (period: Period) => {
  const res = await fetch("/api/impact/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ period })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.summaryId) return null;
  return {
    id: payload.summaryId as string,
    period,
    period_start: payload.period_start as string,
    period_end: payload.period_end as string,
    metrics: payload.metrics ?? null,
    highlights: payload.highlights ?? null,
    shown_at: null
  } as ImpactSummary;
};

export function ImpactSummaryGate() {
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const load = async () => {
      const monthly = await fetchLatest("monthly");
      const monthlyStale = monthly ? isSummaryStale(monthly, PERIOD_DAYS.monthly) : true;
      if (!monthly || monthlyStale) {
        const computed = await computeSummary("monthly");
        if (computed) {
          setSummary(computed);
          setOpen(true);
          return;
        }
      } else if (!monthly.shown_at) {
        setSummary(monthly);
        setOpen(true);
        return;
      }

      const weekly = await fetchLatest("weekly");
      const weeklyStale = weekly ? isSummaryStale(weekly, PERIOD_DAYS.weekly) : true;
      if (!weekly || weeklyStale) {
        const computed = await computeSummary("weekly");
        if (computed) {
          setSummary(computed);
          setOpen(true);
        }
      } else if (!weekly.shown_at) {
        setSummary(weekly);
        setOpen(true);
      }
    };

    void load();
  }, []);

  const markShown = async () => {
    if (!summary?.id) return;
    await fetch("/api/impact/mark-shown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryId: summary.id })
    });
  };

  const handleClose = () => {
    setOpen(false);
  };

  return <ImpactSummaryModal open={open} summary={summary} onClose={handleClose} onMarkShown={markShown} />;
}
