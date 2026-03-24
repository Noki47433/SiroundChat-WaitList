import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  BILLING_CURRENCY,
  isBillingPlanId
} from "@/lib/billing/plans";
import { createRecurringPayseraPayment } from "@/lib/billing/paysera";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const resolveAppUrl = (request: Request) => {
  const envUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return trimTrailingSlash(envUrl);

  const url = new URL(request.url);
  return trimTrailingSlash(`${url.protocol}//${url.host}`);
};

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = resolveAppUrl(request);
  const callbackUrl = `${appUrl}/api/paysera/callback`;
  const acceptUrl = `${appUrl}/billing/success`;
  const cancelUrl = `${appUrl}/billing/cancel`;

  const admin = getSupabaseServerAdminClient() as any;
  const nowIso = new Date().toISOString();
  const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [plansResult, dueResult] = await Promise.all([
    admin.from("billing_plans").select("id, price_cents, currency"),
    admin
      .from("billing_subscriptions")
      .select("id, business_id, plan_id, status, current_period_end, paysera_issued_token")
      .in("status", ["trialing", "active"])
      .not("paysera_issued_token", "is", null)
      .lte("current_period_end", nowIso)
  ]);

  if (plansResult.error) {
    console.error("[BILLING_RENEWALS_PLANS_ERROR]", plansResult.error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }

  if (dueResult.error) {
    console.error("[BILLING_RENEWALS_DUE_QUERY_ERROR]", dueResult.error);
    return NextResponse.json({ error: "Failed to load due subscriptions" }, { status: 500 });
  }

  const planMap = new Map<string, { price_cents: number; currency: string }>();
  for (const row of plansResult.data ?? []) {
    planMap.set(row.id, {
      price_cents: row.price_cents,
      currency: row.currency
    });
  }

  let processed = 0;
  let skipped = 0;
  const errors: Array<{ subscription_id: string; reason: string }> = [];

  for (const subscription of dueResult.data ?? []) {
    const subscriptionId = subscription.id as string;

    const { data: existingPending, error: pendingLookupError } = await admin
      .from("billing_payments")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .eq("kind", "renewal")
      .eq("status", "pending")
      .gte("created_at", last24hIso)
      .limit(1);

    if (pendingLookupError) {
      console.error("[BILLING_RENEWALS_PENDING_LOOKUP_ERROR]", {
        subscription_id: subscriptionId,
        error: pendingLookupError
      });
      errors.push({ subscription_id: subscriptionId, reason: "pending_lookup_failed" });
      continue;
    }

    if (existingPending && existingPending.length > 0) {
      skipped += 1;
      continue;
    }

    if (!isBillingPlanId(subscription.plan_id)) {
      console.error("[BILLING_RENEWALS_INVALID_PLAN_ID]", {
        subscription_id: subscriptionId,
        plan_id: subscription.plan_id
      });
      errors.push({ subscription_id: subscriptionId, reason: "invalid_plan" });
      continue;
    }

    const plan = planMap.get(subscription.plan_id);
    if (!plan) {
      console.error("[BILLING_RENEWALS_PLAN_NOT_FOUND]", {
        subscription_id: subscriptionId,
        plan_id: subscription.plan_id
      });
      errors.push({ subscription_id: subscriptionId, reason: "plan_not_found" });
      continue;
    }

    const issuedToken = subscription.paysera_issued_token as string | null;
    if (!issuedToken) {
      skipped += 1;
      continue;
    }

    const payseraOrderId = `ps_renew_${randomUUID()}`;

    const { data: paymentRow, error: createPaymentError } = await admin
      .from("billing_payments")
      .insert({
        subscription_id: subscriptionId,
        kind: "renewal",
        amount_cents: plan.price_cents,
        currency: plan.currency || BILLING_CURRENCY,
        paysera_orderid: payseraOrderId,
        status: "pending"
      })
      .select("id")
      .single();

    if (createPaymentError || !paymentRow?.id) {
      if (createPaymentError?.code === "23505") {
        skipped += 1;
        continue;
      }
      console.error("[BILLING_RENEWALS_CREATE_PAYMENT_ERROR]", {
        subscription_id: subscriptionId,
        orderid: payseraOrderId,
        error: createPaymentError
      });
      errors.push({ subscription_id: subscriptionId, reason: "create_payment_failed" });
      continue;
    }

    try {
      await createRecurringPayseraPayment({
        orderId: payseraOrderId,
        amountCents: plan.price_cents,
        currency: plan.currency || BILLING_CURRENCY,
        callbackUrl,
        acceptUrl,
        cancelUrl,
        issuedToken,
        planId: subscription.plan_id
      });

      processed += 1;
    } catch (error) {
      console.error("[BILLING_RENEWALS_PAYSERA_REQUEST_ERROR]", {
        subscription_id: subscriptionId,
        orderid: payseraOrderId,
        error
      });

      await admin.from("billing_payments").update({ status: "failed" }).eq("id", paymentRow.id);
      await admin.from("billing_subscriptions").update({ status: "past_due" }).eq("id", subscriptionId);

      errors.push({ subscription_id: subscriptionId, reason: "paysera_request_failed" });
    }
  }

  return NextResponse.json({
    processed,
    skipped,
    errors
  });
}
