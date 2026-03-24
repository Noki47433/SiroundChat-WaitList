import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  BILLING_CURRENCY,
  SETUP_AMOUNT_CENTS,
  TRIAL_DAYS,
  getBillingPlan,
  isBillingPlanId,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";
import {
  buildSetupCheckoutRedirectUrl,
  hasPayseraCheckoutConfig,
  shouldUsePayseraDemoMode
} from "@/lib/billing/paysera";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKING_STATUSES = new Set<BillingSubscriptionStatus>([
  "pending_setup",
  "trialing",
  "active",
  "past_due"
]);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const resolveAppUrl = (request: Request) => {
  const envUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return trimTrailingSlash(envUrl);

  const url = new URL(request.url);
  return trimTrailingSlash(`${url.protocol}//${url.host}`);
};

export async function POST(request: Request) {
  const auth = await requireBusinessUser();
  if (auth.response) return auth.response;

  const { businessId } = auth.context;

  const payload = (await request.json().catch(() => null)) as { plan_id?: string } | null;
  if (!payload?.plan_id || !isBillingPlanId(payload.plan_id)) {
    return NextResponse.json({ error: "Invalid plan_id" }, { status: 400 });
  }

  const plan = getBillingPlan(payload.plan_id);
  const appUrl = resolveAppUrl(request);
  const callbackUrl = `${appUrl}/api/paysera/callback`;
  const acceptUrl = `${appUrl}/billing/success`;
  const cancelUrl = `${appUrl}/billing/cancel`;
  const demoMode = shouldUsePayseraDemoMode();
  const payseraConfigured = hasPayseraCheckoutConfig();

  const admin = getSupabaseServerAdminClient() as any;

  if (!demoMode && !payseraConfigured) {
    console.error("[BILLING_START_TRIAL_CONFIG_ERROR]", {
      businessId,
      message: "Missing Paysera configuration"
    });
    return NextResponse.json(
      { error: "Billing is not configured yet. Add Paysera env vars before starting trials." },
      { status: 500 }
    );
  }

  const { data: existingSubscription, error: existingError } = await admin
    .from("billing_subscriptions")
    .select("id, status")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingError) {
    console.error("[BILLING_START_TRIAL_LOOKUP_ERROR]", { businessId, error: existingError });
    return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
  }

  const existingStatus = existingSubscription?.status as BillingSubscriptionStatus | undefined;
  const canReusePendingSetup = demoMode && existingStatus === "pending_setup";

  if (existingSubscription && BLOCKING_STATUSES.has(existingStatus as BillingSubscriptionStatus) && !canReusePendingSetup) {
    return NextResponse.json(
      { error: "Subscription already exists. Use billing management for this workspace." },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  let subscriptionId = existingSubscription?.id as string | undefined;

  if (canReusePendingSetup && subscriptionId) {
    await admin
      .from("billing_payments")
      .update({
        status: "failed",
        raw_callback: {
          source: "billing_demo_restart",
          reason: "Restarted local trial after missing Paysera configuration"
        }
      })
      .eq("subscription_id", subscriptionId)
      .eq("status", "pending");
  }

  if (subscriptionId) {
    const { error: updateSubscriptionError } = await admin
      .from("billing_subscriptions")
      .update({
        plan_id: plan.id,
        status: "pending_setup",
        trial_end: null,
        current_period_end: null,
        paysera_issued_token: null,
        updated_at: nowIso
      })
      .eq("id", subscriptionId);

    if (updateSubscriptionError) {
      console.error("[BILLING_START_TRIAL_UPDATE_SUB_ERROR]", {
        businessId,
        subscriptionId,
        error: updateSubscriptionError
      });
      return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
    }
  } else {
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
      console.error("[BILLING_START_TRIAL_CREATE_SUB_ERROR]", {
        businessId,
        error: createSubscriptionError
      });
      return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
    }

    subscriptionId = createdSubscription.id as string;
  }

  const orderId = `ps_${randomUUID()}`;

  const { error: paymentError } = await admin.from("billing_payments").insert({
    subscription_id: subscriptionId,
    kind: "setup",
    amount_cents: SETUP_AMOUNT_CENTS,
    currency: BILLING_CURRENCY,
    paysera_orderid: orderId,
    status: "pending"
  });

  if (paymentError) {
    console.error("[BILLING_START_TRIAL_CREATE_PAYMENT_ERROR]", {
      businessId,
      subscriptionId,
      orderId,
      error: paymentError
    });

    await admin
      .from("billing_subscriptions")
      .update({ status: "canceled", updated_at: nowIso })
      .eq("id", subscriptionId);

    return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
  }

  if (demoMode) {
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const issuedToken = `demo_${randomUUID()}`;

    const { error: demoPaymentError } = await admin
      .from("billing_payments")
      .update({
        status: "succeeded",
        raw_callback: {
          source: "billing_demo_mode",
          orderid: orderId,
          status: "1",
          amount: String(SETUP_AMOUNT_CENTS),
          currency: BILLING_CURRENCY,
          issued_token: issuedToken
        }
      })
      .eq("paysera_orderid", orderId)
      .eq("status", "pending");

    if (demoPaymentError) {
      console.error("[BILLING_START_TRIAL_DEMO_PAYMENT_ERROR]", {
        businessId,
        subscriptionId,
        orderId,
        error: demoPaymentError
      });
      return NextResponse.json({ error: "Failed to activate local demo trial" }, { status: 500 });
    }

    const { error: demoSubscriptionError } = await admin
      .from("billing_subscriptions")
      .update({
        plan_id: plan.id,
        status: "trialing",
        trial_end: trialEnd,
        current_period_end: trialEnd,
        paysera_issued_token: issuedToken,
        updated_at: new Date().toISOString()
      })
      .eq("id", subscriptionId);

    if (demoSubscriptionError) {
      console.error("[BILLING_START_TRIAL_DEMO_SUBSCRIPTION_ERROR]", {
        businessId,
        subscriptionId,
        orderId,
        error: demoSubscriptionError
      });
      return NextResponse.json({ error: "Failed to activate local demo trial" }, { status: 500 });
    }

    return NextResponse.json({ redirectUrl: `${acceptUrl}?demo=1&plan=${plan.id}` });
  }

  const redirectUrl = buildSetupCheckoutRedirectUrl({
    orderId,
    callbackUrl,
    acceptUrl,
    cancelUrl,
    planId: plan.id
  });

  return NextResponse.json({ redirectUrl });
}
