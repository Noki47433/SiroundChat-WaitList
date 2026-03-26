"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  PENDING_PAYMENT_STALE_MINUTES,
  BILLING_PLANS,
  type BillingPaymentKind,
  type BillingPlanId,
  type BillingSubscriptionStatus
} from "@/lib/billing/plans";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

type SubscriptionRecord = {
  id: string;
  business_id: string;
  billing_plan_id: BillingPlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  pending_payment_kind: BillingPaymentKind | null;
  pending_payment_plan_id: BillingPlanId | null;
  pending_payment_created_at: string | null;
  pending_payment_is_stale: boolean;
};

type BillingClientProps = {
  workspaceId: string;
  initialSubscription: SubscriptionRecord;
};

type CompareRow = {
  label: string;
  website_19: string;
  bundle_29: string;
  chatbot_19: string;
  importance: string;
};

const PLAN_FEATURES: Record<BillingPlanId, string[]> = {
  website_19: [
    "Unlimited landing pages with drag-and-drop editing",
    "Custom domain + SSL with one-click publish",
    "Lead forms synced directly to your workspace",
    "SEO + social metadata controls",
    "Traffic-to-lead analytics dashboard"
  ],
  chatbot_19: [
    "24/7 AI chatbot trained on your business content",
    "Embed-ready widget with brand styling controls",
    "Lead qualification prompts in chat",
    "Conversation analytics and intent tracking",
    "Human handoff context for faster follow-up"
  ],
  bundle_29: [
    "Website + chatbot in one growth workspace",
    "Unified lead funnel (forms + chat)",
    "Conversion-focused templates and CTA blocks",
    "Unified analytics: visits, chats, leads, bookings",
    "Priority support lane for growth-blocking issues",
    "Best value: save €9/month vs separate plans"
  ]
};

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Primary outcome",
    website_19: "Launch and convert with a professional website",
    bundle_29: "Grow with website + chatbot full-funnel coverage",
    chatbot_19: "Convert conversations into qualified leads",
    importance: "Defines where most ROI is created first."
  },
  {
    label: "Lead capture channels",
    website_19: "Website forms",
    bundle_29: "Website forms + chatbot",
    chatbot_19: "Chatbot only",
    importance: "More channels usually means less lead leakage."
  },
  {
    label: "Analytics depth",
    website_19: "Traffic + form conversion",
    bundle_29: "Unified traffic + chat + lead + booking",
    chatbot_19: "Chat volume + lead qualification",
    importance: "Clear visibility helps improve conversion faster."
  },
  {
    label: "Best fit",
    website_19: "Businesses fixing weak web conversion",
    bundle_29: "Teams focused on predictable monthly growth",
    chatbot_19: "Teams with strong traffic but slow response time",
    importance: "Plan-to-goal fit drives adoption and retention."
  },
  {
    label: "Support level",
    website_19: "Standard",
    bundle_29: "Priority support lane",
    chatbot_19: "Standard",
    importance: "Faster support minimizes downtime during campaigns."
  }
];

const PLAN_RENDER_ORDER: BillingPlanId[] = ["website_19", "bundle_29", "chatbot_19"];

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
};

const statusLabel = (subscription: SubscriptionRecord) => {
  if (subscription.pending_payment_kind === "renewal" && !subscription.pending_payment_is_stale) {
    return "Pending renewal payment";
  }
  if (
    subscription.status === "pending_setup" &&
    subscription.pending_payment_kind === "setup" &&
    !subscription.pending_payment_is_stale
  ) {
    return "Pending setup payment";
  }
  if (subscription.pending_payment_kind && subscription.pending_payment_is_stale) {
    return "Checkout expired";
  }
  if (subscription.status === "pending_setup") return "Pending setup";
  if (subscription.status === "trialing") return "Trialing";
  if (subscription.status === "active") return "Active";
  if (subscription.status === "past_due") return "Past due";
  return "Canceled";
};

