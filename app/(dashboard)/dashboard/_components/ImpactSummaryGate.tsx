"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WrappedModal } from "@/components/wrapped/WrappedModal";
import type { WrappedPostAction } from "@/components/wrapped/types";

type Period = "weekly" | "monthly";

type ImpactSummary = {
  id: string;
  period: Period;
  period_end: string;
  shown_at?: string | null;
};

type ImpactSummaryGateProps = {
  businessId: string;
  eligiblePeriods: Period[];
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
    period_end: payload.period_end as string,
    shown_at: null
  } as ImpactSummary;
};

export function ImpactSummaryGate({ businessId, eligiblePeriods }: ImpactSummaryGateProps) {
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Period>("weekly");
  const initialized = useRef(false);
  const router = useRouter();

  const handlePostAction = (action: WrappedPostAction) => {
    switch (action.type) {
      case "leads":
        router.push("/dashboard/leads");
        break;
      case "reservations":
        router.push("/dashboard/reservations");
        break;
      case "conversations":
        router.push("/dashboard/conversations");
        break;
      case "conversation":
        router.push(`/dashboard/conversations/${action.id}`);
        break;
      case "analytics":
      case "impact-details":
        router.push("/dashboard/analytics");
        break;
      case "settings":
        router.push("/dashboard/settings");
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!businessId) return;
    if (!eligiblePeriods.length) return;
    if (initialized.current) return;
    initialized.current = true;

    const load = async () => {
      if (eligiblePeriods.includes("monthly")) {
        const monthly = await fetchLatest("monthly");
        const monthlyStale = monthly ? isSummaryStale(monthly, PERIOD_DAYS.monthly) : true;
        if (!monthly || monthlyStale) {
          const computed = await computeSummary("monthly");
          if (computed) {
            setSummary(computed);
            setMode("monthly");
            setOpen(true);
            return;
          }
        } else if (!monthly.shown_at) {
          setSummary(monthly);
          setMode("monthly");
          setOpen(true);
          return;
        }
      }

      if (!eligiblePeriods.includes("weekly")) {
        return;
      }

      const weekly = await fetchLatest("weekly");
      const weeklyStale = weekly ? isSummaryStale(weekly, PERIOD_DAYS.weekly) : true;
      if (!weekly || weeklyStale) {
        const computed = await computeSummary("weekly");
        if (computed) {
          setSummary(computed);
          setMode("weekly");
          setOpen(true);
        }
      } else if (!weekly.shown_at) {
        setSummary(weekly);
        setMode("weekly");
        setOpen(true);
      }
    };

    void load();
  }, [businessId, eligiblePeriods]);

  const markShown = async () => {
    if (!summary?.id) return;
    await fetch("/api/impact/mark-shown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryId: summary.id })
    });
  };

  const handleClose = (action?: WrappedPostAction) => {
    setOpen(false);
    void markShown();
    if (action) {
      handlePostAction(action);
    }
  };

  return <WrappedModal open={open} mode={mode} businessId={businessId} onClose={handleClose} />;
}
