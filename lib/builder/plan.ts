import {
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
  canAttachChatbotToWebsite: boolean;
};

async function resolveBuilderPlan(businessId: string) {
  const subscription = await getWorkspaceSubscription(businessId);
  const plan = subscription.plan_id as PlanId;
  const entitlements = resolveBillingEntitlements(
    subscription.raw_billing_plan_id,
    subscription.is_access_active
  );

  const flags: PlanFlags = {
    canPublish: hasEntitlement(entitlements, "publish_website"),
    canRegenerate: hasEntitlement(entitlements, "website_builder"),
    canAttachChatbotToWebsite: hasEntitlement(entitlements, "chatbot_website_injection")
  };

  return {
    plan,
    entitlements,
    flags
  };
}

export async function getBuilderPlanForBusiness(businessId: string) {
  return resolveBuilderPlan(businessId);
}

export async function getBuilderPlanForRoute(businessId: string) {
  return resolveBuilderPlan(businessId);
}
