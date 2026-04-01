import {
  getFullEntitlements
} from "@/lib/billing/entitlements";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  type PlanId
} from "@/src/billing/entitlements";

type PlanFlags = {
  canPublish: boolean;
  canRegenerate: boolean;
};

export async function getBuilderPlanForBusiness(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  const entitlements = getFullEntitlements();
  return {
    plan,
    flags: {
      canPublish: Boolean(entitlements.publish_website),
      canRegenerate: Boolean(entitlements.website_builder)
    }
  };
}

export async function getBuilderPlanForRoute(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = (subscription.plan_id ?? "website") as PlanId;
  const entitlements = getFullEntitlements();
  return {
    plan,
    flags: {
      canPublish: Boolean(entitlements.publish_website),
      canRegenerate: Boolean(entitlements.website_builder)
    }
  };
}
