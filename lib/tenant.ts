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
  business_name?: string | null;
  industry?: string | null;
  widget_key?: string | null;
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
    .select("id, widget_key")
    .eq("owner_id", resolvedUserId)
    .maybeSingle();

  if (error) {
    console.error("[TENANT_LOOKUP_ERROR]", error);
    return { userId: resolvedUserId, businessId: "" };
  }

  const row = data as { id?: string; widget_key?: string | null } | null;
  if (row?.id && !row.widget_key) {
    const widgetKey = generateWidgetKey();
    const { error: widgetError } = await (supabase as any)
      .from("businesses")
      .update({ widget_key: widgetKey })
      .eq("id", row.id);
    if (widgetError) {
      console.error("[WIDGET_KEY_BACKFILL_ERROR]", widgetError);
    }
  }
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
    .select("id, widget_key")
    .eq("owner_id", args.userId)
    .maybeSingle();

  if (existingError) {
    console.error("[BUSINESS_EXISTING_ERROR]", existingError);
  }

  const existingRow = existing as { id?: string; widget_key?: string | null } | null;
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
    return { userId: args.userId, businessId: existingRow.id };
  }

  // 2) create
  const insertPayload: Partial<BusinessRow> = {
    owner_id: args.userId,
    business_name: (args.businessName ?? "Your business").trim() || "Your business",
    industry: (args.industry ?? "other").trim() || "other",
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

  return { userId: args.userId, businessId: createdRow.id };
}
