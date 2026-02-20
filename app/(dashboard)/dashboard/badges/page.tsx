import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";

type BadgeDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
};

type EarnedBadge = BadgeDefinition & { earned_at: string };


const rarityVariant: Record<BadgeDefinition["rarity"], "default" | "success" | "warning" | "info"> = {
  common: "info",
  rare: "success",
  epic: "warning",
  legendary: "default"
};

export default async function BadgesPage() {
  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Badges</p>
        <h2 className="text-3xl font-semibold">Track your milestones</h2>
        <p className="text-sm text-white/60">Log in to view your earned badges.</p>
      </div>
    );
  }

  const { data: earnedRows } = await (supabase as any)
    .from("business_badges")
    .select("earned_at, badge_definitions (id, key, name, description, icon, rarity)")
    .eq("business_id", tenant.businessId)
    .order("earned_at", { ascending: false });

  const { data: allBadges } = await (supabase as any)
    .from("badge_definitions")
    .select("id, key, name, description, icon, rarity")
    .order("created_at", { ascending: true });

    const earnedBadges: EarnedBadge[] = (earnedRows ?? [])
    .map((row: any) => {
      const def = (row.badge_definitions ?? {}) as Partial<BadgeDefinition>;
      return {
        id: String(def.id ?? ""),
        key: String(def.key ?? ""),
        name: String(def.name ?? ""),
        description: String(def.description ?? ""),
        icon: String(def.icon ?? ""),
        rarity: (def.rarity ?? "common") as BadgeDefinition["rarity"],
        earned_at: String(row.earned_at ?? "")
      };
    })
    .filter((badge: EarnedBadge) => Boolean(badge.key));

    const earnedKeys = new Set(earnedBadges.map((badge) => badge.key));
  const lockedBadges = (allBadges ?? []).filter((badge: BadgeDefinition) => !earnedKeys.has(badge.key));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Badges</p>
        <h2 className="mt-2 text-3xl font-semibold">Milestones & rewards</h2>
        <p className="mt-2 text-sm text-white/60">Celebrate progress as your bot helps more customers.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Earned badges</h3>
          <p className="text-xs text-white/50">{earnedBadges.length} earned</p>
        </div>
        {earnedBadges.length === 0 ? (
          <p className="text-sm text-white/60">No badges yet. Your first conversation will unlock one.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
              {earnedBadges.map((badge: EarnedBadge) => (
              <div key={badge.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{badge.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{badge.name}</p>
                      <p className="text-xs text-white/60">{badge.description}</p>
                    </div>
                  </div>
                  <Badge variant={rarityVariant[badge.rarity]} className="capitalize">
                    {badge.rarity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Locked badges</h3>
          <p className="text-xs text-white/50">{lockedBadges.length} remaining</p>
        </div>
        {lockedBadges.length === 0 ? (
          <p className="text-sm text-white/60">You unlocked every badge. New milestones coming soon.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {lockedBadges.map((badge: BadgeDefinition) => (
              <div
                key={badge.key}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 opacity-60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{badge.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{badge.name}</p>
                      <p className="text-xs text-white/60">{badge.description}</p>
                    </div>
                  </div>
                  <Badge variant={rarityVariant[badge.rarity]} className="capitalize">
                    {badge.rarity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
