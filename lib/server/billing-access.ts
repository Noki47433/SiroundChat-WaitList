import "server-only";

import { isPrelaunchEmailAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
  hasEntitlement,
  resolveEntitlements,
  type EntitlementKey
} from "@/src/billing/entitlements";

export type BillingWorkspaceSelectionError =
  | "workspace_required"
  | "workspace_ambiguous"
  | "workspace_forbidden"
  | "workspace_not_found";

export type BillingWorkspaceSummary = {
  id: string;
  business_name: string | null;
};

type ResolveBillingWorkspaceOptions = {
  allowAdmin?: boolean;
  userEmail?: string | null;
};

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
    .select("id, business_name")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
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

  const ownedBusinesses = await listOwnedBillingBusinesses(userId);
  if (ownedBusinesses.some((business) => business.id === normalizedWorkspaceId)) {
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
  if (!isPrelaunchEmailAllowed(options.userEmail)) {
    return {
      businessId: null,
      businesses: [],
      error: "workspace_forbidden"
    };
  }
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
  const subscription = await getWorkspaceSubscription(businessId);
  const entitlements = resolveEntitlements(subscription.plan_id);
  const allowed = subscription.is_access_active && hasEntitlement(entitlements, entitlementKey);

  return {
    subscription,
    entitlements,
    allowed
  };
};
