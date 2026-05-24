import "server-only";

import { NextResponse } from "next/server";
import {
  resolveBillingEntitlements,
  getFullEntitlements
} from "@/lib/billing/entitlements";
import {
  getPublicBillingPlanId
} from "@/lib/billing/plans";
import { userOwnsBusiness } from "@/lib/server/launch-access";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  hasEntitlement,
  type EntitlementKey
} from "@/src/billing/entitlements";
import {
  getRecommendedUpgradePlan,
  getRecommendedPlanName,
  getUpgradeCopy,
  getUpgradeHref
} from "@/src/billing/upgrade";

export type BillingWorkspaceSelectionError =
  | "workspace_required"
  | "workspace_ambiguous"
  | "workspace_forbidden"
  | "workspace_not_found";

export type BillingWorkspaceSummary = {
  id: string;
  business_name: string | null;
  launch_access: boolean;
};

type ResolveBillingWorkspaceOptions = {
  allowAdmin?: boolean;
  userEmail?: string | null;
};

export type BusinessEntitlementAccess = Awaited<ReturnType<typeof getBusinessEntitlementAccess>>;

const normalizeUuid = (value: string | null | undefined) => (value ?? "").trim().replace(/[<>]/g, "");

export const normalizeWorkspaceId = normalizeUuid;

export const isAdminUser = async (userId: string): Promise<boolean> => {
  if (!userId) return false;

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BILLING_ADMIN_ROLE_CONFIG_MISSING]", { userId });
    return false;
  }
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
};

export const listOwnedBillingBusinesses = async (userId: string): Promise<BillingWorkspaceSummary[]> => {
  if (!userId) return [];

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BILLING_OWNED_BUSINESSES_CONFIG_MISSING]", { userId });
    return [];
  }
  const { data, error } = await admin
    .from("businesses")
    .select("id, business_name, launch_access")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BILLING_OWNED_BUSINESSES_ERROR]", { userId, error });
    return [];
  }

  return (data ?? []) as BillingWorkspaceSummary[];
};

export const canAccessBillingWorkspace = async (
  userId: string,
  workspaceId: string,
  options: ResolveBillingWorkspaceOptions = {}
): Promise<boolean> => {
  const normalizedWorkspaceId = normalizeUuid(workspaceId);
  if (!userId || !normalizedWorkspaceId) return false;

  if (await userOwnsBusiness(userId, normalizedWorkspaceId)) {
    return true;
  }

  if (!options.allowAdmin) {
    return false;
  }

  return isAdminUser(userId);
};

export const resolveBillingWorkspaceSelection = async (
  userId: string,
  requestedWorkspaceId?: string | null,
  options: ResolveBillingWorkspaceOptions = {}
): Promise<{
  businessId: string | null;
  businesses: BillingWorkspaceSummary[];
  error: BillingWorkspaceSelectionError | null;
}> => {
  const normalizedRequestedWorkspaceId = normalizeUuid(requestedWorkspaceId);
  const businesses = await listOwnedBillingBusinesses(userId);

  if (normalizedRequestedWorkspaceId) {
    const canAccess = await canAccessBillingWorkspace(userId, normalizedRequestedWorkspaceId, options);
    if (!canAccess) {
      const admin = options.allowAdmin ? await isAdminUser(userId) : false;
      return {
        businessId: null,
        businesses,
        error: admin ? "workspace_not_found" : "workspace_forbidden"
      };
    }

    return {
      businessId: normalizedRequestedWorkspaceId,
      businesses,
      error: null
    };
  }

  if (businesses.length === 1) {
    return {
      businessId: businesses[0]?.id ?? null,
      businesses,
      error: null
    };
  }

  if (businesses.length > 1) {
    return {
      businessId: null,
      businesses,
      error: "workspace_ambiguous"
    };
  }

  return {
    businessId: null,
    businesses,
    error: "workspace_required"
  };
};

export const getBusinessEntitlementAccess = async (
  businessId: string,
  entitlementKey: EntitlementKey
) => {
  if (process.env.PAYSERA_ENABLED === "off") {
    const subscription = await getWorkspaceSubscription(businessId);
    const entitlements = getFullEntitlements();
    const upgrade = getUpgradeCopy(entitlementKey);
    return {
      subscription,
      entitlements,
      accessActive: true,
      allowed: true,
      entitlementIncluded: true,
      currentPlanId: subscription.plan_id,
      currentBillingPlanId: getPublicBillingPlanId(subscription.raw_billing_plan_id),
      recommendedPlanId: null,
      recommendedPlanName: null,
      upgradeHref: getUpgradeHref(entitlementKey),
      upgrade
    };
  }

  const subscription = await getWorkspaceSubscription(businessId);
  const accessActive = subscription.is_access_active;
  const entitlements = resolveBillingEntitlements(subscription.raw_billing_plan_id, accessActive);
  const entitlementIncluded = hasEntitlement(
    resolveBillingEntitlements(subscription.raw_billing_plan_id, true),
    entitlementKey
  );
  const allowed = accessActive && entitlementIncluded;
  const upgrade = getUpgradeCopy(entitlementKey);

  return {
    subscription,
    entitlements,
    accessActive,
    allowed,
    entitlementIncluded,
    currentPlanId: subscription.plan_id,
    currentBillingPlanId: getPublicBillingPlanId(subscription.raw_billing_plan_id),
    recommendedPlanId: getRecommendedUpgradePlan(entitlementKey),
    recommendedPlanName: getRecommendedPlanName(entitlementKey),
    upgradeHref: getUpgradeHref(entitlementKey),
    upgrade
  };
};

export const buildUpgradeRequiredPayload = (
  entitlementKey: EntitlementKey,
  access: BusinessEntitlementAccess
) => {
  if (!access.accessActive) {
    return {
      error: "SUBSCRIPTION_INACTIVE",
      requiredEntitlement: entitlementKey,
      recommendedPlan: access.recommendedPlanId,
      subscriptionStatus: access.subscription.status,
      message:
        "Your workspace billing is not active right now. Update billing to restore access to this feature.",
      upgradeUrl: access.upgradeHref
    };
  }

  return {
    error: "UPGRADE_REQUIRED",
    requiredEntitlement: entitlementKey,
    recommendedPlan: access.recommendedPlanId,
    subscriptionStatus: access.subscription.status,
    message: access.upgrade.description,
    upgradeUrl: access.upgradeHref
  };
};

export const buildUpgradeRequiredResponse = (
  entitlementKey: EntitlementKey,
  access: BusinessEntitlementAccess
) => NextResponse.json(buildUpgradeRequiredPayload(entitlementKey, access), { status: 403 });
