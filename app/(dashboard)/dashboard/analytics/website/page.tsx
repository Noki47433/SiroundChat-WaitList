import { WebsiteInsightsDashboard } from "@/components/analytics/website/WebsiteInsightsDashboard";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function WebsiteAnalyticsPage({ searchParams }: PageProps) {
  const access = await getEntitlementAccess("advanced_analytics");
  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website analytics</p>
          <h2 className="text-3xl font-semibold">Track traffic and conversion performance</h2>
          <p className="text-sm text-white/60">Unlock site-level trends and conversion intelligence.</p>
        </div>
        <UpgradeOverlay
          entitlementKey="advanced_analytics"
          title="Upgrade plan to unlock Website Analytics"
          description="Website analytics is part of plans that include advanced analytics."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="h-28"><div /></Card>
              <Card className="h-28"><div /></Card>
              <Card className="h-28"><div /></Card>
            </div>
            <Card className="h-72"><div /></Card>
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  const rangeParam = typeof searchParams?.range === "string" ? searchParams?.range : "7d";
  const siteIdParam = typeof searchParams?.siteId === "string" ? searchParams?.siteId : null;
  const demo = searchParams?.demo === "1";
  const initialRange = rangeParam === "7d" || rangeParam === "30d" || rangeParam === "90d" ? rangeParam : "7d";

  return <WebsiteInsightsDashboard initialRange={initialRange} initialSiteId={siteIdParam} demo={demo} />;
}
