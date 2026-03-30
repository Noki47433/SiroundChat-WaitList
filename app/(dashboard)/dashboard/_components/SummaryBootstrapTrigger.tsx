"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Period = "weekly" | "monthly";

type SummaryBootstrapTriggerProps = {
  businessId: string;
  missingPeriods: Period[];
  eligiblePeriods: Period[];
};

const ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;

const getAttemptKey = (businessId: string, period: Period) =>
  `siround_summary_bootstrap:${businessId}:${period}`;

export function SummaryBootstrapTrigger({
  businessId,
  missingPeriods,
  eligiblePeriods
}: SummaryBootstrapTriggerProps) {
  const router = useRouter();

  useEffect(() => {
    const periodsToBootstrap = missingPeriods.filter((period) => eligiblePeriods.includes(period));
    if (!businessId || !periodsToBootstrap.length) return;

    let active = true;
    const now = Date.now();

    const run = async () => {
      let shouldRefresh = false;

      for (const period of periodsToBootstrap) {
        const key = getAttemptKey(businessId, period);
        const previous = Number(window.localStorage.getItem(key) ?? "0");
        if (previous && now - previous < ATTEMPT_COOLDOWN_MS) {
          continue;
        }

        try {
          const response = await fetch("/api/impact/compute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ period })
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            console.error("[SUMMARY_BOOTSTRAP_COMPUTE_ERROR]", { period, status: response.status, payload });
            window.localStorage.removeItem(key);
            continue;
          }
          window.localStorage.setItem(key, String(Date.now()));
          shouldRefresh = true;
        } catch (error) {
          console.error("[SUMMARY_BOOTSTRAP_REQUEST_ERROR]", { period, error });
          window.localStorage.removeItem(key);
        }
      }

      if (active && shouldRefresh) {
        router.refresh();
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [businessId, eligiblePeriods, missingPeriods, router]);

  return null;
}
