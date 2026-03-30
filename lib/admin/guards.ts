import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";
import { getSupabaseRouteClient, getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  role: "admin" | "user";
};

type AdminRouteGuardResult =
  | {
      ok: true;
      profile: AdminProfile;
      userId: string;
      supabase: ReturnType<typeof getSupabaseRouteClient>;
    }
  | {
      ok: false;
      status: 401 | 403;
      response: NextResponse;
    };

const LOGIN_PATH = "/login";

export async function requireAdmin(redirectTo = "/admin") {
  if (isAuthDisabled()) {
    return {
      user: {
        id: "dev-admin",
        email: "dev-admin@siroundchat.local"
      },
      profile: {
        id: "dev-admin",
        full_name: "Dev Admin",
        role: "admin" as const
      }
    };
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    const safeRedirect = resolveRedirectPath(redirectTo, "/admin");
    redirect(`${LOGIN_PATH}?redirect=${encodeURIComponent(safeRedirect)}`);
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/403");
  }

  return {
    user,
    profile: profile as AdminProfile
  };
}

export async function guardAdminRoute(): Promise<AdminRouteGuardResult> {
  const supabase = getSupabaseRouteClient();

  if (isAuthDisabled()) {
    return {
      ok: true,
      userId: "dev-admin",
      profile: {
        id: "dev-admin",
        full_name: "Dev Admin",
        role: "admin"
      },
      supabase
    };
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      ok: false,
      status: 403,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    ok: true,
    userId: user.id,
    profile: profile as AdminProfile,
    supabase
  };
}
