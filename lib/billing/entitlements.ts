import {
  mapBillingPlanToEntitlementPlan,
  type BillingPlanId,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";
import {
  resolveEntitlements,
  type Entitlements,
  type EntitlementKey
} from "@/src/billing/entitlements";

export type BillingAccessSnapshot = {
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
};

const parseTime = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isDevBillingBypassEnabled = () => {
  if (process.env.NODE_ENV === "production") return false;

  const explicitFlag = process.env.BILLING_DEV_ACCESS ?? process.env.NEXT_PUBLIC_BILLING_DEV_ACCESS;
  if (explicitFlag === "0" || explicitFlag === "false") return false;
  if (explicitFlag === "1" || explicitFlag === "true") return true;

  // Default-on in local development so teams can iterate on gated UI before live payment callbacks.
  return true;
};

export const hasActiveBillingAccess = (
  subscription: BillingAccessSnapshot | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!subscription) return false;

  if (isDevBillingBypassEnabled()) {
    return subscription.status !== "canceled";
  }

  const nowTs = now.getTime();

  if (subscription.status === "trialing") {
    const trialEnd = parseTime(subscription.trial_end);
    return trialEnd !== null && nowTs < trialEnd;
  }

  if (subscription.status === "active") {
    const periodEnd = parseTime(subscription.current_period_end);
    return periodEnd !== null && nowTs < periodEnd;
  }

  return false;
};

const lockEntitlements = (entitlements: Entitlements): Entitlements => {
  const locked = {} as Entitlements;
  (Object.keys(entitlements) as EntitlementKey[]).forEach((key) => {
    const value = entitlements[key];
    locked[key] = typeof value === "number" ? 0 : false;
  });
  return locked;
};

export const resolveBillingEntitlements = (
  billingPlanId: BillingPlanId,
  hasAccess: boolean
): Entitlements => {
  const entitlementPlan = mapBillingPlanToEntitlementPlan(billingPlanId);
  const baseEntitlements = resolveEntitlements(entitlementPlan);
  return hasAccess ? baseEntitlements : lockEntitlements(baseEntitlements);
};
