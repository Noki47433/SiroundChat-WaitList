import { requireUser } from "@/lib/auth/require-user";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { ensureBusinessRow } from "@/lib/tenant";
import { listOwnedBuilderSites } from "@/lib/builder/site-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BuilderStudioClient } from "@/app/(dashboard)/dashboard/builder/BuilderStudioClient";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export const dynamic = "force-dynamic";

export default async function BuilderDashboardPage() {
  const { user } = await requireUser("/dashboard/builder");
  if (!user?.id) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Create your first site</h2>
        <p className="text-sm text-white/60">Log in to start building your website.</p>
      </div>
    );
  }

  const tenant = await getTenantFromSession(user?.id);
  const supabase = getSupabaseServerClient();
  let businessId = tenant.businessId;

  if (!businessId && tenant.userId) {
    try {
      const ensured = await ensureBusinessRow({ userId: tenant.userId });
      businessId = ensured.businessId;
    } catch (error) {
      console.error("[BUILDER_LIST_ENSURE_BUSINESS_ERROR]", error);
    }
  }

  if (!businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Create your first site</h2>
        <p className="text-sm text-white/60">Log in to start building your website.</p>
      </div>
    );
  }

  const websiteBuilderAccess = await getEntitlementAccess("website_builder", businessId);
  if (!websiteBuilderAccess.allowed) {
    return (
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Manage your websites</h2>
          <p className="mt-2 text-sm text-white/60">
            Site creation, editing, and publishing unlock on the website-enabled SiroundChat plans.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="website_builder"
          title="Unlock website creation and editing"
          description="Website builder access is available on Website Only, Website + AI, and Full Omni-Channel."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-64 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-64 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-64 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id,business_name,industry,logo_url")
    .eq("id", businessId)
    .maybeSingle();

  const sites = await listOwnedBuilderSites<any>(
    businessId,
    user.id,
    "id,status,slug,template_key,business_name,updated_at,published_url"
  );

  return (
    <BuilderStudioClient
      businessId={businessId}
      initialBusinessName={business?.business_name ?? ""}
      initialIndustry={business?.industry ?? null}
      initialLogoUrl={business?.logo_url ?? null}
      sites={sites ?? []}
    />
  );
}
