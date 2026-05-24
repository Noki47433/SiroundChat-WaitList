import type { ReactNode } from "react";
import Link from "next/link";
import { BillingClient } from "@/app/(dashboard)/dashboard/billing/BillingClient";
import { BillingShell } from "@/app/billing/_components/BillingShell";
import {
  listOwnedBillingBusinesses,
  normalizeWorkspaceId,
  resolveBillingWorkspaceSelection
} from "@/lib/server/billing-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";

type BillingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export const dynamic = "force-dynamic";

const getSearchParam = (value: string | string[] | undefined) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

function StateCard({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center py-8">
      <div className="w-full rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,33,0.9),rgba(9,12,18,0.98))] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-10">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-white/68 sm:text-base">{description}</p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </div>
  );
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <BillingShell backHref="/" backLabel="Back to home">
        <StateCard
          eyebrow="SiroundChat Billing"
          title="Log in to view plans"
          description="Sign in to choose the SiroundChat setup for your restaurant and start secure Paysera checkout."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login?redirect=%2Fbilling"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:scale-[1.01]"
            >
              Log in
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/84 transition hover:border-white/30 hover:text-white"
            >
              Back to home
            </Link>
          </div>
        </StateCard>
      </BillingShell>
    );
  }

  const requestedWorkspaceId = normalizeWorkspaceId(getSearchParam(searchParams?.workspaceId) ?? null);
  const selection = await resolveBillingWorkspaceSelection(user.id, requestedWorkspaceId, {
    userEmail: user.email ?? null
  });

  if (!selection.businessId) {
    if (selection.error === "workspace_ambiguous") {
      const businesses = await listOwnedBillingBusinesses(user.id);

      return (
        <BillingShell>
          <StateCard
            eyebrow="Choose a workspace"
            title="Select the restaurant you want to bill"
            description="Each SiroundChat workspace has its own plan. Pick the restaurant you want to manage before starting checkout."
          >
            <div className="grid gap-3 text-left sm:grid-cols-2">
              {businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/billing?workspaceId=${encodeURIComponent(business.id)}`}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <p className="text-lg font-semibold text-white">{business.business_name ?? "Unnamed workspace"}</p>
                  <p className="mt-2 text-sm text-white/55">{business.id}</p>
                </Link>
              ))}
            </div>
          </StateCard>
        </BillingShell>
      );
    }

    return (
      <BillingShell>
        <StateCard
          eyebrow="Workspace unavailable"
          title="Billing is not ready for this workspace"
          description={
            selection.error === "workspace_forbidden"
              ? "You can only manage plans for workspaces you own or belong to."
              : "We could not resolve a valid workspace for billing right now."
          }
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:scale-[1.01]"
            >
              Return to dashboard
            </Link>
          </div>
        </StateCard>
      </BillingShell>
    );
  }

  const subscription = await getWorkspaceSubscription(selection.businessId);

  return (
    <BillingShell
      aside={
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/58">
          Workspace billing
        </div>
      }
    >
      <BillingClient workspaceId={selection.businessId} initialSubscription={subscription} />
    </BillingShell>
  );
}
