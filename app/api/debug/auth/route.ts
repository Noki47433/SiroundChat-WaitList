import { NextResponse } from "next/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authDisabled = isAuthDisabled();
  const supabase = getSupabaseRouteClient();
  const { data } = await supabase.auth.getUser();

  return NextResponse.json({
    authDisabled,
    hasUser: !!data?.user,
    userId: data?.user?.id ?? null
  });
}
