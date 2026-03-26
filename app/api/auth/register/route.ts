import { NextResponse } from "next/server";
import { isPrelaunchEmailAllowed, normalizeEmail } from "@/lib/auth/prelaunch";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { RegisterSchema } from "@/lib/validation/auth";
import type { Database } from "@/lib/db/schema";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const redirect = resolveRedirectPath(json?.redirect, "/dashboard");
    const parsed = RegisterSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    if (isAuthDisabled()) {
      return NextResponse.json({ error: "Auth is disabled" }, { status: 503 });
    }

    const { name, email, password, businessName, industry } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    if (!isPrelaunchEmailAllowed(normalizedEmail)) {
      return NextResponse.json({ error: "Registration is not available yet." }, { status: 403 });
    }
    const fallbackName = normalizedEmail.split("@")[0] || "SiroundChat User";
    const safeName = (name ?? "").trim() || fallbackName;
    const safeBusinessName = (businessName ?? "").trim() || `${safeName} Business`;
    const safeIndustry = industry ?? "other";

    const admin = getSupabaseAdminClientIfAvailable();
    if (!admin) {
      console.error("[AUTH_REGISTER_CONFIG_MISSING]");
      return NextResponse.json({ error: "Registration is unavailable right now." }, { status: 500 });
    }
    const db = admin as any;

    const { data: userResult, error: userError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: safeName,
        business_name: safeBusinessName,
        industry: safeIndustry
      }
    });

    if (userError || !userResult.user) {
      const message = userError?.message ?? "Unable to create account";
      const duplicateEmail =
        /already|exists|duplicate|registered/i.test(message) ||
        userError?.status === 422 ||
        userError?.code === "email_exists";
      if (duplicateEmail) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in instead." },
          { status: 409 }
        );
      }
      console.error("[AUTH_REGISTER_CREATE_USER_ERROR]", userError);
      return NextResponse.json({ error: "Registration is unavailable right now." }, { status: 500 });
    }

    const userId = userResult.user.id;

    const { data: business, error: businessError } = await db
      .from("businesses")
      .insert({
        owner_id: userId,
        business_name: safeBusinessName,
        industry: safeIndustry
      } as Database["public"]["Tables"]["businesses"]["Insert"])
      .select("id")
      .single();

    if (businessError) {
      console.error("[AUTH_REGISTER_BUSINESS_INSERT_ERROR]", businessError);
    }

    const supabase = getSupabaseRouteClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });
    if (signInError) {
      return NextResponse.json({ error: "Account created, but sign-in failed." }, { status: 401 });
    }

    return NextResponse.json({ redirect, userId, businessId: business?.id ?? null }, { status: 201 });
  } catch (error) {
    console.error("[AUTH_REGISTER_UNHANDLED_ERROR]", error);
    return NextResponse.json({ error: "Registration is unavailable right now." }, { status: 500 });
  }
}
