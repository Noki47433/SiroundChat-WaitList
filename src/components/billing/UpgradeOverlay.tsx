import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
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
  const href = `/billing?blocked=${encodeURIComponent(entitlementKey)}`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#ffd87242] bg-[#060d17]/80">
      <div className="pointer-events-none select-none blur-[6px] opacity-40">{children}</div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#ffd87266] bg-[#08101d]/95 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(255,205,96,0.24),transparent_38%),radial-gradient(circle_at_88%_86%,rgba(255,176,44,0.16),transparent_34%)]" />
          <div className="relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ffd87266] bg-[linear-gradient(160deg,rgba(50,35,10,0.5),rgba(16,23,35,0.9))]">
            <Lock className="h-5 w-5 text-[#f5dd9e]" />
          </div>
          <h3 className="dashboard-heading relative z-10 text-xl font-semibold text-white">{title}</h3>
          <p className="relative z-10 mt-2 text-sm text-[#d5c495]">{description}</p>
          <div className="relative z-10 mt-5 flex items-center justify-center gap-3">
            <Link
              href={href}
              className="dashboard-pill inline-flex h-10 items-center justify-center rounded-full border border-[#ffd87288] px-4 text-sm font-semibold text-[#f2db9a] transition hover:text-white"
            >
              Upgrade plan
            </Link>
            <Link
              href="/billing"
              className="dashboard-pill inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-semibold text-[#d0bd8f] transition hover:text-white"
            >
              View billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
