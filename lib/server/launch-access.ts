import "server-only";

import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";

type OwnedBusinessAccessRow = {
  id: string;
  business_name: string | null;
  launch_access: boolean | null;
  invite_code_id: string | null;
  created_at: string | null;
};

const OWNED_BUSINESS_ACCESS_SELECT = "id,business_name,launch_access,invite_code_id,created_at";

const logMissingAdmin = (context: string, userId?: string, businessId?: string) => {
  console.error("[LAUNCH_ACCESS_CONFIG_MISSING]", { context, userId, businessId });
};

export async function getOwnedBusinessAccess(userId: string, businessId?: string | null) {
  if (!userId) return null;

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    logMissingAdmin("getOwnedBusinessAccess", userId, businessId ?? undefined);
    return null;
  }

  let query = admin
    .from("businesses")
    .select(OWNED_BUSINESS_ACCESS_SELECT)
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`);

  if (businessId) {
    query = query.eq("id", businessId);
  }

  const { data, error } = await query
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[LAUNCH_ACCESS_LOOKUP_ERROR]", { userId, businessId, error });
    return null;
  }

  return (data as OwnedBusinessAccessRow | null) ?? null;
}

export async function userHasLaunchAccess(userId: string): Promise<boolean> {
  if (!userId) return false;

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    logMissingAdmin("userHasLaunchAccess", userId);
    return false;
  }

  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[LAUNCH_ACCESS_USER_LOOKUP_ERROR]", { userId, error });
    return false;
  }

  return Boolean(data?.id);
}

export async function userOwnsLaunchedBusiness(userId: string, businessId: string): Promise<boolean> {
  if (!userId || !businessId) return false;

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    logMissingAdmin("userOwnsLaunchedBusiness", userId, businessId);
    return false;
  }

  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .maybeSingle();

  if (error) {
    console.error("[LAUNCH_ACCESS_BUSINESS_LOOKUP_ERROR]", { userId, businessId, error });
    return false;
  }

  return Boolean(data?.id);
}
