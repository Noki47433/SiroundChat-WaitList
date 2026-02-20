"use client";

import { useCallback, useState } from "react";

export function useDomain(siteId: string) {
  const [status, setStatus] = useState<"idle" | "pending" | "connected">("idle");

  const register = useCallback(
    async (domain: string) => {
      const res = await fetch("/api/domain/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, domain })
      });
      if (res.ok) {
        setStatus("pending");
      }
    },
    [siteId]
  );

  const check = useCallback(async () => {
    const res = await fetch(`/api/domain/status?siteId=${siteId}`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.status);
  }, [siteId]);

  const remove = useCallback(async () => {
    await fetch("/api/domain/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId })
    });
    setStatus("idle");
  }, [siteId]);

  return { status, register, check, remove };
}
