import { NextResponse } from "next/server";
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
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      context: { userId: "", businessId: "", supabase },
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return {
      context: { userId: user.id, businessId: "", supabase },
      response: NextResponse.json({ error: "Business not found" }, { status: 404 })
    };
  }

  return {
    context: { userId: user.id, businessId: tenant.businessId, supabase },
    response: null
  };
}
