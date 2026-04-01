import "server-only";

import {
  getFullEntitlements
} from "@/lib/billing/entitlements";
import { userOwnsLaunchedBusiness } from "@/lib/server/launch-access";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import {
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
  launch_access: boolean;
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
    .select("id, business_name, launch_access")
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

  if (await userOwnsLaunchedBusiness(userId, normalizedWorkspaceId)) {
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
  const eligibleBusinesses = businesses.filter((business) => business.launch_access);

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

  if (eligibleBusinesses.length === 1) {
    return {
      businessId: eligibleBusinesses[0]?.id ?? null,
      businesses,
      error: null
    };
  }

  if (eligibleBusinesses.length > 1) {
    return {
      businessId: null,
      businesses,
      error: "workspace_ambiguous"
    };
  }

  return {
    businessId: null,
    businesses,
    error: businesses.length > 0 ? "workspace_forbidden" : "workspace_required"
  };
};

export const getBusinessEntitlementAccess = async (
  businessId: string,
  entitlementKey: EntitlementKey
) => {
  const subscription = await getWorkspaceSubscription(businessId);
  void entitlementKey;
  const accessActive = true;
  const entitlements = getFullEntitlements();
  const allowed = true;

  return {
    subscription,
    entitlements,
    accessActive,
    allowed
  };
};