export function BillingClient({ workspaceId, initialSubscription }: BillingClientProps) {
  const { push } = useToast();
  const searchParams = useSearchParams();
  const blockedKey = searchParams?.get("blocked");

  const [subscription] = useState(initialSubscription);
  const [pendingPlanId, setPendingPlanId] = useState<BillingPlanId | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const hasActiveAccessState = useMemo(
    () => subscription.status === "trialing" || subscription.status === "active",
    [subscription.status]
  );
  const hasLivePendingSetup = useMemo(
    () =>
      subscription.status === "pending_setup" &&
      subscription.pending_payment_kind === "setup" &&
      !subscription.pending_payment_is_stale,
    [subscription.pending_payment_is_stale, subscription.pending_payment_kind, subscription.status]
  );
  const hasLivePendingRenewal = useMemo(
    () => subscription.pending_payment_kind === "renewal" && !subscription.pending_payment_is_stale,
    [subscription.pending_payment_is_stale, subscription.pending_payment_kind]
  );
  const checkoutBlocked = hasActiveAccessState || hasLivePendingSetup || hasLivePendingRenewal;

  const orderedPlans = useMemo(() => {
    const planMap = new Map(BILLING_PLANS.map((plan) => [plan.id, plan]));
    return PLAN_RENDER_ORDER.map((id) => planMap.get(id)).filter(Boolean) as typeof BILLING_PLANS;
  }, []);

  const startCheckout = async (planId: BillingPlanId) => {
    setPendingPlanId(planId);

    try {
      const response = await fetch("/api/billing/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, workspaceId })
      });

      const data = (await response.json().catch(() => null)) as
        | { redirectUrl?: string; error?: string }
        | null;

      if (!response.ok || !data?.redirectUrl) {
        throw new Error(data?.error ?? "Failed to start checkout");
      }

      window.location.href = data.redirectUrl;
    } catch (error) {
      push({
        title: "Could not start checkout",
        message: error instanceof Error ? error.message : "Unexpected error",
        variant: "error"
      });
      setPendingPlanId(null);
    }
  };

  return (
    <div className={`${bodyFont.className} relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[2rem] border border-[#3a5f8a66] bg-[#080e18] p-6 text-[#e8edf7] md:p-8`}>
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#27599644] blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#2f6e8e3d] blur-[110px]" />
      <div className={`pointer-events-none absolute left-1/2 top-2 hidden -translate-x-1/2 select-none text-[118px] leading-none text-[#d8e6ff0d] md:block ${headingFont.className}`}>
        Pricing
      </div>

      <div className="relative z-10 space-y-6">
        <div className="space-y-2">
          <h1 className={`text-4xl tracking-tight text-white ${headingFont.className}`}>Billing</h1>
          <p className="text-base text-white/75">
            First-time setup charges <span className="font-semibold text-white">€1.00</span> and starts the 14-day trial only after callback confirmation. Expired workspaces renew at the selected monthly price after verified payment.
          </p>
          <p className="text-xs text-white/45">Workspace: {workspaceId}</p>
        </div>

        {blockedKey ? (
          <div className="rounded-2xl border border-[#ffd87255] bg-[#ffd34a1c] px-4 py-3 text-sm text-[#ffe9ad]">
            Access to <span className="font-semibold">{blockedKey}</span> is currently locked.
          </div>
        ) : null}

        <div className="rounded-[1.6rem] border border-white/15 bg-white/[0.04] p-5 text-sm text-white/82 backdrop-blur-xl">
          <p>
            <span className="text-white/60">Status:</span>{" "}
            <span className="font-semibold text-white">{statusLabel(subscription)}</span>
          </p>
          <p>
            <span className="text-white/60">Trial end:</span> {formatDate(subscription.trial_end)}
          </p>
          <p>
            <span className="text-white/60">Current period end:</span> {formatDate(subscription.current_period_end)}
          </p>
          {subscription.pending_payment_kind ? (
            <p>
              <span className="text-white/60">Pending checkout:</span>{" "}
              {subscription.pending_payment_kind === "setup" ? "Setup payment" : "Renewal payment"}
              {subscription.pending_payment_plan_id ? ` for ${subscription.pending_payment_plan_id}` : ""}
              {subscription.pending_payment_created_at ? ` started ${formatDate(subscription.pending_payment_created_at)}` : ""}
              {subscription.pending_payment_is_stale ? " (expired, safe to retry)" : ""}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {orderedPlans.map((plan) => {
            const isCurrentPlan = subscription.billing_plan_id === plan.id;
            const isPending = pendingPlanId === plan.id;
            const isBundle = plan.id === "bundle_29";
            const buttonDisabled = checkoutBlocked || isPending || Boolean(pendingPlanId);

            return (
              <div
                key={plan.id}
                className={[
                  "relative",
                  isBundle ? "z-20 lg:-my-3 lg:scale-[1.06]" : "z-10"
                ].join(" ")}
              >
                {isBundle ? (
                  <>
                    <div className="pointer-events-none absolute -inset-[1px] overflow-hidden rounded-[1.9rem]">
                      <div className="absolute -inset-[130%] bg-[conic-gradient(from_180deg,#57b7d8,#7b78d6,#5f87b7,#57b7d8)] animate-[spin_10s_linear_infinite]" />
                    </div>
                    <div className="pointer-events-none absolute -inset-1 rounded-[2rem] bg-[#4f9cd233] blur-xl" />
                  </>
                ) : null}

                <div
                  className={[
                    "relative overflow-hidden rounded-[1.7rem] p-6 backdrop-blur-xl",
                    isBundle
                      ? "m-[1.5px] border border-[#8fc9e85f] bg-gradient-to-b from-[#17304ccc] to-[#111f33f0] shadow-[0_0_40px_#4fa0c041]"
                      : isCurrentPlan
                        ? "border border-[#7aaad18f] bg-gradient-to-b from-[#132438cc] to-[#0d1624f0] shadow-[0_0_35px_#2f5f8a44]"
                        : "border border-white/15 bg-gradient-to-b from-[#121826c9] to-[#0d1320e6]"
                  ].join(" ")}
                >
                  <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#4f8fb52e] blur-3xl" />
                  <div className="relative z-10">
                    {isBundle ? (
                      <span className="inline-flex rounded-full border border-[#8fc9e87d] bg-[#8fc9e820] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#dff3ff]">
                        Most Popular
                      </span>
                    ) : null}

                    <p className={[
                      "text-sm text-white/75",
                      isBundle ? "mt-3" : ""
                    ].join(" ")}>{plan.name}</p>

                    <p className={[
                      `${headingFont.className} font-semibold leading-none text-white`,
                      isBundle ? "text-[40px]" : "text-[34px]"
                    ].join(" ")}>
                      €{(plan.priceCents / 100).toFixed(2)}
                      <span className={[
                        "text-white/90",
                        isBundle ? "text-[24px]" : "text-[21px]"
                      ].join(" ")}>/month</span>
                    </p>

                    <ul className="mt-5 space-y-2.5">
                      {PLAN_FEATURES[plan.id].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-white/84">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => startCheckout(plan.id)}
                      disabled={buttonDisabled}
                      data-tutorial-target="billing-switch-plan"
                      className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/60"
                    >
                      {isPending ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecting...
                        </span>
                      ) : isCurrentPlan && hasActiveAccessState ? (
                        "Current plan active"
                      ) : hasLivePendingSetup || hasLivePendingRenewal ? (
                        "Checkout pending"
                      ) : (
                        "Choose Plan"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowCompare((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.1]"
          >
            Compare Plans
            {showCompare ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showCompare ? (
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03]">
              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full text-left text-sm">
                  <thead className="bg-white/[0.06] text-white">
                    <tr>
                      <th className="px-4 py-3 text-xs uppercase tracking-[0.13em] text-white/70">Compare Plans</th>
                      <th className="px-4 py-3 text-sm font-semibold text-white">Website</th>
                      <th className={`px-4 py-3 text-sm font-semibold text-white ${headingFont.className}`}>Bundle</th>
                      <th className="px-4 py-3 text-sm font-semibold text-white">Chatbot</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-[0.13em] text-white/70">Why It Matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.label} className="border-t border-white/10 align-top">
                        <td className="px-4 py-3 font-semibold text-white">{row.label}</td>
                        <td className="px-4 py-3 text-white/85">{row.website_19}</td>
                        <td className="px-4 py-3 text-white/90">{row.bundle_29}</td>
                        <td className="px-4 py-3 text-white/85">{row.chatbot_19}</td>
                        <td className="px-4 py-3 text-white/65">{row.importance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {checkoutBlocked ? (
          <p className="text-sm text-white/72">
            {hasActiveAccessState
              ? "Manual renewal opens only after the current billing period ends."
              : `Pending checkout remains non-active until callback verification. If it expires, retry after ${PENDING_PAYMENT_STALE_MINUTES} minutes.`}
          </p>
        ) : null}

        <p className="text-xs text-white/50">
          Only callback-confirmed payments activate or renew subscriptions. The success page alone does not activate access.
        </p>

        <div className="text-xs">
          <Link href="/dashboard" className="text-white/60 transition hover:text-white">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
