"use client";

import { useCallback, useState } from "react";
import { Server, Wifi, WifiOff } from "lucide-react";
import { ActiveConversations } from "@/components/admin/ActiveConversations";
import { GlassCard } from "@/components/admin/GlassCard";
import { LiveFeed } from "@/components/admin/LiveFeed";
import type { AdminLiveData } from "@/lib/admin/metrics";
import { useRealtimeTable } from "@/hooks/useRealtime";

export function LiveClient({ initialData }: { initialData: AdminLiveData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/live", { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as AdminLiveData;
    setData(next);
  }, []);

  const realtime = useRealtimeTable({
    table: "events",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 12000
  });

  useRealtimeTable({
    table: "conversations",
    filter: "status=eq.open",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 12000
  });

  useRealtimeTable({
    table: "messages",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 12000
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.7fr,1fr]">
      <div className="space-y-4">
        <ActiveConversations rows={data.activeConversations} />

        <GlassCard accent="blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--adm-text)]">System Health</p>
              <p className="text-xs text-[var(--adm-muted)]">Realtime transport and event freshness</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs">
              {realtime.connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-[#55FF95]" />
                  <span className="text-[#b8ffd3]">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-rose-300" />
                  <span className="text-rose-200">Fallback polling</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/55">Status</p>
              <p className="mt-1 text-sm text-white">{realtime.channelStatus}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/55">Last Event</p>
              <p className="mt-1 text-sm text-white">
                {realtime.lastEventAt
                  ? new Date(realtime.lastEventAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })
                  : "Waiting"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/55">Runtime</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-white">
                <Server className="h-3.5 w-3.5 text-cyan-300" />
                Node.js
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <LiveFeed events={data.events} />
    </div>
  );
}
