"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type EndpointKey = "weekly" | "monthly";

const labels: Record<EndpointKey, string> = {
  weekly: "Generate Weekly Summary (Demo)",
  monthly: "Generate Monthly Summary (Demo)"
};

export function DemoNotificationsPanel() {
  const { push } = useToast();
  const [loading, setLoading] = useState<EndpointKey | null>(null);

  const handleClick = async (endpoint: EndpointKey) => {
    if (loading) return;
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/notifications/simulate/${endpoint}`, { method: "POST" });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const message = payload?.error || "Failed to generate notification.";
        push({ title: "Request failed", message, variant: "error" });
        return;
      }

      push({
        title: endpoint === "weekly" ? "Weekly summary notification created" : "Monthly summary notification created",
        message: "Check your notifications bell to preview it.",
        variant: "success"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate notification.";
      push({ title: "Request failed", message, variant: "error" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="space-y-4 border border-white/10 bg-white/5">
      <div>
        <p className="text-sm font-semibold">Demo notifications</p>
        <p className="mt-1 text-xs text-white/60">Generate real summary notifications using live data.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => handleClick("weekly")}
          disabled={loading === "weekly"}
        >
          {loading === "weekly" ? "Generating..." : labels.weekly}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleClick("monthly")}
          disabled={loading === "monthly"}
        >
          {loading === "monthly" ? "Generating..." : labels.monthly}
        </Button>
      </div>
    </Card>
  );
}
