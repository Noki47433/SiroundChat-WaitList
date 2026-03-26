import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { listAllOwnedBuilderSites } from "@/lib/builder/site-access";

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

  if (!isPrelaunchUserAllowed(userData.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sites = await listAllOwnedBuilderSites<any>(
    userData.user.id,
    "id,business_name,slug,status,published_url,updated_at"
  );

  return NextResponse.json({ sites });
}
