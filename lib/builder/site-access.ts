import "server-only";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";

const getOwnedBusiness = async (businessId: string, userId: string) => {
  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BUILDER_PAGE_CONFIG_MISSING]", { businessId, userId });
    return null;
  }
  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .maybeSingle();

  if (error) {
    console.error("[BUILDER_PAGE_BUSINESS_LOOKUP_ERROR]", error);
    return null;
  }

  return data as { id?: string } | null;
};

export const listOwnedBusinessIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BUILDER_OWNED_BUSINESS_CONFIG_MISSING]", { userId });
    return [];
  }
  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BUILDER_OWNED_BUSINESS_LIST_ERROR]", error);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row: { id?: string | null }) => row.id?.trim())
        .filter((value: string | undefined): value is string => Boolean(value))
    )
  );
};

export const getOwnedBuilderSite = async <T = Record<string, unknown>>(
  siteId: string,
  userId: string,
  select: string
): Promise<T | null> => {
  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BUILDER_PAGE_SITE_CONFIG_MISSING]", { siteId, userId });
    return null;
  }
  const selectFields = new Set(
    select
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean)
  );
  selectFields.add("owner_user_id");
  selectFields.add("business_id");

  const { data, error } = await admin
    .from("builder_sites")
    .select(Array.from(selectFields).join(","))
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    console.error("[BUILDER_PAGE_SITE_LOOKUP_ERROR]", error);
    return null;
  }

  const site = data as { owner_user_id?: string | null; business_id?: string | null } | null;
  if (!site) return null;

  if (site.owner_user_id === userId) {
    return data as T;
  }

  if (!site.business_id) {
    return null;
  }

  const business = await getOwnedBusiness(site.business_id, userId);
  return business?.id ? (data as T) : null;
};

export const listOwnedBuilderSites = async <T = Record<string, unknown>>(
  businessId: string,
  userId: string,
  select: string
): Promise<T[]> => {
  const business = await getOwnedBusiness(businessId, userId);
  if (!business?.id) {
    return [];
  }

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BUILDER_PAGE_SITE_LIST_CONFIG_MISSING]", { businessId, userId });
    return [];
  }
  const { data, error } = await admin
    .from("builder_sites")
    .select(select)
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[BUILDER_PAGE_SITE_LIST_ERROR]", error);
    return [];
  }

  return (data ?? []) as T[];
};

export const listAllOwnedBuilderSites = async <T = Record<string, unknown>>(
  userId: string,
  select: string
): Promise<T[]> => {
  const businessIds = await listOwnedBusinessIds(userId);
  if (!businessIds.length) {
    return [];
  }

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BUILDER_ALL_SITE_CONFIG_MISSING]", { userId });
    return [];
  }
  const { data, error } = await admin
    .from("builder_sites")
    .select(select)
    .in("business_id", businessIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[BUILDER_ALL_SITE_LIST_ERROR]", error);
    return [];
  }

  return (data ?? []) as T[];
};
