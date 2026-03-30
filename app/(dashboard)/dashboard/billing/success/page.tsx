import Link from "next/link";

export default function DashboardBillingSuccessPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const demoMode = process.env.NODE_ENV !== "production" && searchParams?.demo === "1";
  const workspaceId = typeof searchParams?.workspaceId === "string" ? searchParams.workspaceId : null;
  const billingHref = workspaceId
    ? `/dashboard/billing?workspaceId=${encodeURIComponent(workspaceId)}`
    : "/dashboard/billing";

  return (
    <div className="min-h-dvh bg-[#03060c] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f141f] p-8 text-white">
        <h1 className="text-3xl font-semibold">{demoMode ? "Demo trial activated" : "Payment received"}</h1>
        <p className="mt-3 text-sm text-white/75">
          {demoMode
            ? "Local billing demo mode is active, so your workspace trial was enabled immediately."
            : "Your payment is still pending server-side verification. Access changes only after the verified Paysera callback updates billing."}
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={billingHref} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
            Go to billing
          </Link>
          <Link href="/dashboard" className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/80">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
