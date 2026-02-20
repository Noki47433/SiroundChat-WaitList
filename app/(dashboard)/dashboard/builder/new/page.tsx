import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { BuilderWizardClient } from "@/app/(dashboard)/dashboard/builder/new/BuilderWizardClient";

export const dynamic = "force-dynamic";

export default async function BuilderNewPage() {
  await requireUser("/dashboard/builder");
  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
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
    .eq("id", tenant.businessId)
    .maybeSingle();

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-10">
      <BuilderWizardClient
        businessId={tenant.businessId}
        initialBusinessName={business?.business_name ?? ""}
        initialIndustry={business?.industry ?? null}
        initialLogoUrl={business?.logo_url ?? null}
      />
    </div>
  );
}
