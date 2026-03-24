import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { ensureBusinessRow } from "@/lib/tenant";
import { BuilderWizardClient } from "@/app/(dashboard)/dashboard/builder/new/BuilderWizardClient";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";

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

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id,business_name,industry,logo_url")
    .eq("id", businessId)
    .maybeSingle();
  const chatbotEmbedAccess = await getEntitlementAccess("chatbot_embed", businessId);

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
