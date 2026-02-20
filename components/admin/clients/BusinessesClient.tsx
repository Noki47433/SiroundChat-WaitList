"use client";

import { useCallback, useState } from "react";
import { BusinessTable } from "@/components/admin/BusinessTable";
import { useRealtimeTable } from "@/hooks/useRealtime";
import type { AdminBusinessesData } from "@/lib/admin/metrics";

export function BusinessesClient({ initialData }: { initialData: AdminBusinessesData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/businesses?range=${data.range}`, {
      cache: "no-store"
    });
    if (!response.ok) return;
    const next = (await response.json()) as AdminBusinessesData;
    setData(next);
  }, [data.range]);

  useRealtimeTable({
    table: "business_metrics_daily",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  useRealtimeTable({
    table: "conversations",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  return <BusinessTable rows={data.rows} />;
}
