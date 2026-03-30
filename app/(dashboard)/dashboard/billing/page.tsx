import Link from "next/link";
import type { ReactNode } from "react";
import { BillingClient } from "@/app/(dashboard)/dashboard/billing/BillingClient";
import {
  listOwnedBillingBusinesses,
  normalizeWorkspaceId,
  resolveBillingWorkspaceSelection
} from "@/lib/server/billing-access";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";

type BillingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getSearchParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;

const Container = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full max-w-5xl px-6 py-10">
    <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0b0f18] p-8 text-white">{children}</div>
  </div>
);

export default async function DashboardBillingPage({
  searchParams
}: BillingPageProps) {
  await requireUser("/dashboard/billing");

  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Container>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Billing</p>
        <h2 className="text-3xl font-semibold">Upgrade your plan</h2>
        <p className="text-sm text-white/60">Log in to manage billing for a workspace.</p>
      </Container>
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
        <Container>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Billing</p>
          <h2 className="text-3xl font-semibold">Select a workspace</h2>
          <p className="text-sm text-white/60">
            Billing checkout is blocked until you choose the exact workspace to manage.
          </p>
          <div className="space-y-3">
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/dashboard/billing?workspaceId=${encodeURIComponent(business.id)}`}
                className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10"
              >
                <span className="font-semibold text-white">
                  {business.business_name?.trim() || "Unnamed workspace"}
                </span>
                <span className="mt-1 block text-xs text-white/45">{business.id}</span>
              </Link>
            ))}
          </div>
        </Container>
      );
    }

    return (
      <Container>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Billing</p>
        <h2 className="text-3xl font-semibold">Workspace unavailable</h2>
        <p className="text-sm text-white/60">
          {selection.error === "workspace_forbidden"
            ? "You cannot manage billing for that workspace."
            : "No workspace found for this account."}
        </p>
      </Container>
    );
  }

  const subscription = await getWorkspaceSubscription(selection.businessId);

  return (
    <div className="min-h-dvh bg-[#03060c] px-4 py-8 sm:px-6 lg:px-8">
      <BillingClient workspaceId={selection.businessId} initialSubscription={subscription} />
    </div>
  );
}
