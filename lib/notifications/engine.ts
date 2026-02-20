import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/db/schema";

export type NotificationSeverity = "info" | "success" | "warning" | "critical" | "celebration";
export type NotificationCategory = "revenue" | "growth" | "ops" | "quality" | "product" | "insight";

export type NotificationPayload = {
  title: string;
  body: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  cta_label?: string | null;
  cta_url?: string | null;
  data?: Record<string, unknown>;
};

type BadgeDefinition = Database["public"]["Tables"]["badge_definitions"]["Row"];

const isDuplicateError = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  if (error.code === "23505") return true;
  return Boolean(error.message && error.message.toLowerCase().includes("duplicate"));
};

export async function createNotificationIfNotExists(
  businessId: string,
  payload: NotificationPayload,
  sourceType: string,
  sourceId: string
) {
  const admin = getSupabaseAdminClient();
  const data = {
    ...(payload.data ?? {}),
    source_type: sourceType,
    source_id: sourceId
  };

  const { data: inserted, error } = await (admin as any)
    .from("notifications")
    .insert({
      business_id: businessId,
      title: payload.title,
      body: payload.body,
      severity: payload.severity,
      category: payload.category,
      cta_label: payload.cta_label ?? null,
      cta_url: payload.cta_url ?? null,
      data
    })
    .select("*")
    .maybeSingle();

  if (isDuplicateError(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return inserted as Database["public"]["Tables"]["notifications"]["Row"] | null;
}

export async function createCelebrationNotificationForBadge(businessId: string, badge: BadgeDefinition) {
  return createNotificationIfNotExists(
    businessId,
    {
      title: `🏆 Badge earned: ${badge.name}`,
      body: badge.description,
      severity: "celebration",
      category: "growth",
      data: { confetti: true }
    },
    "badge",
    badge.key
  );
}

export async function awardBadgeIfNew(
  businessId: string,
  badgeKey: string,
  context: Record<string, unknown> = {}
) {
  const admin = getSupabaseAdminClient();
  const { data: badge, error: badgeError } = await (admin as any)
    .from("badge_definitions")
    .select("id, key, name, description, icon, rarity")
    .eq("key", badgeKey)
    .maybeSingle();

  if (badgeError || !badge) {
    return null;
  }

  const { data: insertedRows, error: insertError } = await (admin as any)
    .from("business_badges")
    .insert(
      {
        business_id: businessId,
        badge_id: badge.id,
        context
      },
      { onConflict: "business_id,badge_id", ignoreDuplicates: true }
    )
    .select("id, earned_at");

  if (insertError) {
    throw insertError;
  }

  const inserted = Array.isArray(insertedRows) && insertedRows.length ? insertedRows[0] : null;
  if (inserted) {
    await createCelebrationNotificationForBadge(businessId, badge as BadgeDefinition);
    return { badge: badge as BadgeDefinition, earned_at: inserted.earned_at };
  }

  return null;
}
