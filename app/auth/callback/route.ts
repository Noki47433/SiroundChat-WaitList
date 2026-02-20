import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/builder/onboarding";
  const origin = url.origin;

  if (!code) return NextResponse.redirect(`${origin}${next}`);

  const supabase = getSupabaseRouteClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/builder/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
