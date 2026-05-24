import Link from "next/link";
import { BillingShell } from "@/app/billing/_components/BillingShell";

export default function BillingCancelPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const workspaceId = typeof searchParams?.workspaceId === "string" ? searchParams.workspaceId : null;
  const billingHref = workspaceId ? `/billing?workspaceId=${encodeURIComponent(workspaceId)}` : "/billing";

  return (
    <BillingShell
      backHref={billingHref}
      backLabel="Back to plans"
      aside={
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/58">
          Checkout not completed
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center py-8">
        <div className="w-full rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,33,0.9),rgba(9,12,18,0.98))] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Payment canceled</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">No payment was captured</h1>
          <p className="mt-4 text-sm leading-7 text-white/68 sm:text-base">
            Your plan has not changed. Return to pricing whenever you are ready to choose a setup for this workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={billingHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:scale-[1.01]"
            >
              Choose a plan
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/84 transition hover:border-white/30 hover:text-white"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </BillingShell>
  );
}
