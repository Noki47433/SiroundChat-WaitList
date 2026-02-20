"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Download,
  Globe,
  Loader2,
  Shield,
  Sparkles,
  Users,
  Webhook,
  Zap
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  PLANS,
  getPlanDefinition,
  type PlanDefinition,
  type PlanId
} from "@/src/billing/plans";
import { invalidateEntitlementsCache, useEntitlements } from "@/src/billing/useEntitlements";

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

type BillingClientProps = {
  workspaceId: string;
  initialSubscription: SubscriptionRecord;
};

const ICONS = [Sparkles, Zap, Globe, BarChart3, Users, Shield, Webhook, Download] as const;

const formatRenewalDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const getPriceLabel = (plan: PlanDefinition) => {
  if (plan.priceMonthlyEUR === null) return "Custom";
  return `€${plan.priceMonthlyEUR}`;
};

const getPriceSuffix = (plan: PlanDefinition) => {
  if (plan.priceMonthlyEUR === null) return "";
  return "/ month";
};

const getActionLabel = (planId: PlanId) => {
  if (planId === "website") return "Switch to Website";
  if (planId === "bundle") return "Upgrade to Bundle";
  return "Switch to Chatbot";
};

export function BillingClient({ workspaceId, initialSubscription }: BillingClientProps) {
  const { push } = useToast();
  const searchParams = useSearchParams();
  const blockedKey = searchParams?.get("blocked");

  const { subscription: fetchedSubscription, loading } = useEntitlements(workspaceId);
  const [viewMode, setViewMode] = useState<"personal" | "business">("personal");
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionRecord>(initialSubscription);
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);

  useEffect(() => {
    if (!fetchedSubscription) return;
    setActiveSubscription(fetchedSubscription as SubscriptionRecord);
  }, [fetchedSubscription]);

  const currentPlanId = (activeSubscription.plan_id ?? "website") as PlanId;
  const currentPlan = useMemo(() => getPlanDefinition(currentPlanId), [currentPlanId]);

  const changePlan = async (planId: PlanId) => {
    setPendingPlanId(planId);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, planId })
      });
      const data = (await res.json().catch(() => null)) as
        | { subscription?: SubscriptionRecord; error?: string }
        | null;

      if (!res.ok || !data?.subscription) {
        throw new Error(data?.error ?? "Failed to change plan");
      }

      setActiveSubscription(data.subscription);
      invalidateEntitlementsCache(workspaceId);
      push({ title: "Plan updated (demo)", variant: "success" });
    } catch (error) {
      push({
        title: "Plan update failed",
        message: error instanceof Error ? error.message : "Could not update the plan right now.",
        variant: "error"
      });
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-[#0e1119] via-[#0b0f16] to-[#090c12] p-6 md:p-8">
      <div className="space-y-5 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Upgrade your plan</h1>
        <div className="mx-auto inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setViewMode("personal")}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              viewMode === "personal" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
            ].join(" ")}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("business")}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              viewMode === "business" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
            ].join(" ")}
          >
            Business
          </button>
        </div>

        <p className="text-sm text-white/70">
          Current plan: <span className="font-semibold text-white">{currentPlan.name}</span> - renews on{" "}
          {formatRenewalDate(activeSubscription.current_period_end)}
        </p>
        {blockedKey ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Feature blocked: <span className="font-semibold">{blockedKey}</span>. Upgrade to continue.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isRecommended = plan.badge === "RECOMMENDED";
          const isPending = pendingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={[
                "rounded-3xl border p-6",
                isRecommended
                  ? "border-[#5f7cff]/50 bg-gradient-to-b from-[#1e2448] to-[#13172c]"
                  : "border-white/10 bg-[#12151d]"
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold text-white">{plan.name}</p>
                  <div className="mt-4 flex items-end gap-2">
                    <p className="text-5xl font-semibold text-white">{getPriceLabel(plan)}</p>
                    {getPriceSuffix(plan) ? <p className="pb-2 text-sm text-white/70">{getPriceSuffix(plan)}</p> : null}
                  </div>
                  <p className="mt-3 text-sm text-white/70">{plan.subtitle}</p>
                </div>
                {isRecommended ? (
                  <span className="rounded-full border border-[#90a3ff]/50 bg-[#6f83ff]/25 px-3 py-1 text-[11px] font-semibold text-[#cfd8ff]">
                    RECOMMENDED
                  </span>
                ) : null}
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/55"
                  >
                    Your current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => changePlan(plan.id)}
                    disabled={Boolean(pendingPlanId)}
                    className={[
                      "w-full rounded-full px-4 py-3 text-sm font-semibold transition",
                      isRecommended
                        ? "bg-[#5f7cff] text-white hover:bg-[#4f6ef5]"
                        : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                    ].join(" ")}
                  >
                    {isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating...
                      </span>
                    ) : (
                      getActionLabel(plan.id)
                    )}
                  </button>
                )}
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature, index) => {
                  const Icon = ICONS[index % ICONS.length];
                  return (
                    <li key={feature} className="flex items-start gap-3 text-sm text-white/85">
                      <span className="mt-0.5 rounded-lg border border-white/10 bg-white/5 p-1.5">
                        <Icon className="h-3.5 w-3.5 text-white/80" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-white/50">
        Demo billing only. No real payment processing is enabled.
        {loading ? <span className="ml-2">Refreshing subscription...</span> : null}
      </div>
      <div className="text-center text-xs">
        <Link href="/dashboard" className="text-white/50 transition hover:text-white/80">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
