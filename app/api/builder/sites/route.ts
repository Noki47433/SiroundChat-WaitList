import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { isAuthDisabled } from "@/lib/config/auth";

export const runtime = "nodejs";

export async function GET() {
  if (isAuthDisabled()) {
    return NextResponse.json({ sites: [] });
  }

  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantFromSession();
  if (!tenant.businessId) {
    return NextResponse.json({ sites: [] });
  }

  const { data: sites, error } = await (supabase as any)
    .from("builder_sites")
    .select("id,business_name,slug,status,published_url,updated_at")
    .eq("business_id", tenant.businessId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sites: sites ?? [] });
}
