"use client";

import { useMemo, useState } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Clock3, CreditCard, Loader2, Lock } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  BILLING_PLANS,
  SETUP_AMOUNT_CENTS,
  getPublicBillingPlanId,
  isBillingPlanId,
  type BillingPaymentKind,
  type BillingSubscriptionStatus,
  type PublicBillingPlanId
} from "@/lib/billing/plans";
import type { PlanId } from "@/src/billing/plans";
import { getRecommendedPlanName, getUpgradeCopy } from "@/src/billing/upgrade";

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
  raw_billing_plan_id: string;
  billing_plan_id: PublicBillingPlanId;
  plan_id: PlanId;
  status: BillingSubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  access_source: "subscription" | "manual_override" | "none";
  pending_payment_kind: BillingPaymentKind | null;
  pending_payment_plan_id: string | null;
  pending_payment_created_at: string | null;
  pending_payment_is_stale: boolean;
  manual_override_reason: string | null;
  manual_override_expires_at: string | null;
};

type BillingClientProps = {
  workspaceId: string;
  initialSubscription: SubscriptionRecord;
};

const PLAN_SURFACES: Record<PublicBillingPlanId, string> = {
  website_only:
    "from-[rgba(63,104,176,0.2)] via-[rgba(29,48,82,0.12)] to-transparent",
  chatbot_only:
    "from-[rgba(51,154,164,0.2)] via-[rgba(18,61,68,0.12)] to-transparent",
  website_chatbot:
    "from-[rgba(214,167,94,0.24)] via-[rgba(87,58,18,0.14)] to-transparent",
  social_inbox:
    "from-[rgba(77,164,119,0.2)] via-[rgba(18,56,39,0.12)] to-transparent",
  omni_channel:
    "from-[rgba(222,181,112,0.22)] via-[rgba(92,66,22,0.14)] to-transparent"
};

const PLAN_BORDERS: Record<PublicBillingPlanId, string> = {
  website_only: "border-[#7ea2df33] hover:border-[#8fb4ef55]",
  chatbot_only: "border-[#63d1d833] hover:border-[#71dde455]",
  website_chatbot: "border-[#f2c67a55] hover:border-[#ffd69380]",
  social_inbox: "border-[#79d4aa33] hover:border-[#89e5ba55]",
  omni_channel: "border-[#e4bc7655] hover:border-[#f0cf9480]"
};

const PLAN_VALUE_STATEMENTS: Record<PublicBillingPlanId, string> = {
  website_only: "Launch a polished restaurant website with contact and reservation basics.",
  chatbot_only: "Automate customer questions and lead capture from your existing site.",
  website_chatbot: "Your website and AI assistant working together.",
  social_inbox: "Handle WhatsApp and Instagram conversations from one workspace.",
  omni_channel: "Everything SiroundChat offers across website, AI, inbox, and operations."
};

const PLAN_DISPLAY_FEATURES: Record<PublicBillingPlanId, string[]> = {
  website_only: [
    "Website builder",
    "Publishing",
    "Contact capture",
    "Reservation form",
    "Basic website analytics"
  ],
  chatbot_only: [
    "AI replies",
    "Knowledge base",
    "External embed",
    "Lead capture",
    "Reservation support"
  ],
  website_chatbot: [
    "Everything in Website Only",
    "Everything in AI Chatbot Only",
    "Chatbot on your SiroundChat website",
    "Unified reservations and leads",
    "Deeper analytics"
  ],
  social_inbox: [
    "WhatsApp inbox",
    "Instagram inbox",
    "Unified conversations",
    "Human takeover",
    "Social reply automation"
  ],
  omni_channel: [
    "Website builder",
    "AI chatbot",
    "WhatsApp and Instagram",
    "Unified inbox",
    "Reservations and analytics",
    "Priority workflows"
  ]
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
};

const formatWorkspaceId = (workspaceId: string) =>
  workspaceId.length > 16
    ? `${workspaceId.slice(0, 8)}...${workspaceId.slice(-4)}`
    : workspaceId;

