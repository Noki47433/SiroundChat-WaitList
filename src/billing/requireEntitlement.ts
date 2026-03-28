import "server-only";
import { redirect } from "next/navigation";
import {
  hasEffectiveBillingAccess,
  resolveBillingEntitlements
} from "@/lib/billing/entitlements";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  hasEntitlement,
  type EntitlementKey,
  type Entitlements
} from "@/src/billing/entitlements";

type RequireEntitlementResult = {
  workspaceId: string;
  entitlements: Entitlements;
};

type EntitlementAccessResult = {
  workspaceId: string | null;
  entitlements: Entitlements | null;
  allowed: boolean;
};

export async function getEntitlementAccess(
  entitlementKey: EntitlementKey,
  workspaceId?: string
): Promise<EntitlementAccessResult> {
  const tenant = await getTenantFromSession();
  const targetWorkspaceId = workspaceId ?? tenant.businessId ?? null;

  if (!targetWorkspaceId) {
    return { workspaceId: null, entitlements: null, allowed: false };
  }

  const subscription = await getWorkspaceSubscription(targetWorkspaceId);
  const accessActive = hasEffectiveBillingAccess(subscription);
  const entitlements = resolveBillingEntitlements(subscription.billing_plan_id, subscription.is_access_active);
  const allowed = accessActive && hasEntitlement(entitlements, entitlementKey);

  return { workspaceId: targetWorkspaceId, entitlements, allowed };
}

export async function requireEntitlement(
  entitlementKey: EntitlementKey,
  workspaceId?: string
): Promise<RequireEntitlementResult> {
  const access = await getEntitlementAccess(entitlementKey, workspaceId);
  if (!access.workspaceId || !access.entitlements || !access.allowed) {
    redirect(`/billing?blocked=${encodeURIComponent(entitlementKey)}`);
  }
  return { workspaceId: access.workspaceId, entitlements: access.entitlements };
}
