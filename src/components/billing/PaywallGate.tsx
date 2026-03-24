"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { hasEntitlement, type EntitlementKey } from "@/src/billing/entitlements";
import { useEntitlements } from "@/src/billing/useEntitlements";

type PaywallGateProps = {
  entitlementKey: EntitlementKey;
  children: ReactNode;
  fallback?: ReactNode;
};

function DefaultFallback() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#ffd8724f] bg-[#060d18] p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_14%,rgba(255,205,96,0.22),transparent_36%),radial-gradient(circle_at_92%_82%,rgba(255,186,56,0.12),transparent_38%)]" />
      <div className="pointer-events-none absolute -right-12 top-8 h-44 w-44 rounded-full bg-[#ffd24b24] blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="dashboard-chip inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ffd87266]">
            <Lock className="h-5 w-5 text-[#f6db94]" />
          </span>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8a270]">Feature locked</p>
            <p className="dashboard-heading text-xl font-semibold text-white">Upgrade to unlock this feature</p>
            <p className="max-w-xl text-sm text-[#d5c495]">
              This capability is available on higher plans with additional growth tools.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/billing"
            className="dashboard-pill inline-flex h-10 items-center justify-center rounded-full border border-[#ffd87280] px-5 text-sm font-semibold text-[#f3db9a] transition hover:text-white"
          >
            View plans
          </Link>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-2 text-xs text-[#b9a579] sm:grid-cols-3">
        <div className="dashboard-inset rounded-xl border border-[#ffd87233] px-3 py-2">Advanced analytics</div>
        <div className="dashboard-inset rounded-xl border border-[#ffd87233] px-3 py-2">Automation features</div>
        <div className="dashboard-inset rounded-xl border border-[#ffd87233] px-3 py-2">Priority support lane</div>
      </div>
    </div>
  );
}

export function PaywallGate({ entitlementKey, children, fallback }: PaywallGateProps) {
  const { entitlements, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="dashboard-inset rounded-3xl border border-[#ffd8723d] p-5 text-sm text-[#cfbb8d]">
        Checking plan access...
      </div>
    );
  }

  if (!hasEntitlement(entitlements, entitlementKey)) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  return <>{children}</>;
}
