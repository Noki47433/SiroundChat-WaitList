"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { fireConfetti } from "@/components/notifications/confetti";

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
  period: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  metrics?: Record<string, unknown> | null;
  highlights?: Highlight[] | null;
};

export function ImpactSummaryModal({
  open,
  summary,
  onClose,
  onMarkShown
}: {
  open: boolean;
  summary: ImpactSummary | null;
  onClose: () => void;
  onMarkShown?: () => Promise<void>;
}) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!open || !summary?.id) return;
    if (confettiFired.current) return;
    fireConfetti(summary.id);
    confettiFired.current = true;
  }, [open, summary?.id]);

  useEffect(() => {
    if (!open) {
      confettiFired.current = false;
    }
  }, [open]);

  const highlights = useMemo(() => {
    if (!summary?.highlights || !Array.isArray(summary.highlights)) return [];
    return summary.highlights;
  }, [summary?.highlights]);

  const dateRange = useMemo(() => {
    if (!summary?.period_start || !summary?.period_end) return "";
    const start = new Date(summary.period_start);
    const end = new Date(summary.period_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  }, [summary?.period_start, summary?.period_end]);

  const metrics = (summary?.metrics ?? {}) as Record<string, unknown>;
  const leads = typeof metrics.leads === "number" ? metrics.leads : 0;
  const reservations = typeof metrics.reservations === "number" ? metrics.reservations : 0;

  const primaryCta = reservations > 0
    ? { label: "View reservations", href: "/dashboard/reservations" }
    : leads > 0
      ? { label: "View leads", href: "/dashboard/leads" }
      : { label: "View analytics", href: "/dashboard/analytics" };

  if (!open || !summary) return null;

  const handleClose = async () => {
    if (onMarkShown) {
      await onMarkShown();
    }
    onClose();
  };

  const heading = summary.period === "monthly" ? "🏆 Your monthly impact" : "🔥 Your weekly impact";

  const toneStyles: Record<string, string> = {
    success: "border-emerald-400/30 bg-emerald-500/10",
    warning: "border-amber-400/30 bg-amber-500/10",
    info: "border-white/10 bg-white/5"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-5xl rounded-3xl border border-yellow-400/20 bg-neutral-950 text-white shadow-[0_35px_120px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-yellow-300/70">Impact summary</p>
            <h2 className="mt-2 text-3xl font-semibold">{heading}</h2>
            {dateRange ? <p className="mt-1 text-sm text-white/60">{dateRange}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/70 hover:text-white"
            aria-label="Close impact summary"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border p-4 shadow-soft ${toneStyles[item.tone ?? "info"] ?? toneStyles.info}`}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  {item.emoji ? <span>{item.emoji}</span> : null}
                  <span>{item.title}</span>
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                {item.subtext ? <p className="mt-2 text-sm text-white/60">{item.subtext}</p> : null}
                {item.cta ? (
                  <Link href={item.cta.href} className="mt-3 inline-flex text-sm font-semibold text-yellow-300">
                    {item.cta.label}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <Link href={primaryCta.href} className={buttonVariants({ variant: "primary" })}>
              {primaryCta.label}
            </Link>
            <button
              type="button"
              onClick={handleClose}
              className={buttonVariants({ variant: "secondary" })}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
