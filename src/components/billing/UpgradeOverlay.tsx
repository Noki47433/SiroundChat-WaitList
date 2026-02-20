import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { EntitlementKey } from "@/src/billing/entitlements";

type UpgradeOverlayProps = {
  entitlementKey: EntitlementKey;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function UpgradeOverlay({
  entitlementKey,
  title = "Upgrade plan to unlock this feature",
  description = "Your current plan does not include this capability yet.",
  children
}: UpgradeOverlayProps) {
  const href = `/dashboard/billing?blocked=${encodeURIComponent(entitlementKey)}`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/50">
      <div className="pointer-events-none select-none blur-[6px] opacity-40">{children}</div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/85 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-white/70">{description}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href={href} className={buttonVariants({ variant: "primary", size: "sm" })}>
              Upgrade plan
            </Link>
            <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
              View billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
