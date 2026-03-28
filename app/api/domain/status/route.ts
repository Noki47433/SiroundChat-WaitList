import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { isAuthDisabled } from "@/lib/config/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  if (!isAuthDisabled()) {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const tenant = await getTenantFromSession(user.id);
    if (!tenant.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: site } = await (supabase as any)
      .from("builder_sites")
      .select("id")
      .eq("id", siteId)
      .eq("business_id", tenant.businessId)
      .maybeSingle();

    if (!site?.id) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { data: domain } = await (supabase as any)
      .from("builder_domains")
      .select("domain,status")
      .eq("site_id", siteId)
      .maybeSingle();

    if (!domain) {
      return NextResponse.json({ siteId, status: "unregistered" });
    }

    return NextResponse.json({ siteId, domain: domain.domain, status: domain.status });
  }

  return NextResponse.json({ siteId, status: "unregistered" });
}
