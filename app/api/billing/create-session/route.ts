import { NextResponse } from "next/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";

export async function POST(request: Request) {
  void request;

  let userId = "";
  if (!isAuthDisabled()) {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  const tenant = userId ? await getTenantFromSession(userId) : { userId: "", businessId: "" };
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Demo billing only. Checkout sessions are disabled." },
    { status: 400 }
  );
}
