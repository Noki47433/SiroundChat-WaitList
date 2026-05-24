"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import type { BillingPaymentKind, BillingSubscriptionStatus } from "@/lib/billing/plans";
import type { PlanDefinition } from "@/src/billing/plans";

type SubscriptionRecord = {
  status: BillingSubscriptionStatus;
  pending_payment_kind: BillingPaymentKind | null;
  pending_payment_is_stale: boolean;
};

type SubscriptionPayload = {
  accessActive: boolean;
  subscription: SubscriptionRecord;
  planDefinition: PlanDefinition;
};

type BillingSuccessStatusProps = {
  workspaceId: string | null;
  demoMode: boolean;
};

export function BillingSuccessStatus({ workspaceId, demoMode }: BillingSuccessStatusProps) {
  const billingHref = workspaceId
    ? `/billing?workspaceId=${encodeURIComponent(workspaceId)}`
    : "/billing";

  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    payload: SubscriptionPayload | null;
  }>({
    loading: !demoMode && Boolean(workspaceId),
    error: null,
    payload: null
  });

  useEffect(() => {
    if (demoMode || !workspaceId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        const response = await fetch(`/api/billing/subscription?workspaceId=${encodeURIComponent(workspaceId)}`, {
          cache: "no-store"
        });
        const data = (await response.json().catch(() => null)) as
          | SubscriptionPayload
          | { error?: string }
          | null;

        if (!response.ok || !data || typeof (data as SubscriptionPayload).subscription?.status !== "string") {
          throw new Error((data as { error?: string } | null)?.error ?? "Failed to load billing status");
        }

        const payload = data as SubscriptionPayload;
        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          payload
        });

        const shouldContinue =
          !payload.accessActive &&
          (payload.subscription.status === "pending_setup" ||
            (payload.subscription.pending_payment_kind !== null && !payload.subscription.pending_payment_is_stale)) &&
          attempts < 12;

        if (shouldContinue) {
          timeoutId = setTimeout(poll, 2500);
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load billing status",
          payload: null
        });
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [demoMode, workspaceId]);

  const summary = useMemo(() => {
    if (demoMode) {
      return {
        title: "Demo trial activated",
        body: "Local demo billing mode activated this workspace immediately."
      };
    }

    if (state.loading) {
      return {
        title: "Verifying your payment",
        body: "We are waiting for Paysera to confirm the payment securely before your plan goes live."
      };
    }

    if (state.payload?.accessActive) {
      return {
        title: "Plan activated",
        body: `Your workspace is now active on ${state.payload.planDefinition.name}.`
      };
    }

    if (state.payload) {
      return {
        title: "Payment received, still confirming",
        body: "The browser returned from Paysera, but the secure server confirmation has not finished yet."
      };
    }

    return {
      title: "Billing status unavailable",
      body: state.error ?? "We could not confirm the latest plan status for this workspace."
    };
  }, [demoMode, state.error, state.loading, state.payload]);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,33,0.9),rgba(9,12,18,0.98))] p-8 text-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-white/12 bg-white/[0.04]">
          {state.loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#f0d08f]" />
          ) : state.payload?.accessActive || demoMode ? (
            <CheckCircle2 className="h-6 w-6 text-[#9fe1b9]" />
          ) : (
            <Clock3 className="h-6 w-6 text-[#f0d08f]" />
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{summary.title}</h1>
          <p className="text-sm leading-7 text-white/74">{summary.body}</p>
          {workspaceId ? (
            <p className="text-xs uppercase tracking-[0.2em] text-white/42">Workspace {workspaceId}</p>
          ) : null}
        </div>
      </div>

      {state.payload ? (
        <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/78">
          <p>
            Subscription status: <span className="font-semibold text-white">{state.payload.subscription.status}</span>
          </p>
          <p className="mt-2">
            Active plan: <span className="font-semibold text-white">{state.payload.planDefinition.name}</span>
          </p>
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-6 rounded-[1.4rem] border border-[#ffb46a3d] bg-[#ffb46a12] p-4 text-sm text-[#ffd4ab]">
          {state.error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={billingHref} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
          Back to plans
        </Link>
        <Link href="/dashboard" className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
