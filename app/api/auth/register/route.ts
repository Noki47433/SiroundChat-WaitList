import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { RegisterSchema } from "@/lib/validation/auth";
import type { Database } from "@/lib/db/schema";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const redirect = resolveRedirectPath(json?.redirect, "/");
  const parsed = RegisterSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  if (isAuthDisabled()) {
    return NextResponse.json({ error: "Auth is disabled" }, { status: 503 });
  }

  const { name, email, password, businessName, industry } = parsed.data;
  const fallbackName = email.split("@")[0] || "SiroundChat User";
  const safeName = (name ?? "").trim() || fallbackName;
  const safeBusinessName = (businessName ?? "").trim() || `${safeName} Business`;
  const safeIndustry = industry ?? "other";

  const admin = getSupabaseAdminClient();
  const db = admin as any;

  const { data: userResult, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: safeName,
      business_name: safeBusinessName,
      industry: safeIndustry
    }
  });

  if (userError || !userResult.user) {
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }

  const userId = userResult.user.id;

  const { data: business } = await db
    .from("businesses")
    .insert({
      owner_id: userId,
      business_name: safeBusinessName,
      industry: safeIndustry
    } as Database["public"]["Tables"]["businesses"]["Insert"])
    .select("id")
    .single();

  if (business?.id) {
    await db.from("subscriptions").insert({
      business_id: business.id,
      plan: "free",
      status: "active"
    } as Database["public"]["Tables"]["subscriptions"]["Insert"]);
  }

  const supabase = getSupabaseRouteClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 401 });
  }

  return NextResponse.json({ redirect, userId, businessId: business?.id ?? null }, { status: 201 });
}
