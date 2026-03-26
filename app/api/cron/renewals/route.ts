import { NextResponse } from "next/server";
import { PENDING_PAYMENT_STALE_MINUTES } from "@/lib/billing/plans";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readCronSecret = (request: Request) =>
  request.headers.get("x-cron-secret") ??
  request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
  null;

const getStaleThresholdIso = () =>
  new Date(Date.now() - PENDING_PAYMENT_STALE_MINUTES * 60 * 1000).toISOString();

export async function GET(request: Request) {
  const providedSecret = readCronSecret(request);
  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseServerAdminClient() as any;
  const nowIso = new Date().toISOString();
  const staleThresholdIso = getStaleThresholdIso();

  const [expiredSubscriptionsResult, stalePaymentsResult] = await Promise.all([
    admin
      .from("billing_subscriptions")
      .select("id")
      .in("status", ["trialing", "active"])
      .not("current_period_end", "is", null)
      .lte("current_period_end", nowIso),
    admin
      .from("billing_payments")
      .select("id, subscription_id, kind")
      .eq("status", "pending")
      .lt("created_at", staleThresholdIso)
  ]);

  if (expiredSubscriptionsResult.error) {
    console.error("[BILLING_CRON_EXPIRED_LOOKUP_ERROR]", expiredSubscriptionsResult.error);
    return NextResponse.json({ error: "Failed to load expired subscriptions" }, { status: 500 });
  }

  if (stalePaymentsResult.error) {
    console.error("[BILLING_CRON_STALE_LOOKUP_ERROR]", stalePaymentsResult.error);
    return NextResponse.json({ error: "Failed to load stale payments" }, { status: 500 });
  }

  const expiredSubscriptionIds = ((expiredSubscriptionsResult.data ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );
  const stalePayments = (stalePaymentsResult.data ?? []) as Array<{
    id: string;
    subscription_id: string;
    kind: "setup" | "renewal";
  }>;

  if (expiredSubscriptionIds.length > 0) {
    const { error: expireError } = await admin
      .from("billing_subscriptions")
      .update({ status: "past_due" })
      .in("id", expiredSubscriptionIds)
      .in("status", ["trialing", "active"]);

    if (expireError) {
      console.error("[BILLING_CRON_EXPIRE_ERROR]", expireError);
      return NextResponse.json({ error: "Failed to expire subscriptions" }, { status: 500 });
    }
  }

  const stalePaymentIds = stalePayments.map((payment) => payment.id);
  if (stalePaymentIds.length > 0) {
    const { error: staleUpdateError } = await admin
      .from("billing_payments")
      .update({
        status: "failed",
        failure_reason: "stale_checkout_expired",
        processed_at: nowIso,
        raw_callback: {
          source: "billing_cron_cleanup",
          expired_at: nowIso
        }
      })
      .in("id", stalePaymentIds)
      .eq("status", "pending");

    if (staleUpdateError) {
      console.error("[BILLING_CRON_STALE_UPDATE_ERROR]", staleUpdateError);
      return NextResponse.json({ error: "Failed to expire stale payments" }, { status: 500 });
    }
  }

  const { data: pendingSetupSubscriptions, error: pendingSetupLookupError } = await admin
    .from("billing_subscriptions")
    .select("id")
    .eq("status", "pending_setup");

  if (pendingSetupLookupError) {
    console.error("[BILLING_CRON_PENDING_SETUP_LOOKUP_ERROR]", pendingSetupLookupError);
    return NextResponse.json({ error: "Failed to load pending setup subscriptions" }, { status: 500 });
  }

  const pendingSetupSubscriptionIds = ((pendingSetupSubscriptions.data ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );

  let resetPendingSetup = 0;
  if (pendingSetupSubscriptionIds.length > 0) {
    const { data: remainingPendingSetupPayments, error: remainingPendingError } = await admin
      .from("billing_payments")
      .select("subscription_id")
      .in("subscription_id", pendingSetupSubscriptionIds)
      .eq("kind", "setup")
      .eq("status", "pending");

    if (remainingPendingError) {
      console.error("[BILLING_CRON_PENDING_SETUP_RECHECK_ERROR]", remainingPendingError);
      return NextResponse.json({ error: "Failed to recheck pending setup payments" }, { status: 500 });
    }

    const subscriptionIdsWithLiveSetup = new Set(
      ((remainingPendingSetupPayments.data ?? []) as Array<{ subscription_id: string }>).map(
        (row) => row.subscription_id
      )
    );
    const subscriptionsToReset = pendingSetupSubscriptionIds.filter(
      (subscriptionId) => !subscriptionIdsWithLiveSetup.has(subscriptionId)
    );

    if (subscriptionsToReset.length > 0) {
      const { error: resetError } = await admin
        .from("billing_subscriptions")
        .update({
          status: "canceled",
          trial_end: null,
          current_period_end: null
        })
        .in("id", subscriptionsToReset)
        .eq("status", "pending_setup");

      if (resetError) {
        console.error("[BILLING_CRON_RESET_PENDING_SETUP_ERROR]", resetError);
        return NextResponse.json({ error: "Failed to reset pending setup subscriptions" }, { status: 500 });
      }

      resetPendingSetup = subscriptionsToReset.length;
    }
  }

  return NextResponse.json({
    expiredSubscriptions: expiredSubscriptionIds.length,
    stalePaymentsExpired: stalePaymentIds.length,
    pendingSetupReset: resetPendingSetup,
    autoRenewEnabled: false
  });
}
