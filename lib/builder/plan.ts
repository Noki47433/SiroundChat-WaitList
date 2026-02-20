import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  hasEntitlement,
  resolveEntitlements,
  type PlanId
} from "@/src/billing/entitlements";

type PlanFlags = {
  canPublish: boolean;
  canRegenerate: boolean;
};

const resolveFlags = (planId: PlanId): PlanFlags => {
  const entitlements = resolveEntitlements(planId);
  return {
    canPublish: hasEntitlement(entitlements, "publish_website"),
    canRegenerate: hasEntitlement(entitlements, "website_builder")
  };
};

export async function getBuilderPlanForBusiness(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  return { plan, flags: resolveFlags(plan) };
}

export async function getBuilderPlanForRoute(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  return { plan, flags: resolveFlags(plan) };
}
