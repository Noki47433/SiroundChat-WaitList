import "server-only";
import {
  hasActiveBillingAccess
} from "@/lib/billing/entitlements";
import {
  PENDING_PAYMENT_STALE_MINUTES,
  getPublicBillingPlanId,
  isBillingPlanId,
  mapBillingPlanToEntitlementPlan,
  type BillingPaymentKind,
  type BillingPlanId,
  type BillingSubscriptionStatus,
  type PublicBillingPlanId
} from "@/lib/billing/plans";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import type { PlanId } from "@/src/billing/plans";

export type WorkspaceSubscription = {
  id: string;
  business_id: string;
  raw_billing_plan_id: BillingPlanId;
  billing_plan_id: PublicBillingPlanId;
  plan_id: PlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  is_access_active: boolean;
  access_source: "subscription" | "manual_override" | "none";
  pending_payment_kind: BillingPaymentKind | null;
  pending_payment_plan_id: BillingPlanId | null;
  pending_payment_created_at: string | null;
  pending_payment_is_stale: boolean;
  manual_override_reason: string | null;
  manual_override_expires_at: string | null;
};

const SUBSCRIPTION_SELECT =
  "id,business_id,plan_id,status,trial_end,current_period_end,created_at,updated_at";

const nowIso = () => new Date().toISOString();

const defaultWorkspaceSubscription = (workspaceId: string): WorkspaceSubscription => {
  const createdAt = nowIso();
  return {
    id: "missing",
    business_id: workspaceId,
    raw_billing_plan_id: "website_only",
    billing_plan_id: "website_only",
    plan_id: "website_only",
    status: "canceled",
    trial_end: null,
    current_period_end: null,
    created_at: createdAt,
    updated_at: createdAt,
    is_access_active: false,
    access_source: "none",
    pending_payment_kind: null,
    pending_payment_plan_id: null,
    pending_payment_created_at: null,
    pending_payment_is_stale: false,
    manual_override_reason: null,
    manual_override_expires_at: null
  };
};

const isManualOverrideActive = (row: {
  billing_override_plan_id?: string | null;
  billing_override_expires_at?: string | null;
}) => {
  if (!isBillingPlanId(row.billing_override_plan_id)) {
    return false;
  }

  if (!row.billing_override_expires_at) {
    return true;
  }

  const expiryTs = Date.parse(row.billing_override_expires_at);
  return Number.isFinite(expiryTs) && expiryTs > Date.now();
};

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const db = getSupabaseServerAdminClientIfAvailable() as any;
  if (!db) {
    console.error("[BILLING_SUBSCRIPTION_CONFIG_MISSING]", { workspaceId });
    return defaultWorkspaceSubscription(workspaceId);
  }

  const [{ data: existing, error }, { data: businessOverride, error: businessError }] = await Promise.all([
    db
      .from("billing_subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("business_id", workspaceId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("businesses")
      .select("billing_override_plan_id,billing_override_reason,billing_override_expires_at")
      .eq("id", workspaceId)
      .maybeSingle()
  ]);

  if (error) {
    console.error("[BILLING_SUBSCRIPTION_LOOKUP_ERROR]", { workspaceId, error });
    return defaultWorkspaceSubscription(workspaceId);
  }

  if (businessError) {
    console.error("[BILLING_OVERRIDE_LOOKUP_ERROR]", { workspaceId, error: businessError });
  }

  if (!existing) {
    const fallback = defaultWorkspaceSubscription(workspaceId);
    if (!isManualOverrideActive(businessOverride ?? {})) {
      return fallback;
    }

    const manualPlanId = businessOverride.billing_override_plan_id as BillingPlanId;
    return {
      ...fallback,
      raw_billing_plan_id: manualPlanId,
      billing_plan_id: getPublicBillingPlanId(manualPlanId),
      plan_id: mapBillingPlanToEntitlementPlan(manualPlanId),
      status: "free_internal",
      is_access_active: true,
      access_source: "manual_override",
      manual_override_reason:
        typeof businessOverride?.billing_override_reason === "string"
          ? businessOverride.billing_override_reason
          : null,
      manual_override_expires_at:
        typeof businessOverride?.billing_override_expires_at === "string"
          ? businessOverride.billing_override_expires_at
          : null
    };
  }

  const row = existing as {
    id: string;
    business_id: string;
    plan_id: string;
    status: Exclude<BillingSubscriptionStatus, "free_internal">;
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

  const rawBillingPlanId: BillingPlanId = isBillingPlanId(row.plan_id) ? row.plan_id : "website_only";
  const billingPlanId = getPublicBillingPlanId(rawBillingPlanId);
  const planId = mapBillingPlanToEntitlementPlan(rawBillingPlanId);
  const baseSubscription: WorkspaceSubscription = {
    id: row.id,
    business_id: row.business_id,
    raw_billing_plan_id: rawBillingPlanId,
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
    access_source: "subscription",
    pending_payment_kind: pendingPaymentRow?.kind ?? null,
    pending_payment_plan_id: pendingPaymentPlanId,
    pending_payment_created_at: pendingPaymentCreatedAt,
    pending_payment_is_stale: pendingPaymentIsStale,
    manual_override_reason: null,
    manual_override_expires_at: null
  };

  if (baseSubscription.is_access_active || !isManualOverrideActive(businessOverride ?? {})) {
    return baseSubscription;
  }

  const manualPlanId = businessOverride.billing_override_plan_id as BillingPlanId;
  return {
    ...baseSubscription,
    raw_billing_plan_id: manualPlanId,
    billing_plan_id: getPublicBillingPlanId(manualPlanId),
    plan_id: mapBillingPlanToEntitlementPlan(manualPlanId),
    status: "free_internal",
    is_access_active: true,
    access_source: "manual_override",
    manual_override_reason:
      typeof businessOverride?.billing_override_reason === "string"
        ? businessOverride.billing_override_reason
        : null,
    manual_override_expires_at:
      typeof businessOverride?.billing_override_expires_at === "string"
        ? businessOverride.billing_override_expires_at
        : null
  };
}