const statusPresentation = (subscription: SubscriptionRecord) => {
  if (subscription.status === "free_internal") {
    return {
      label: "Internal access active",
      detail: subscription.manual_override_reason ?? "This workspace currently has an internal access override.",
      tone: "text-[#f3dfaa]"
    };
  }

  if (subscription.pending_payment_kind === "renewal" && !subscription.pending_payment_is_stale) {
    return {
      label: "Waiting for renewal confirmation",
      detail: "Paysera is still confirming the payment for this workspace.",
      tone: "text-[#f3dfaa]"
    };
  }

  if (
    subscription.status === "pending_setup" &&
    subscription.pending_payment_kind === "setup" &&
    !subscription.pending_payment_is_stale
  ) {
    return {
      label: "Waiting for Paysera confirmation",
      detail: "Your plan will unlock as soon as Paysera confirms the payment securely.",
      tone: "text-[#f3dfaa]"
    };
  }

  if (subscription.status === "trialing") {
    return {
      label: "Plan active",
      detail: `Access is live until ${formatDate(subscription.current_period_end)}.`,
      tone: "text-[#bce8cf]"
    };
  }

  if (subscription.status === "active") {
    return {
      label: "Plan active",
      detail: `Current period ends on ${formatDate(subscription.current_period_end)}.`,
      tone: "text-[#bce8cf]"
    };
  }

  if (subscription.status === "past_due") {
    return {
      label: "Billing needs attention",
      detail: "Paid tools are paused until payment is confirmed again.",
      tone: "text-[#ffd4a3]"
    };
  }

  if (subscription.status === "canceled") {
    return {
      label: "No active billing",
      detail: "Choose a plan to restore paid access for this workspace.",
      tone: "text-white/65"
    };
  }

  return {
    label: subscription.pending_payment_is_stale ? "Checkout expired" : "No active plan",
    detail: "Pick the module set your restaurant needs.",
    tone: "text-white/65"
  };
};

