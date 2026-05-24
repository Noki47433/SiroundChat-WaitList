"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Lock } from "lucide-react";
import { hasEntitlement, type EntitlementKey } from "@/src/billing/entitlements";
import { useEntitlements } from "@/src/billing/useEntitlements";
import {
  getRecommendedPlanName,
  getUpgradeCopy,
  getUpgradeHref
} from "@/src/billing/upgrade";

type PaywallGateProps = {
  entitlementKey: EntitlementKey;
  children: ReactNode;
  fallback?: ReactNode;
};

function DefaultFallback({ entitlementKey }: { entitlementKey: EntitlementKey }) {
  const { subscription } = useEntitlements();
  const copy = getUpgradeCopy(entitlementKey);
  const href = getUpgradeHref(entitlementKey);
  const recommendedPlanName = getRecommendedPlanName(entitlementKey);
  const isInactiveBilling =
    subscription?.status === "past_due" ||
    subscription?.status === "canceled" ||
    subscription?.status === "pending_setup";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#ffd8724f] bg-[#060d18] p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_14%,rgba(255,205,96,0.22),transparent_36%),radial-gradient(circle_at_92%_82%,rgba(255,186,56,0.12),transparent_38%)]" />
      <div className="pointer-events-none absolute -right-12 top-8 h-44 w-44 rounded-full bg-[#ffd24b24] blur-3xl" />

      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ffd87266] bg-[linear-gradient(160deg,rgba(57,35,8,0.6),rgba(10,16,27,0.95))]">
              {isInactiveBilling ? (
                <CreditCard className="h-5 w-5 text-[#f6db94]" />
              ) : (
                <Lock className="h-5 w-5 text-[#f6db94]" />
              )}
            </span>
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8a270]">
                {isInactiveBilling ? "Billing required" : "Feature locked"}
              </p>
              <p className="dashboard-heading text-xl font-semibold text-white">
                {copy.title}
              </p>
              <p className="max-w-xl text-sm leading-6 text-[#d5c495]">
                {isInactiveBilling
                  ? "Your workspace billing is not active right now. Update payment to restore access."
                  : copy.description}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-[#ffd87255] bg-[#ffd34a14] px-4 py-2 text-sm font-semibold text-[#f3dc9c]">
            {recommendedPlanName}
          </div>
        </div>

        <div className="grid gap-2 text-xs text-[#b9a579] sm:grid-cols-3">
          {copy.highlights.map((highlight) => (
            <div key={highlight} className="rounded-xl border border-[#ffd87233] px-3 py-2">
              {highlight}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={href}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:scale-[1.01]"
          >
            {isInactiveBilling ? "Restore billing" : "Upgrade plan"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/billing"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/84 transition hover:border-white/30 hover:text-white"
          >
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PaywallGate({ entitlementKey, children, fallback }: PaywallGateProps) {
  const { entitlements, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#ffd8723d] p-5 text-sm text-[#cfbb8d]">
        Checking plan access...
      </div>
    );
  }

  if (!hasEntitlement(entitlements, entitlementKey)) {
    return <>{fallback ?? <DefaultFallback entitlementKey={entitlementKey} />}</>;
  }

  return <>{children}</>;
}
