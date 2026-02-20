import { getTenantFromSession } from "@/lib/utils/tenant";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const tenant = await getTenantFromSession();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Billing</p>
        <h2 className="text-3xl font-semibold text-white">Upgrade your plan</h2>
        <p className="text-sm text-white/60">No workspace found for this account.</p>
      </div>
    );
  }

  const subscription = await getWorkspaceSubscription(tenant.businessId);

  return (
    <BillingClient workspaceId={tenant.businessId} initialSubscription={subscription} />
  );
}
