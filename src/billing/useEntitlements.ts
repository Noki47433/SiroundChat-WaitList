"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BillingPaymentKind,
  BillingSubscriptionStatus,
  PublicBillingPlanId
} from "@/lib/billing/plans";
import type { Entitlements, PlanDefinition, PlanId } from "@/src/billing/plans";

type SubscriptionRecord = {
  id: string;
  business_id: string;
  raw_billing_plan_id: string;
  billing_plan_id: PublicBillingPlanId;
  plan_id: PlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  is_access_active: boolean;
  pending_payment_kind?: BillingPaymentKind | null;
  pending_payment_plan_id?: string | null;
  pending_payment_created_at?: string | null;
  pending_payment_is_stale?: boolean;
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
  keys.forEach((key) => inflight.delete(key));
}

export function useEntitlements(workspaceId?: string) {
  const cacheKey = useMemo(() => keyFor(workspaceId), [workspaceId]);

  const [state, setState] = useState<State>(() => ({
    loading: true,
    error: null,
    payload: null
  }));

  useEffect(() => {
    let active = true;

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
