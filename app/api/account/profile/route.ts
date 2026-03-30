import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(120)
});

const loadProfile = async (userId: string) => {
  const supabase = getSupabaseRouteClient();
  const tenant = await getTenantFromSession(userId);
  if (!tenant.businessId) {
    return null;
  }

  const [{ data: userData }, { data: profile }, { data: business }] = await Promise.all([
    supabase.auth.getUser(),
    (supabase as any).from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    (supabase as any).from("businesses").select("timezone").eq("id", tenant.businessId).maybeSingle()
  ]);

  const user = userData?.user ?? null;
  if (!user) {
    return null;
  }

  return {
    name:
      (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
      "Team Member",
    email: user.email ?? "",
    timezone: (business?.timezone as string | null) ?? "Europe/Belgrade"
  };
};

export async function GET() {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: { "Cache-Control": "no-store" }
  });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = ProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    return NextResponse.json({ error: "Profile updates are unavailable right now." }, { status: 500 });
  }

  const { error: profileError } = await (admin as any)
    .from("profiles")
    .upsert({ id: user.id, full_name: parsed.data.name }, { onConflict: "id" });

  if (profileError) {
    console.error("[ACCOUNT_PROFILE_UPDATE_ERROR]", profileError);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  const { error: businessError } = await (admin as any)
    .from("businesses")
    .update({ timezone: parsed.data.timezone })
    .eq("id", tenant.businessId);

  if (businessError) {
    console.error("[ACCOUNT_BUSINESS_TIMEZONE_UPDATE_ERROR]", businessError);
    return NextResponse.json({ error: "Failed to update timezone" }, { status: 500 });
  }

  return NextResponse.json({
    name: parsed.data.name,
    email: user.email ?? "",
    timezone: parsed.data.timezone
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
