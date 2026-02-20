"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetTheme } from "@/lib/types/core";

type WidgetConfig = {
  siteId: string;
  greeting: string;
  launcherPosition: "left" | "right";
  language: "auto" | "en" | "sq";
  theme: WidgetTheme;
  showLogo: boolean;
};

export function useWidget(siteId: string) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/widget/config?key=${siteId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setConfig(() => data);
        setLoading(() => false);
      })
      .catch(() => setLoading(() => false));
  }, [siteId]);

  const update = useCallback(
    async (payload: Partial<WidgetConfig>) => {
      if (!config) return;
      const next = { ...config, ...payload };
      setConfig(() => next);
      await fetch("/api/widget/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
    },
    [config]
  );

  return { config, loading, update };
}
