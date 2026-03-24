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
  common: "border-[#ffd87240] text-[#dbc891]",
  rare: "border-[#95c9ff55] text-[#bfe0ff]",
  epic: "border-[#ffd87266] text-[#ffe3a2]",
  legendary: "border-[#7ae8bf66] text-[#bdfadf]"
};

export function BadgesPreview({ badges }: { badges: BadgeSummary[] }) {
  if (!badges.length) return null;

  return (
    <div className="dashboard-inset mt-3 rounded-2xl border border-[#ffd87242] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[#b6a47a]">Latest badges</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <div
            key={badge.key}
            className={cn("dashboard-pill flex items-center gap-2 rounded-full border px-3 py-1 text-xs", rarityStyles[badge.rarity])}
          >
            <span className="text-sm">{badge.icon}</span>
            <span>{badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
