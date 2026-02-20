"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

export type UseRealtimeTableOptions<T extends Record<string, unknown>> = {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
  pollingMs?: number;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onPoll?: () => Promise<void> | void;
};

export function useRealtimeTable<T extends Record<string, unknown>>({
  table,
  schema = "public",
  event = "*",
  filter,
  enabled = true,
  pollingMs = 20000,
  onChange,
  onPoll
}: UseRealtimeTableOptions<T>) {
  const [connected, setConnected] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string>("CLOSED");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onChangeRef = useRef(onChange);
  const onPollRef = useRef(onPoll);

  onChangeRef.current = onChange;
  onPollRef.current = onPoll;

  const client = useMemo(() => getSupabaseBrowserClient(), []);

  const pollNow = useCallback(async () => {
    if (!onPollRef.current) return;
    await onPollRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = client.channel(`${schema}:${table}:${filter ?? "all"}`) as any;
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event,
          schema,
          table,
          filter
        },
        (payload: any) => {
          setLastEventAt(new Date().toISOString());
          onChangeRef.current?.(payload as RealtimePostgresChangesPayload<T>);
        }
      )
      .subscribe((status: string) => {
        setChannelStatus(status);
        const isConnected = status === "SUBSCRIBED";
        setConnected(isConnected);
      });

    return () => {
      setConnected(false);
      setChannelStatus("CLOSED");
      void client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [client, enabled, event, filter, schema, table]);

  useEffect(() => {
    if (!enabled || !onPollRef.current) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    void pollNow();

    timer = setInterval(() => {
      if (!connected) {
        void pollNow();
      }
    }, pollingMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [connected, enabled, pollNow, pollingMs]);

  return {
    connected,
    channelStatus,
    lastEventAt,
    pollNow
  };
}
