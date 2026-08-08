import "server-only";
import { randomUUID } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type Tenant = {
  userId: string;
  businessId: string;
};

// minimal row typing to avoid "never" issues if Database typing is incomplete
type BusinessRow = {
  id: string;
  owner_id: string;
  owner_user_id?: string | null;
  business_name?: string | null;
  industry?: string | null;
  access_approved?: boolean | null;
  onboarding_submitted?: boolean | null;
  onboarding_data?: Record<string, unknown> | null;
  widget_key?: string | null;
  timezone?: string | null;
  launch_access?: boolean | null;
  invite_code_id?: string | null;
};

const generateFallbackUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const generateWidgetKey = () => {
  try {
    return randomUUID();
  } catch {
    return generateFallbackUuid();
  }
};

const syncRestaurantAccess = async (
  supabase: ReturnType<typeof getSupabaseServerClient>,
  businessId: string,
  userId: string
) => {
  try {
    const { data: businessRow } = await (supabase as any)
      .from("businesses")
      .select("id, timezone")
      .eq("id", businessId)
      .maybeSingle();

    const timezone = businessRow?.timezone ?? "Europe/Belgrade";

    await (supabase as any).from("restaurants").insert({
      id: businessId,
      timezone,
      total_capacity: 40
    });

    await (supabase as any).from("restaurant_members").upsert(
      {
        restaurant_id: businessId,
        user_id: userId,
        role: "owner"
      },
      { onConflict: "restaurant_id,user_id" }
    );
  } catch {
    // Reservations migration may not be applied in every environment yet.
  }
};

/**
 * Returns business id for the given auth user id (owner_id).
 */
export async function getTenantFromSession(userId?: string): Promise<Tenant> {
  const supabase = getSupabaseServerClient();
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError) {
      console.error("[TENANT_USER_ERROR]", userError);
    }
    resolvedUserId = user?.id ?? "";
  }

  if (!resolvedUserId) {
    return { userId: "", businessId: "" };
  }

  const { data, error } = await (supabase as any)
    .from("businesses")
    .select("id, widget_key, launch_access")
    .or(`owner_id.eq.${resolvedUserId},owner_user_id.eq.${resolvedUserId}`)
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[TENANT_LOOKUP_ERROR]", error);
    return { userId: resolvedUserId, businessId: "" };
  }

  const row = data as { id?: string; widget_key?: string | null; launch_access?: boolean | null } | null;
  // F7-db (P0): tenant resolution is a READ path — it runs on every
  // requireBusinessUser() call. It must never write. Widget-key and
  // restaurant/member provisioning are handled at explicit write/provisioning
  // points only: app/api/auth/register (new signups), ensureBusinessRow()
  // below (onboarding / widget config), and ensureRestaurantBootstrap() on the
  // booking routes (service-role). Writing here caused per-request lock/write
  // contention and would fight the SEC-1 RLS policies once enabled.
  return { userId: resolvedUserId, businessId: row?.id ?? "" };
}

/**
 * Ensures a businesses row exists for owner_id=userId. Idempotent.
 * IMPORTANT: uses server client (RLS applies) so the authenticated user must be present.
 */
export async function ensureBusinessRow(args: {
  userId: string;
  businessName?: string | null;
  industry?: string | null;
}): Promise<Tenant> {
  const supabase = getSupabaseServerClient();

  // 1) find existing
  const { data: existing, error: existingError } = await (supabase as any)
    .from("businesses")
    .select("id, widget_key, launch_access")
    .or(`owner_id.eq.${args.userId},owner_user_id.eq.${args.userId}`)
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[BUSINESS_EXISTING_ERROR]", existingError);
  }

  const existingRow = existing as { id?: string; widget_key?: string | null; launch_access?: boolean | null } | null;
  if (existingRow?.id) {
    if (!existingRow.widget_key) {
      const widgetKey = generateWidgetKey();
      const { error: widgetError } = await (supabase as any)
        .from("businesses")
        .update({ widget_key: widgetKey })
        .eq("id", existingRow.id);
      if (widgetError) {
        console.error("[WIDGET_KEY_UPDATE_ERROR]", widgetError);
      }
    }
    await syncRestaurantAccess(supabase, existingRow.id, args.userId);
    return { userId: args.userId, businessId: existingRow.id };
  }

  // 2) create
  const insertPayload: Partial<BusinessRow> = {
    owner_id: args.userId,
    owner_user_id: args.userId,
    business_name: (args.businessName ?? "Your business").trim() || "Your business",
    industry: (args.industry ?? "other").trim() || "other",
    access_approved: false,
    onboarding_submitted: false,
    launch_access: false,
    onboarding_data: {},
    widget_key: generateWidgetKey()
  };

  const { data: created, error: createError } = await (supabase as any)
    .from("businesses")
    .insert(insertPayload)
    .select("id")
    .single();

  if (createError) {
    console.error("[BUSINESS_CREATE_ERROR]", createError);
    throw new Error(createError.message ?? "Failed to create business row");
  }

  const createdRow = created as { id?: string } | null;
  if (!createdRow?.id) {
    throw new Error("Failed to create business row (missing id)");
  }

  await syncRestaurantAccess(supabase, createdRow.id, args.userId);

  return { userId: args.userId, businessId: createdRow.id };
}
