"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { hasEntitlement, type EntitlementKey } from "@/src/billing/entitlements";
import { useEntitlements } from "@/src/billing/useEntitlements";

type PaywallGateProps = {
  entitlementKey: EntitlementKey;
  children: ReactNode;
  fallback?: ReactNode;
};

function DefaultFallback() {
  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl border border-white/10 bg-white/5 p-2">
          <Lock className="h-4 w-4 text-white/80" />
        </span>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Upgrade to unlock this feature</p>
          <p className="text-xs text-white/60">This capability is available on higher plans.</p>
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Go to billing
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
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
        Checking plan access...
      </div>
    );
  }

  if (!hasEntitlement(entitlements, entitlementKey)) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  return <>{children}</>;
}
