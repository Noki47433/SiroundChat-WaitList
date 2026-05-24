import { BillingSuccessStatus } from "@/app/(dashboard)/dashboard/billing/BillingSuccessStatus";
import { BillingShell } from "@/app/billing/_components/BillingShell";

export default function BillingSuccessPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const demoMode = process.env.NODE_ENV !== "production" && searchParams?.demo === "1";
  const workspaceId = typeof searchParams?.workspaceId === "string" ? searchParams.workspaceId : null;
  const billingHref = workspaceId ? `/billing?workspaceId=${encodeURIComponent(workspaceId)}` : "/billing";

  return (
    <BillingShell
      backHref={billingHref}
      backLabel="Back to plans"
      aside={
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/58">
          Secure Paysera return
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center py-8">
        <BillingSuccessStatus workspaceId={workspaceId} demoMode={demoMode} />
      </div>
    </BillingShell>
  );
}
