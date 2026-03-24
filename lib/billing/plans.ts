import type { PlanId as EntitlementPlanId } from "@/src/billing/plans";

export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = "EUR";
export const SETUP_AMOUNT_CENTS = 100;

export const BILLING_PLAN_IDS = ["website_19", "chatbot_19", "bundle_29"] as const;
export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

export const BILLING_SUBSCRIPTION_STATUSES = [
  "pending_setup",
  "trialing",
  "active",
  "past_due",
  "canceled"
] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_PAYMENT_KINDS = ["setup", "renewal"] as const;
export type BillingPaymentKind = (typeof BILLING_PAYMENT_KINDS)[number];

export type BillingPlanDefinition = {
  id: BillingPlanId;
  name: string;
  priceCents: number;
  currency: "EUR";
  interval: "month";
  entitlementPlanId: EntitlementPlanId;
};

const BILLING_PLAN_MAP: Record<BillingPlanId, BillingPlanDefinition> = {
  website_19: {
    id: "website_19",
    name: "Website",
    priceCents: 1900,
    currency: "EUR",
    interval: "month",
    entitlementPlanId: "website"
  },
  chatbot_19: {
    id: "chatbot_19",
    name: "Chatbot",
    priceCents: 1900,
    currency: "EUR",
    interval: "month",
    entitlementPlanId: "chatbot"
  },
  bundle_29: {
    id: "bundle_29",
    name: "Bundle",
    priceCents: 2900,
    currency: "EUR",
    interval: "month",
    entitlementPlanId: "bundle"
  }
};

export const BILLING_PLANS = BILLING_PLAN_IDS.map((id) => BILLING_PLAN_MAP[id]);

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return typeof value === "string" && (BILLING_PLAN_IDS as readonly string[]).includes(value);
}

export function getBillingPlan(planId: BillingPlanId): BillingPlanDefinition {
  return BILLING_PLAN_MAP[planId];
}

export function mapBillingPlanToEntitlementPlan(planId: BillingPlanId): EntitlementPlanId {
  return BILLING_PLAN_MAP[planId].entitlementPlanId;
}