export function BillingClient({ workspaceId, initialSubscription }: BillingClientProps) {
  const { push } = useToast();
  const searchParams = useSearchParams();
  const blockedKey = searchParams?.get("blocked");

  const [pendingPlanId, setPendingPlanId] = useState<PublicBillingPlanId | null>(null);
  const subscription = initialSubscription;
  const blockedCopy = blockedKey ? getUpgradeCopy(blockedKey as Parameters<typeof getUpgradeCopy>[0]) : null;
  const blockedPlanName = blockedKey
    ? getRecommendedPlanName(blockedKey as Parameters<typeof getRecommendedPlanName>[0])
    : null;
  const status = statusPresentation(subscription);

  const hasProcessingPayment =
    subscription.pending_payment_kind !== null && !subscription.pending_payment_is_stale;
  const hasLivePlan = subscription.access_source !== "none";
  const isLockedByActiveBilling =
    subscription.status === "trialing" ||
    subscription.status === "active" ||
    subscription.status === "free_internal";

  const pendingSubscriptionPlanId = useMemo(() => {
    if (!hasProcessingPayment || !subscription.pending_payment_plan_id) return null;
    if (!isBillingPlanId(subscription.pending_payment_plan_id)) return null;
    return getPublicBillingPlanId(subscription.pending_payment_plan_id);
  }, [hasProcessingPayment, subscription.pending_payment_plan_id]);

  const currentPlanId = hasLivePlan ? subscription.billing_plan_id : null;

  const currentPlanName = useMemo(() => {
    const selectedPlanId = currentPlanId ?? pendingSubscriptionPlanId;
    if (!selectedPlanId) return "No active plan";
    return BILLING_PLANS.find((plan) => plan.publicId === selectedPlanId)?.name ?? "No active plan";
  }, [currentPlanId, pendingSubscriptionPlanId]);

  const secondaryMeta = useMemo(() => {
    if (subscription.status === "trialing" || subscription.status === "active") {
      return `Current period · ${formatDate(subscription.current_period_end)}`;
    }

    if (subscription.status === "free_internal" && subscription.manual_override_expires_at) {
      return `Override until · ${formatDate(subscription.manual_override_expires_at)}`;
    }

    if (hasProcessingPayment && subscription.pending_payment_kind === "renewal") {
      return "Renewal checkout · Processing";
    }

    if (hasProcessingPayment) {
      return "Setup checkout · Processing";
    }

    return `Setup payment · ${formatMoney(SETUP_AMOUNT_CENTS / 100)}`;
  }, [
    hasProcessingPayment,
    subscription.current_period_end,
    subscription.manual_override_expires_at,
    subscription.pending_payment_kind,
    subscription.status
  ]);

  const startCheckout = async (planId: PublicBillingPlanId) => {
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
    <section className={`${bodyFont.className} mx-auto w-full max-w-[1700px] pb-8 text-[#e8edf7]`}>
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">SiroundChat billing</p>
        <h1 className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl ${headingFont.className}`}>
          Upgrade your plan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
          Pick the module set your restaurant needs. Access unlocks after verified Paysera confirmation.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/78">
            Current plan · <span className="font-semibold text-white">{currentPlanName}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/78">
            <Clock3 className="h-4 w-4 text-[#f0d08f]" />
            <span className="font-medium text-white">{status.label}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/78">
            <CreditCard className="h-4 w-4 text-[#f0d08f]" />
            {secondaryMeta}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/62">
            Workspace · {formatWorkspaceId(workspaceId)}
          </div>
        </div>

        <p className={`mx-auto mt-4 max-w-2xl text-sm leading-6 ${status.tone}`}>{status.detail}</p>

        {blockedCopy ? (
          <div className="mx-auto mt-6 max-w-3xl rounded-[1.7rem] border border-[#f2cb7e33] bg-[#f2cb7e10] px-5 py-4 text-left text-sm text-[#eed8a2]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#f2cb7e33] bg-black/20">
                  <Lock className="h-4 w-4 text-[#f0d08f]" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#c7af74]">Feature locked</p>
                  <p className="mt-1 font-semibold text-white">{blockedCopy.title}</p>
                  <p className="mt-1 leading-6 text-[#e5d1a0]">{blockedCopy.description}</p>
                </div>
              </div>
              {blockedPlanName ? (
                <div className="rounded-full border border-[#f2cb7e33] bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/76">
                  Best fit · {blockedPlanName}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {BILLING_PLANS.map((plan) => {
          const isCurrentPlan = currentPlanId === plan.publicId;
          const isPendingSelection = pendingSubscriptionPlanId === plan.publicId;
          const isStartingCheckout = pendingPlanId === plan.publicId;
          const isRecommended = plan.publicId === "website_chatbot";
          const canRestoreCurrentPlan =
            isCurrentPlan && (subscription.status === "past_due" || subscription.status === "canceled");

          const buttonDisabled =
            isStartingCheckout ||
            isPendingSelection ||
            (isCurrentPlan && isLockedByActiveBilling) ||
            hasProcessingPayment ||
            (isLockedByActiveBilling && !isCurrentPlan);

          const buttonLabel = isStartingCheckout
            ? "Redirecting to Paysera"
            : isPendingSelection
              ? "Waiting for Paysera"
              : isCurrentPlan && isLockedByActiveBilling
                ? "Current plan"
                : canRestoreCurrentPlan
                  ? "Restore this plan"
                  : subscription.status === "past_due" || subscription.status === "canceled"
                    ? "Switch to this plan"
                    : "Choose this plan";

          return (
            <article
              key={plan.id}
              className={`group relative flex h-full flex-col overflow-hidden rounded-[2.15rem] border bg-[linear-gradient(180deg,rgba(17,20,29,0.95),rgba(9,11,17,0.98))] p-6 transition duration-200 ease-out hover:-translate-y-1 ${PLAN_BORDERS[plan.publicId]} ${isRecommended ? "shadow-[0_24px_90px_rgba(211,166,87,0.12)]" : ""}`}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b ${PLAN_SURFACES[plan.publicId]}`} />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%)]" />

              <div className="relative z-10 flex h-full flex-col">
                <div className="flex min-h-[56px] flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {isRecommended ? (
                      <span className="rounded-full border border-[#f3cb8155] bg-[#f3cb8115] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f1d394]">
                        Recommended
                      </span>
                    ) : null}
                    {plan.badge === "ALL-IN" ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        Complete
                      </span>
                    ) : null}
                    {isCurrentPlan ? (
                      <span className="rounded-full border border-[#7bd4a14a] bg-[#7bd4a118] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#bfeace]">
                        Current plan
                      </span>
                    ) : null}
                    {!isCurrentPlan && isPendingSelection ? (
                      <span className="rounded-full border border-[#f3cb8155] bg-[#f3cb8115] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f1d394]">
                        Pending checkout
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className={`text-[2rem] font-semibold tracking-[-0.04em] text-white ${headingFont.className}`}>
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/64">{PLAN_VALUE_STATEMENTS[plan.publicId]}</p>
                </div>

                <div className="mt-6">
                  <p className="text-[3.1rem] font-semibold tracking-[-0.05em] text-white">
                    {formatMoney(plan.priceCents / 100)}
                  </p>
                  <p className="mt-1 text-sm text-white/50">per month</p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-white/82">
                  {PLAN_DISPLAY_FEATURES[plan.publicId].map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                        <Check className="h-3.5 w-3.5 text-[#f0d08f]" />
                      </span>
                      <span className="leading-6">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex-1" />

                <button
                  type="button"
                  data-tutorial-target={plan.publicId === "website_chatbot" ? "billing-switch-plan" : undefined}
                  disabled={buttonDisabled}
                  onClick={() => startCheckout(plan.publicId)}
                  className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                    buttonDisabled
                      ? "cursor-not-allowed border border-white/10 bg-white/[0.05] text-white/40"
                      : isRecommended
                        ? "bg-[#f3e7c0] text-black hover:bg-white"
                        : "bg-white text-black hover:bg-white/95"
                  }`}
                >
                  {isStartingCheckout ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {buttonLabel}
                    </>
                  ) : (
                    <>
                      {buttonLabel}
                      {!buttonDisabled ? <ArrowRight className="h-4 w-4" /> : null}
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-3xl text-center">
        <p className="text-sm leading-7 text-white/56">
          Checkout starts with a verified {formatMoney(SETUP_AMOUNT_CENTS / 100)} setup payment. Your plan activates
          only after Paysera confirms the payment securely on the server.
        </p>
      </div>
    </section>
  );
}
