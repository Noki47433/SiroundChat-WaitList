// Summary: Login page that bypasses auth if disabled and renders the login form with marketing copy.
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/LoginForm";
import { ToastProvider } from "@/components/ui/toast";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export default function LoginPage({ searchParams }: { searchParams?: { redirect?: string } }) {
  if (isAuthDisabled()) {
    redirect("/dashboard");
  }
  const redirectPath = resolveRedirectPath(searchParams?.redirect, "/");
  const redirectParam = redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 md:flex-row">
          <div className="flex-1 text-white">
            <p className="text-sm uppercase text-white/50">SiroundChat</p>
            <h1 className="mt-4 text-4xl font-semibold">Let&apos;s get you back to your dashboard</h1>
            <p className="mt-4 text-white/70">
              Login to continue building your AI website and chat widget. We built SiroundChat for Kosovo & Albania
              businesses, so everything stays simple and trustworthy.
            </p>
          </div>
          <div className="flex-1 rounded-3xl border border-white/5 bg-white/5 p-8 text-white shadow-2xl">
            <LoginForm redirect={redirectPath} />
            <p className="mt-6 text-sm text-white/60">
              No account yet?{" "}
              <Link href={`/auth/register${redirectParam}`} className="text-[#00A3FF]">
                Create one in 2 minutes
              </Link>
            </p>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
