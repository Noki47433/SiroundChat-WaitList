import { NextResponse } from "next/server";
import { guardPrivateRouteUser } from "@/lib/auth/route-guard";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { userOwnsLaunchedBusiness } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import type { EntitlementKey } from "@/src/billing/entitlements";

export type AuthContext = {
  userId: string;
  businessId: string;
  supabase: ReturnType<typeof getSupabaseRouteClient>;
};

type RequireBusinessUserOptions = {
  entitlement?: EntitlementKey;
};

type RequireBusinessUserResult =
  | { context: AuthContext; response: null }
  | { context: AuthContext; response: NextResponse };

export async function requireBusinessUser(
  options: RequireBusinessUserOptions = {}
): Promise<RequireBusinessUserResult> {
  const guard = await guardPrivateRouteUser();
  if (!guard.ok) {
    return {
      context: { userId: "", businessId: "", supabase: guard.supabase },
      response: guard.response
    };
  }

  const tenant = await getTenantFromSession(guard.user.id);
  if (!tenant.businessId) {
    return {
      context: { userId: guard.user.id, businessId: "", supabase: guard.supabase },
      response: NextResponse.json({ error: "Business not found" }, { status: 404 })
    };
  }

  const hasLaunchAccess = await userOwnsLaunchedBusiness(guard.user.id, tenant.businessId);
  if (!hasLaunchAccess) {
    return {
      context: { userId: guard.user.id, businessId: tenant.businessId, supabase: guard.supabase },
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  if (options.entitlement) {
    const access = await getBusinessEntitlementAccess(tenant.businessId, options.entitlement);
    if (!access.allowed) {
      return {
        context: { userId: guard.user.id, businessId: tenant.businessId, supabase: guard.supabase },
        response: buildUpgradeRequiredResponse(options.entitlement, access)
      };
    }
  }

  return {
    context: { userId: guard.user.id, businessId: tenant.businessId, supabase: guard.supabase },
    response: null
  };
}
