import { NextResponse } from "next/server";
import { guardPrivateRouteUser } from "@/lib/auth/route-guard";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export type AuthContext = {
  userId: string;
  businessId: string;
  supabase: ReturnType<typeof getSupabaseRouteClient>;
};

type RequireBusinessUserResult =
  | { context: AuthContext; response: null }
  | { context: AuthContext; response: NextResponse };

export async function requireBusinessUser(): Promise<RequireBusinessUserResult> {
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

  return {
    context: { userId: guard.user.id, businessId: tenant.businessId, supabase: guard.supabase },
    response: null
  };
}
