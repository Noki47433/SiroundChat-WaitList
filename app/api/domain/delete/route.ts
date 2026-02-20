import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";

export async function POST(request: Request) {
  if (!isAuthDisabled()) {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = await request.json().catch(() => null);
  console.info("domain delete", payload);
  return NextResponse.json({ success: true });
}
