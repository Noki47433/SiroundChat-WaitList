import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActivityActorType = "business_user" | "system" | "admin";

export type LogActivityInput = {
  businessId: string;
  userId?: string | null;
  actorType?: ActivityActorType;
  eventType: string;
  summary: string;
  meta?: Record<string, unknown>;
};

export async function logActivity(input: LogActivityInput) {
  if (!input.businessId || !input.eventType || !input.summary) {
    return null;
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await (admin as any)
      .from("activity_events")
      .insert({
        business_id: input.businessId,
        user_id: input.userId ?? null,
        actor_type: input.actorType ?? "business_user",
        event_type: input.eventType,
        summary: input.summary,
        meta: input.meta ?? {}
      })
      .select("id, created_at")
      .maybeSingle();

    if (error) {
      console.error("[ACTIVITY_LOG_ERROR]", error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error("[ACTIVITY_LOG_THROW]", error);
    return null;
  }
}

