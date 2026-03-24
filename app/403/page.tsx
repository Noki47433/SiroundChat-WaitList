import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">403</p>
        <h1 className="mt-3 text-3xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-sm text-white/65">
          This page is restricted to SiroundChat admins. Sign in with an admin account or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login?redirect=%2Fadmin"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[#0b1119]"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </main>
  );
}
