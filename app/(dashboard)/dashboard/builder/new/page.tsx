import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { ensureBusinessRow } from "@/lib/tenant";
import { BuilderWizardClient } from "@/app/(dashboard)/dashboard/builder/new/BuilderWizardClient";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export const dynamic = "force-dynamic";

export default async function BuilderNewPage() {
  const { user } = await requireUser("/dashboard/builder/new");
  const tenant = await getTenantFromSession(user?.id);
  const supabase = getSupabaseServerClient();
  let businessId = tenant.businessId;

  if (!businessId && tenant.userId) {
    try {
      const ensured = await ensureBusinessRow({ userId: tenant.userId });
      businessId = ensured.businessId;
    } catch (error) {
      console.error("[BUILDER_ENSURE_BUSINESS_ERROR]", error);
    }
  }

  if (!businessId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4f1] px-6">
        <div className="space-y-4 rounded-[24px] border border-[#ece7df] bg-white p-6 text-neutral-700 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Website Builder</p>
          <h2 className="text-3xl font-semibold text-neutral-900">Create your site</h2>
          <p className="text-sm text-neutral-500">Log in to start building.</p>
        </div>
      </div>
    );
  }

  const websiteBuilderAccess = await getEntitlementAccess("website_builder", businessId);

  if (!websiteBuilderAccess.allowed) {
    return (
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Create your website</h2>
          <p className="mt-2 text-sm text-white/60">
            Design, generation, and publishing are unlocked on the website plans.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="website_builder"
          title="Unlock the SiroundChat website builder"
          description="Website creation and publishing are available on Website Only, Website + AI, and Full Omni-Channel."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-56 rounded-[1.5rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-56 rounded-[1.5rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-56 rounded-[1.5rem] border border-white/10 bg-white/[0.03]" />
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
  const chatbotEmbedAccess = await getEntitlementAccess("chatbot_website_injection", businessId);

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-10">
      <BuilderWizardClient
        businessId={businessId}
        initialBusinessName={business?.business_name ?? ""}
        initialIndustry={business?.industry ?? null}
        initialLogoUrl={business?.logo_url ?? null}
        canAttachChatbotEmbed={chatbotEmbedAccess.allowed}
      />
    </div>
  );
}
