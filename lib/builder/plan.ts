import {
  hasEffectiveBillingAccess,
  resolveBillingEntitlements
} from "@/lib/billing/entitlements";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  hasEntitlement,
  type PlanId
} from "@/src/billing/entitlements";

type PlanFlags = {
  canPublish: boolean;
  canRegenerate: boolean;
};

export async function getBuilderPlanForBusiness(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  if (!hasEffectiveBillingAccess(subscription)) {
    return { plan, flags: { canPublish: false, canRegenerate: false } };
  }
  const entitlements = resolveBillingEntitlements(subscription.billing_plan_id, subscription.is_access_active);
  return {
    plan,
    flags: {
      canPublish: hasEntitlement(entitlements, "publish_website"),
      canRegenerate: hasEntitlement(entitlements, "website_builder")
    }
  };
}

export async function getBuilderPlanForRoute(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  if (!hasEffectiveBillingAccess(subscription)) {
    return { plan, flags: { canPublish: false, canRegenerate: false } };
  }
  const entitlements = resolveBillingEntitlements(subscription.billing_plan_id, subscription.is_access_active);
  return {
    plan,
    flags: {
      canPublish: hasEntitlement(entitlements, "publish_website"),
      canRegenerate: hasEntitlement(entitlements, "website_builder")
    }
  };
}
