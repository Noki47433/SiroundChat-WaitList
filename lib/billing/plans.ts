import {
  getPlanDefinition,
  type PlanDefinition,
  type PlanId as EntitlementPlanId
} from "@/src/billing/plans";

export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = "EUR";
export const SETUP_AMOUNT_CENTS = 100;
export const PENDING_PAYMENT_STALE_MINUTES = 30;

export const PUBLIC_BILLING_PLAN_IDS = [
  "website_only",
  "chatbot_only",
  "website_chatbot",
  "social_inbox",
  "omni_channel"
] as const;

export const LEGACY_BILLING_PLAN_IDS = ["website_19", "chatbot_19", "bundle_29"] as const;

export const BILLING_PLAN_IDS = [...PUBLIC_BILLING_PLAN_IDS, ...LEGACY_BILLING_PLAN_IDS] as const;

export type PublicBillingPlanId = (typeof PUBLIC_BILLING_PLAN_IDS)[number];
export type LegacyBillingPlanId = (typeof LEGACY_BILLING_PLAN_IDS)[number];
export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

export const BILLING_SUBSCRIPTION_STATUSES = [
  "pending_setup",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "free_internal"
] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_PAYMENT_KINDS = ["setup", "renewal"] as const;
export type BillingPaymentKind = (typeof BILLING_PAYMENT_KINDS)[number];

export type BillingPlanDefinition = {
  id: BillingPlanId;
  publicId: PublicBillingPlanId;
  name: string;
  priceCents: number;
  currency: "EUR";
  interval: "month";
  entitlementPlanId: EntitlementPlanId;
  badge?: PlanDefinition["badge"];
  subtitle: string;
  features: string[];
  legacy?: boolean;
};

const buildBillingPlanDefinition = (
  id: BillingPlanId,
  publicId: PublicBillingPlanId,
  priceCents: number,
  entitlementPlanId: EntitlementPlanId,
  options?: {
    name?: string;
    legacy?: boolean;
  }
): BillingPlanDefinition => {
  const plan = getPlanDefinition(entitlementPlanId);
  return {
    id,
    publicId,
    name: options?.name ?? plan.name,
    priceCents,
    currency: "EUR",
    interval: "month",
    entitlementPlanId,
    badge: plan.badge,
    subtitle: plan.subtitle,
    features: [...plan.features],
    legacy: options?.legacy
  };
};

const BILLING_PLAN_MAP: Record<BillingPlanId, BillingPlanDefinition> = {
  website_only: buildBillingPlanDefinition("website_only", "website_only", 1999, "website_only"),
  chatbot_only: buildBillingPlanDefinition("chatbot_only", "chatbot_only", 1999, "chatbot_only"),
  website_chatbot: buildBillingPlanDefinition("website_chatbot", "website_chatbot", 3499, "website_chatbot"),
  social_inbox: buildBillingPlanDefinition("social_inbox", "social_inbox", 2999, "social_inbox"),
  omni_channel: buildBillingPlanDefinition("omni_channel", "omni_channel", 4999, "omni_channel"),
  website_19: buildBillingPlanDefinition("website_19", "website_only", 1900, "website_only", {
    name: "Legacy Website",
    legacy: true
  }),
  chatbot_19: buildBillingPlanDefinition("chatbot_19", "chatbot_only", 1900, "chatbot_only", {
    name: "Legacy Chatbot",
    legacy: true
  }),
  bundle_29: buildBillingPlanDefinition("bundle_29", "website_chatbot", 2900, "website_chatbot", {
    name: "Legacy Bundle",
    legacy: true
  })
};

export const BILLING_PLANS = PUBLIC_BILLING_PLAN_IDS.map((id) => BILLING_PLAN_MAP[id]);

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return typeof value === "string" && (BILLING_PLAN_IDS as readonly string[]).includes(value);
}

export function isPublicBillingPlanId(value: unknown): value is PublicBillingPlanId {
  return typeof value === "string" && (PUBLIC_BILLING_PLAN_IDS as readonly string[]).includes(value);
}

export function getBillingPlan(planId: BillingPlanId): BillingPlanDefinition {
  return BILLING_PLAN_MAP[planId];
}

export function getPublicBillingPlan(planId: BillingPlanId): BillingPlanDefinition {
  return BILLING_PLAN_MAP[BILLING_PLAN_MAP[planId].publicId];
}

export function getPublicBillingPlanId(planId: BillingPlanId): PublicBillingPlanId {
  return BILLING_PLAN_MAP[planId].publicId;
}

export function mapBillingPlanToEntitlementPlan(planId: BillingPlanId): EntitlementPlanId {
  return BILLING_PLAN_MAP[planId].entitlementPlanId;
}
