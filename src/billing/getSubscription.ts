import "server-only";
import {
  hasActiveBillingAccess
} from "@/lib/billing/entitlements";
import {
  isBillingPlanId,
  mapBillingPlanToEntitlementPlan,
  type BillingPlanId,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import type { PlanId } from "@/src/billing/plans";

export type WorkspaceSubscription = {
  id: string;
  business_id: string;
  billing_plan_id: BillingPlanId;
  plan_id: PlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string;
  created_at: string;
  updated_at: string;
  is_access_active: boolean;
};

const SUBSCRIPTION_SELECT =
  "id,business_id,plan_id,status,trial_end,current_period_end,created_at,updated_at";

const defaultWorkspaceSubscription = (workspaceId: string): WorkspaceSubscription => {
  const nowIso = new Date().toISOString();
  return {
    id: "missing",
    business_id: workspaceId,
    billing_plan_id: "website_19",
    plan_id: "website",
    status: "canceled",
    trial_end: null,
    current_period_end: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    is_access_active: false
  };
};

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const db = getSupabaseServerAdminClient() as any;

  const { data: existing, error } = await db
    .from("billing_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("business_id", workspaceId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[BILLING_SUBSCRIPTION_LOOKUP_ERROR]", { workspaceId, error });
    return defaultWorkspaceSubscription(workspaceId);
  }

  if (!existing) {
    return defaultWorkspaceSubscription(workspaceId);
  }

  const row = existing as {
    id: string;
    business_id: string;
    plan_id: string;
    status: BillingSubscriptionStatus;
    trial_end: string | null;
    current_period_end: string | null;
    created_at: string;
    updated_at: string;
  };

  const billingPlanId: BillingPlanId = isBillingPlanId(row.plan_id) ? row.plan_id : "website_19";
  const planId = mapBillingPlanToEntitlementPlan(billingPlanId);
  const subscription: WorkspaceSubscription = {
    id: row.id,
    business_id: row.business_id,
    billing_plan_id: billingPlanId,
    plan_id: planId,
    status: row.status,
    trial_end: row.trial_end,
    current_period_end: row.current_period_end ?? row.updated_at ?? row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_access_active: hasActiveBillingAccess({
      status: row.status,
      trial_end: row.trial_end,
      current_period_end: row.current_period_end
    })
  };

  return subscription;
}
