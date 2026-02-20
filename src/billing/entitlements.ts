import {
  resolveEntitlements as resolveFromPlans,
  type Entitlements,
  type EntitlementKey,
  type PlanId
} from "@/src/billing/plans";

export { type Entitlements, type EntitlementKey, type PlanId };

export function resolveEntitlements(planId: PlanId): Entitlements {
  return resolveFromPlans(planId);
}

export function hasEntitlement(entitlements: Entitlements | null | undefined, key: EntitlementKey): boolean {
  if (!entitlements) return false;
  const value = entitlements[key];
  if (typeof value === "number") return value > 0;
  return Boolean(value);
}

export function getLimit(entitlements: Entitlements | null | undefined, key: EntitlementKey): number | boolean {
  if (!entitlements) return false;
  const value = entitlements[key];
  if (typeof value === "number") return value;
  return Boolean(value);
}
