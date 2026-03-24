import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validation/auth";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const redirect = resolveRedirectPath(json?.redirect, "/dashboard");
  const parsed = LoginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  if (isAuthDisabled()) {
    return NextResponse.json({ redirect, demo: true });
  }

  const supabase = getSupabaseRouteClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ redirect });
}
