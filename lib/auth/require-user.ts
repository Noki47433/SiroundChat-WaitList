import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/config/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export async function requireUser(redirectTo?: string) {
  if (isAuthDisabled()) return { user: null };

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    const safeRedirect = resolveRedirectPath(redirectTo, "/");
    const loginUrl = safeRedirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(safeRedirect)}`;
    redirect(loginUrl);
  }

  return { user: data.user };
}
