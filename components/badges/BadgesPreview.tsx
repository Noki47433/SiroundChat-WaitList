"use client";

import { cn } from "@/lib/utils/cn";

type BadgeSummary = {
  key: string;
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earned_at: string;
};

const rarityStyles: Record<BadgeSummary["rarity"], string> = {
  common: "border-white/10 text-white/70",
  rare: "border-sky-500/30 text-sky-200",
  epic: "border-amber-500/30 text-amber-200",
  legendary: "border-emerald-500/30 text-emerald-200"
};

export function BadgesPreview({ badges }: { badges: BadgeSummary[] }) {
  if (!badges.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Latest badges</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <div
            key={badge.key}
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", rarityStyles[badge.rarity])}
          >
            <span className="text-sm">{badge.icon}</span>
            <span>{badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
