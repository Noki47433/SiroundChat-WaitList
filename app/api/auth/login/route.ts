import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validation/auth";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const redirect = resolveRedirectPath(json?.redirect, "/dashboard");
    const parsed = LoginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    if (isAuthDisabled()) {
      return NextResponse.json({ redirect, demo: true });
    }

    const email = normalizeEmail(parsed.data.email);
    const supabase = getSupabaseRouteClient();
    const { error } = await supabase.auth.signInWithPassword({
      ...parsed.data,
      email
    });
    if (error) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return NextResponse.json({ redirect });
  } catch (error) {
    console.error("[AUTH_LOGIN_UNHANDLED_ERROR]", error);
    return NextResponse.json({ error: "Login is unavailable right now." }, { status: 500 });
  }
}
