"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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

export function DemoImpactPanel() {
  const { push } = useToast();
  const [loading, setLoading] = useState<Period | null>(null);
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [open, setOpen] = useState(false);

  const handleGenerate = async (period: Period) => {
    if (loading) return;
    setLoading(period);
    try {
      const res = await fetch("/api/impact/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, force: true })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.summaryId) {
        const message = payload?.error || "Failed to generate impact summary.";
        push({ title: "Request failed", message, variant: "error" });
        return;
      }

      const nextSummary: ImpactSummary = {
        id: payload.summaryId,
        period,
        period_start: payload.period_start,
        period_end: payload.period_end,
        metrics: payload.metrics ?? null,
        highlights: payload.highlights ?? null,
        shown_at: null
      };
      setSummary(nextSummary);
      setOpen(true);
      push({
        title: period === "weekly" ? "Weekly impact generated" : "Monthly impact generated",
        message: "Impact popup is ready.",
        variant: "success"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate impact summary.";
      push({ title: "Request failed", message, variant: "error" });
    } finally {
      setLoading(null);
    }
  };

  const markShown = async () => {
    if (!summary?.id) return;
    await fetch("/api/impact/mark-shown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryId: summary.id })
    });
  };

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Demo impact popup</p>
        <p className="mt-1 text-xs text-white/60">Generate a high-impact summary modal using real data.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => handleGenerate("weekly")}
          disabled={loading === "weekly"}
        >
          {loading === "weekly" ? "Generating..." : "Generate Weekly Impact Popup"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleGenerate("monthly")}
          disabled={loading === "monthly"}
        >
          {loading === "monthly" ? "Generating..." : "Generate Monthly Impact Popup"}
        </Button>
      </div>

      <ImpactSummaryModal
        open={open}
        summary={summary}
        onClose={() => setOpen(false)}
        onMarkShown={markShown}
      />
    </Card>
  );
}
