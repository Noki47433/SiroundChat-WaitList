import Link from "next/link";
import RequestAccessForm from "@/components/forms/RequestAccessForm";

export const dynamic = "force-dynamic";

export default function RequestAccessPage({
  searchParams
}: {
  searchParams?: { blocked?: string; email?: string };
}) {
  const blocked = searchParams?.blocked === "1";
  const initialEmail = typeof searchParams?.email === "string" ? searchParams.email : "";

  return (
    <div className="min-h-screen bg-[#fffaf0] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Request Access</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Early access is limited to selected businesses.</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Submit your business details for review. If approved, you’ll receive an invite code to complete signup.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/" className="font-medium text-slate-600 hover:text-slate-900">
              Back to home
            </Link>
            <Link href="/signup" className="font-semibold text-amber-600 hover:text-amber-700">
              Already have a code? Sign up
            </Link>
          </div>
        </div>

        {blocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your account doesn’t have launch access yet. Request access here and we’ll review your business.
          </div>
        ) : null}

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <RequestAccessForm initialEmail={initialEmail} />
        </div>
      </div>
    </div>
  );
}
