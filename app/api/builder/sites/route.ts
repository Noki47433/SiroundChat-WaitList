import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { listOwnedBuilderSites } from "@/lib/builder/site-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (isAuthDisabled()) {
    return NextResponse.json({ sites: [] });
  }

  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenantFromSession(userData.user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(tenant.businessId, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  const sites = await listOwnedBuilderSites<any>(
    tenant.businessId,
    userData.user.id,
    "id,business_name,slug,status,published_url,updated_at"
  );

  return NextResponse.json({ sites });
}
