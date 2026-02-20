import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/src/billing/plans";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export type WorkspaceSubscription = {
  id: string;
  business_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_SELECT =
  "id,business_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at";

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const db = getSupabaseAdminClient() as any;

  const { data: existing } = await db
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("business_id", workspaceId)
    .maybeSingle();

  if (existing) {
    return existing as WorkspaceSubscription;
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: created, error } = await db
    .from("subscriptions")
    .upsert(
      {
        business_id: workspaceId,
        plan: "local_basic",
        plan_id: "website",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false
      },
      { onConflict: "business_id" }
    )
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to resolve subscription");
  }

  return created as WorkspaceSubscription;
}
