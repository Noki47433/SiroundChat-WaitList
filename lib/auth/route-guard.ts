import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isPrelaunchModeEnabled, isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

type GuardedRouteUser =
  | {
      ok: true;
      user: User;
      supabase: ReturnType<typeof getSupabaseRouteClient>;
    }
  | {
      ok: false;
      user: null;
      supabase: ReturnType<typeof getSupabaseRouteClient>;
      response: NextResponse;
    };

export async function guardPrivateRouteUser(): Promise<GuardedRouteUser> {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      user: null,
      supabase,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (isPrelaunchModeEnabled() && !isPrelaunchUserAllowed(user)) {
    return {
      ok: false,
      user: null,
      supabase,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    ok: true,
    user,
    supabase
  };
}
