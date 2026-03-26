import "server-only";
import {
  hasActiveBillingAccess
} from "@/lib/billing/entitlements";
import {
  PENDING_PAYMENT_STALE_MINUTES,
  isBillingPlanId,
  mapBillingPlanToEntitlementPlan,
  type BillingPaymentKind,
  type BillingPlanId,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import type { PlanId } from "@/src/billing/plans";

export type WorkspaceSubscription = {
  id: string;
  business_id: string;
  billing_plan_id: BillingPlanId;
  plan_id: PlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  is_access_active: boolean;
  pending_payment_kind: BillingPaymentKind | null;
  pending_payment_plan_id: BillingPlanId | null;
  pending_payment_created_at: string | null;
  pending_payment_is_stale: boolean;
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
    current_period_end: null,
    created_at: nowIso,
    updated_at: nowIso,
    is_access_active: false,
    pending_payment_kind: null,
    pending_payment_plan_id: null,
    pending_payment_created_at: null,
    pending_payment_is_stale: false
  };
};

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const db = getSupabaseServerAdminClientIfAvailable() as any;
  if (!db) {
    console.error("[BILLING_SUBSCRIPTION_CONFIG_MISSING]", { workspaceId });
    return defaultWorkspaceSubscription(workspaceId);
  }

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

  const { data: pendingPayment, error: pendingPaymentError } = await db
    .from("billing_payments")
    .select("kind, plan_id_snapshot, created_at")
    .eq("subscription_id", row.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingPaymentError) {
    console.error("[BILLING_PENDING_PAYMENT_LOOKUP_ERROR]", {
      workspaceId,
      subscriptionId: row.id,
      error: pendingPaymentError
    });
  }

  const pendingPaymentRow = pendingPayment as
    | {
        kind?: BillingPaymentKind | null;
        plan_id_snapshot?: string | null;
        created_at?: string | null;
      }
    | null;
  const pendingPaymentPlanId = isBillingPlanId(pendingPaymentRow?.plan_id_snapshot)
    ? pendingPaymentRow?.plan_id_snapshot
    : null;
  const pendingPaymentCreatedAt = pendingPaymentRow?.created_at ?? null;
  const pendingPaymentCreatedTs = pendingPaymentCreatedAt ? Date.parse(pendingPaymentCreatedAt) : NaN;
  const pendingPaymentIsStale =
    Number.isFinite(pendingPaymentCreatedTs) &&
    Date.now() - pendingPaymentCreatedTs >= PENDING_PAYMENT_STALE_MINUTES * 60 * 1000;

  const billingPlanId: BillingPlanId = isBillingPlanId(row.plan_id) ? row.plan_id : "website_19";
  const planId = mapBillingPlanToEntitlementPlan(billingPlanId);
  const subscription: WorkspaceSubscription = {
    id: row.id,
    business_id: row.business_id,
    billing_plan_id: billingPlanId,
    plan_id: planId,
    status: row.status,
    trial_end: row.trial_end,
    current_period_end: row.current_period_end,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_access_active: hasActiveBillingAccess({
      status: row.status,
      trial_end: row.trial_end,
      current_period_end: row.current_period_end
    }),
    pending_payment_kind: pendingPaymentRow?.kind ?? null,
    pending_payment_plan_id: pendingPaymentPlanId,
    pending_payment_created_at: pendingPaymentCreatedAt,
    pending_payment_is_stale: pendingPaymentIsStale
  };

  return subscription;
}
