"use client";

import { useEffect, useMemo, useState } from "react";
import type { Entitlements, PlanDefinition, PlanId } from "@/src/billing/plans";

type SubscriptionRecord = {
  id: string;
  business_id: string;
  plan_id: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

type SubscriptionPayload = {
  subscription: SubscriptionRecord;
  planDefinition: PlanDefinition;
  entitlements: Entitlements;
};

type State = {
  loading: boolean;
  error: string | null;
  payload: SubscriptionPayload | null;
};

const cache = new Map<string, SubscriptionPayload>();
const inflight = new Map<string, Promise<SubscriptionPayload>>();

const keyFor = (workspaceId?: string) => workspaceId ?? "__current_workspace__";

const fetchSubscription = async (workspaceId?: string) => {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  const res = await fetch(`/api/billing/subscription${query}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as SubscriptionPayload | { error?: string } | null;

  if (!res.ok || !data || typeof (data as SubscriptionPayload).subscription?.id !== "string") {
    throw new Error((data as { error?: string } | null)?.error ?? "Failed to load subscription");
  }

  return data as SubscriptionPayload;
};

export function invalidateEntitlementsCache(workspaceId?: string) {
  const keys = new Set([keyFor(undefined), keyFor(workspaceId)]);
  keys.forEach((key) => {
    cache.delete(key);
    inflight.delete(key);
  });
}

export function useEntitlements(workspaceId?: string) {
  const cacheKey = useMemo(() => keyFor(workspaceId), [workspaceId]);
  const cached = cache.get(cacheKey) ?? null;

  const [state, setState] = useState<State>(() => ({
    loading: !cached,
    error: null,
    payload: cached
  }));

  useEffect(() => {
    let active = true;

    const fromCache = cache.get(cacheKey) ?? null;
    if (fromCache) {
      setState({ loading: false, error: null, payload: fromCache });
      return () => {
        active = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const pending =
      inflight.get(cacheKey) ??
      fetchSubscription(workspaceId).finally(() => {
        inflight.delete(cacheKey);
      });

    inflight.set(cacheKey, pending);

    pending
      .then((payload) => {
        if (!active) return;
        cache.set(cacheKey, payload);
        setState({ loading: false, error: null, payload });
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load subscription";
        setState({ loading: false, error: message, payload: null });
      });

    return () => {
      active = false;
    };
  }, [cacheKey, workspaceId]);

  return {
    subscription: state.payload?.subscription ?? null,
    plan: state.payload?.planDefinition ?? null,
    entitlements: state.payload?.entitlements ?? null,
    loading: state.loading,
    error: state.error
  };
}
