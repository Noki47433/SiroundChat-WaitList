import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  BILLING_CURRENCY,
  PENDING_PAYMENT_STALE_MINUTES,
  SETUP_AMOUNT_CENTS,
  TRIAL_DAYS,
  getBillingPlan,
  isBillingPlanId,
  type BillingPaymentKind,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";
import {
  buildCheckoutRedirectUrl,
  getPayseraProjectId,
  hasPayseraCheckoutConfig,
  shouldUsePayseraDemoMode
} from "@/lib/billing/paysera";
import {
  resolveBillingWorkspaceSelection
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED_MUTATING_STATUSES = new Set<BillingSubscriptionStatus>(["trialing", "active"]);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const resolveAppUrl = (request: Request) => {
  const envUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return trimTrailingSlash(envUrl);

  const url = new URL(request.url);
  return trimTrailingSlash(`${url.protocol}//${url.host}`);
};

const getStaleThresholdIso = () =>
  new Date(Date.now() - PENDING_PAYMENT_STALE_MINUTES * 60 * 1000).toISOString();

const getFreshPendingPayment = <T extends { created_at?: string | null }>(payments: T[]) =>
  payments.find((payment) => {
    const createdAt = payment.created_at ? Date.parse(payment.created_at) : NaN;
    return Number.isFinite(createdAt) && Date.now() - createdAt < PENDING_PAYMENT_STALE_MINUTES * 60 * 1000;
  }) ?? null;

const getLatestPendingPaymentIds = (payments: Array<{ id: string }>) => payments.map((payment) => payment.id);

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { plan_id?: string; workspaceId?: string }
    | null;

  if (!payload?.plan_id || !isBillingPlanId(payload.plan_id)) {
    return NextResponse.json({ error: "Invalid plan_id" }, { status: 400 });
  }

  const workspaceSelection = await resolveBillingWorkspaceSelection(user.id, payload.workspaceId, {
    userEmail: user.email ?? null
  });
  if (!workspaceSelection.businessId) {
    if (workspaceSelection.error === "workspace_ambiguous") {
      return NextResponse.json(
        { error: "workspaceId is required when your account has multiple workspaces." },
        { status: 400 }
      );
    }

    if (workspaceSelection.error === "workspace_forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const businessId = workspaceSelection.businessId;
  const plan = getBillingPlan(payload.plan_id);
  const appUrl = resolveAppUrl(request);
  const callbackUrl = `${appUrl}/api/paysera/callback`;
  const query = new URLSearchParams({ workspaceId: businessId });
  const acceptUrl = `${appUrl}/billing/success?${query.toString()}`;
  const cancelUrl = `${appUrl}/billing/cancel?${query.toString()}`;
  const demoMode = shouldUsePayseraDemoMode();
  const payseraConfigured = hasPayseraCheckoutConfig();
  const nowIso = new Date().toISOString();
  const staleThresholdIso = getStaleThresholdIso();
  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[BILLING_START_TRIAL_CONFIG_MISSING]", { businessId });
    return NextResponse.json({ error: "Billing is unavailable right now." }, { status: 500 });
  }

  if (!demoMode && !payseraConfigured) {
    console.error("[BILLING_START_TRIAL_CONFIG_ERROR]", {
      businessId,
      message: "Missing Paysera configuration"
    });
    return NextResponse.json(
      { error: "Billing is not configured yet. Add Paysera env vars before starting checkout." },
      { status: 500 }
    );
  }

  const { data: existingSubscription, error: existingError } = await admin
    .from("billing_subscriptions")
    .select("id, plan_id, status, trial_end, current_period_end")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingError) {
    console.error("[BILLING_START_LOOKUP_ERROR]", { businessId, error: existingError });
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }

  const subscription = existingSubscription as
    | {
        id: string;
        plan_id: string;
        status: BillingSubscriptionStatus;
        trial_end: string | null;
        current_period_end: string | null;
      }
    | null;

  if (subscription && BLOCKED_MUTATING_STATUSES.has(subscription.status)) {
    return NextResponse.json(
      { error: "Billing is already active for this workspace. New checkout is blocked until the current period ends." },
      { status: 409 }
    );
  }

  let successfulSetupExists = false;
  let pendingPayments: Array<{
    id: string;
    kind: BillingPaymentKind;
    status: string;
    created_at: string;
  }> = [];

  if (subscription?.id) {
    const [setupResult, pendingResult] = await Promise.all([
      admin
        .from("billing_payments")
        .select("id")
        .eq("subscription_id", subscription.id)
        .eq("kind", "setup")
        .eq("status", "succeeded")
        .limit(1),
      admin
        .from("billing_payments")
        .select("id, kind, status, created_at")
        .eq("subscription_id", subscription.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    ]);

    if (setupResult.error) {
      console.error("[BILLING_START_SETUP_HISTORY_ERROR]", {
        businessId,
        subscriptionId: subscription.id,
        error: setupResult.error
      });
      return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
    }

    if (pendingResult.error) {
      console.error("[BILLING_START_PENDING_LOOKUP_ERROR]", {
        businessId,
        subscriptionId: subscription.id,
        error: pendingResult.error
      });
      return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
    }

    successfulSetupExists = (setupResult.data ?? []).length > 0;
    pendingPayments = ((pendingResult.data ?? []) as Array<{
      id: string;
      kind: BillingPaymentKind;
      status: string;
      created_at: string;
    }>).filter((payment) => payment.status === "pending");
  }

  const paymentKind: BillingPaymentKind =
    subscription && successfulSetupExists && (subscription.status === "past_due" || subscription.status === "canceled")
      ? "renewal"
      : "setup";

  const currentPendingOfKind = pendingPayments.filter((payment) => payment.kind === paymentKind);
  const freshPendingOfKind = getFreshPendingPayment(currentPendingOfKind);

  if (freshPendingOfKind) {
    return NextResponse.json(
      { error: "A checkout for this workspace is already pending. Wait for callback confirmation or retry after it expires." },
      { status: 409 }
    );
  }

  const stalePendingIds = getLatestPendingPaymentIds(
    currentPendingOfKind.filter((payment) => payment.created_at < staleThresholdIso)
  );

  if (stalePendingIds.length > 0) {
    const { error: staleUpdateError } = await admin
      .from("billing_payments")
      .update({
        status: "failed",
        failure_reason: "superseded_by_retry",
        processed_at: nowIso,
        superseded_at: nowIso,
        raw_callback: {
          source: "billing_retry_cleanup",
          expired_at: nowIso
        }
      })
      .in("id", stalePendingIds)
      .eq("status", "pending");

    if (staleUpdateError) {
      console.error("[BILLING_START_STALE_SUPERSEDE_ERROR]", {
        businessId,
        subscriptionId: subscription?.id ?? null,
        error: staleUpdateError
      });
      return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
    }
  }

  let subscriptionId = subscription?.id ?? null;

  if (!subscriptionId) {
    const { data: createdSubscription, error: createSubscriptionError } = await admin
      .from("billing_subscriptions")
      .insert({
        business_id: businessId,
        plan_id: plan.id,
        status: "pending_setup"
      })
      .select("id")
      .single();

    if (createSubscriptionError || !createdSubscription?.id) {
      console.error("[BILLING_START_CREATE_SUB_ERROR]", {
        businessId,
        error: createSubscriptionError
      });
      return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
    }

    subscriptionId = createdSubscription.id as string;
  } else if (paymentKind === "setup") {
    const { error: updateSubscriptionError } = await admin
      .from("billing_subscriptions")
      .update({
        plan_id: plan.id,
        status: "pending_setup",
        trial_end: null,
        current_period_end: null
      })
      .eq("id", subscriptionId);

    if (updateSubscriptionError) {
      console.error("[BILLING_START_UPDATE_SETUP_SUB_ERROR]", {
        businessId,
        subscriptionId,
        error: updateSubscriptionError
      });
      return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
    }
  }

  const orderId = `ps_${randomUUID()}`;
  const amountCents = paymentKind === "setup" ? SETUP_AMOUNT_CENTS : plan.priceCents;
  const providerProjectId = demoMode ? null : getPayseraProjectId();

  const { data: paymentRow, error: paymentError } = await admin
    .from("billing_payments")
    .insert({
      subscription_id: subscriptionId,
      kind: paymentKind,
      amount_cents: amountCents,
      currency: BILLING_CURRENCY,
      paysera_orderid: orderId,
      status: "pending",
      plan_id_snapshot: plan.id,
      provider_project_id: providerProjectId,
      provider_test_mode: false
    })
    .select("id")
    .single();

  if (paymentError || !paymentRow?.id) {
    if (paymentError?.code === "23505") {
      return NextResponse.json(
        { error: "A checkout for this workspace is already pending. Wait for it to finish or expire before retrying." },
        { status: 409 }
      );
    }

    console.error("[BILLING_START_CREATE_PAYMENT_ERROR]", {
      businessId,
      subscriptionId,
      orderId,
      error: paymentError
    });

    if (paymentKind === "setup") {
      await admin
        .from("billing_subscriptions")
        .update({ status: "canceled", trial_end: null, current_period_end: null })
        .eq("id", subscriptionId);
    }

    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }

  if (stalePendingIds.length > 0) {
    await admin
      .from("billing_payments")
      .update({ superseded_by_payment_id: paymentRow.id })
      .in("id", stalePendingIds);
  }

  if (demoMode) {
    const currentPeriodBase =
      paymentKind === "renewal" && subscription?.current_period_end && Date.parse(subscription.current_period_end) > Date.now()
        ? new Date(subscription.current_period_end)
        : new Date();
    const nextPeriodEnd =
      paymentKind === "setup"
        ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
        : new Date(currentPeriodBase.getTime());

    if (paymentKind === "renewal") {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    const nextPeriodEndIso = nextPeriodEnd.toISOString();

    const { error: demoPaymentError } = await admin
      .from("billing_payments")
      .update({
        status: "succeeded",
        provider_status: "1",
        processed_at: new Date().toISOString(),
        raw_callback: {
          source: "billing_demo_mode",
          orderid: orderId,
          status: "1",
          amount_cents: amountCents,
          currency: BILLING_CURRENCY,
          plan_id_snapshot: plan.id,
          kind: paymentKind
        }
      })
      .eq("id", paymentRow.id)
      .eq("status", "pending");

    if (demoPaymentError) {
      console.error("[BILLING_START_DEMO_PAYMENT_ERROR]", {
        businessId,
        subscriptionId,
        orderId,
        error: demoPaymentError
      });
      return NextResponse.json({ error: "Failed to activate local demo billing flow" }, { status: 500 });
    }

    const { error: demoSubscriptionError } = await admin
      .from("billing_subscriptions")
      .update(
        paymentKind === "setup"
          ? {
              plan_id: plan.id,
              status: "trialing",
              trial_end: nextPeriodEndIso,
              current_period_end: nextPeriodEndIso
            }
          : {
              plan_id: plan.id,
              status: "active",
              current_period_end: nextPeriodEndIso
            }
      )
      .eq("id", subscriptionId);

    if (demoSubscriptionError) {
      console.error("[BILLING_START_DEMO_SUBSCRIPTION_ERROR]", {
        businessId,
        subscriptionId,
        orderId,
        error: demoSubscriptionError
      });
      return NextResponse.json({ error: "Failed to activate local demo billing flow" }, { status: 500 });
    }

    const { error: demoAccessError } = await admin
      .from("businesses")
      .update({ launch_access: true, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    if (demoAccessError) {
      console.error("[BILLING_START_DEMO_ACCESS_ERROR]", {
        businessId,
        subscriptionId,
        orderId,
        error: demoAccessError
      });
      return NextResponse.json({ error: "Failed to activate local demo billing flow" }, { status: 500 });
    }

    return NextResponse.json({ redirectUrl: `${acceptUrl}&demo=1` });
  }

  const redirectUrl = buildCheckoutRedirectUrl({
    orderId,
    amountCents,
    currency: BILLING_CURRENCY,
    callbackUrl,
    acceptUrl,
    cancelUrl
  });

  return NextResponse.json({ redirectUrl });
}
