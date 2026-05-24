import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { EntitlementKey } from "@/src/billing/entitlements";
import {
  getRecommendedPlanName,
  getUpgradeCopy,
  getUpgradeHref
} from "@/src/billing/upgrade";

type UpgradeOverlayProps = {
  entitlementKey: EntitlementKey;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function UpgradeOverlay({
  entitlementKey,
  title,
  description,
  children
}: UpgradeOverlayProps) {
  const copy = getUpgradeCopy(entitlementKey);
  const href = getUpgradeHref(entitlementKey);
  const recommendedPlanName = getRecommendedPlanName(entitlementKey);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#ffd87242] bg-[#060d17]/80">
      <div className="pointer-events-none select-none blur-[8px] opacity-35">{children}</div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#ffd87270] bg-[linear-gradient(160deg,rgba(11,17,28,0.95),rgba(7,12,20,0.98))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(255,210,95,0.24),transparent_32%),radial-gradient(circle_at_88%_88%,rgba(77,173,255,0.14),transparent_38%)]" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-[#ffd87266] bg-[linear-gradient(155deg,rgba(73,47,8,0.54),rgba(13,21,34,0.96))]">
                <Lock className="h-5 w-5 text-[#f6df9e]" />
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#c9b37a]">Paid module</p>
                <h3 className="dashboard-heading text-2xl font-semibold text-white">
                  {title ?? copy.title}
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-[#d5c89d]">
                  {description ?? copy.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {copy.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/82"
                >
                  {highlight}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Recommended unlock</p>
                <p className="mt-1 text-lg font-semibold text-white">{recommendedPlanName}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={href}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:scale-[1.01]"
                >
                  Upgrade now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/billing"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/84 transition hover:border-white/30 hover:text-white"
                >
                  View all plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
