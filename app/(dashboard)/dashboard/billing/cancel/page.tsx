import Link from "next/link";

export default function DashboardBillingCancelPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const workspaceId = typeof searchParams?.workspaceId === "string" ? searchParams.workspaceId : null;
  const billingHref = workspaceId
    ? `/dashboard/billing?workspaceId=${encodeURIComponent(workspaceId)}`
    : "/dashboard/billing";

  return (
    <div className="min-h-dvh bg-[#03060c] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f141f] p-8 text-white">
        <h1 className="text-3xl font-semibold">Payment canceled</h1>
        <p className="mt-3 text-sm text-white/75">
          No access was granted. Return to billing to retry checkout for this workspace when you are ready.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={billingHref} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
            Back to billing
          </Link>
        </div>
      </div>
    </div>
  );
}
