import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isAuthDisabled } from "@/lib/config/auth";
import { isPrelaunchModeEnabled, isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export async function requireUser(redirectTo?: string) {
  if (isAuthDisabled()) return { user: null };

  let user: User | null = null;
  let error: unknown = null;

  try {
    const supabase = getSupabaseServerClient();
    const result = await supabase.auth.getUser();
    user = result.data.user ?? null;
    error = result.error;
  } catch (caughtError) {
    console.error("[REQUIRE_USER_ERROR]", caughtError);
    redirect("/");
  }

  if (error || !user) {
    if (isPrelaunchModeEnabled()) {
      redirect("/");
    }
    const safeRedirect = resolveRedirectPath(redirectTo, "/dashboard");
    redirect(`/auth?next=${encodeURIComponent(safeRedirect)}`);
  }

  if (isPrelaunchModeEnabled() && !isPrelaunchUserAllowed(user)) {
    redirect("/");
  }

  return { user };
}
