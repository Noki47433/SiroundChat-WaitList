import { getTenantFromSession } from "@/lib/utils/tenant";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import { BillingClient } from "@/app/(dashboard)/dashboard/billing/BillingClient";

export default async function StandaloneBillingPage() {
  const tenant = await getTenantFromSession();

  if (!tenant.businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0b0f18] p-8 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Billing</p>
          <h2 className="text-3xl font-semibold">Upgrade your plan</h2>
          <p className="text-sm text-white/60">No workspace found for this account.</p>
        </div>
      </div>
    );
  }

  const subscription = await getWorkspaceSubscription(tenant.businessId);

  return (
    <div className="min-h-dvh bg-[#03060c] px-4 py-8 sm:px-6 lg:px-8">
      <BillingClient workspaceId={tenant.businessId} initialSubscription={subscription} />
    </div>
  );
}
