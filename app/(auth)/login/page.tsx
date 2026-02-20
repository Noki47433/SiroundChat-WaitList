import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";
import { Card } from "@/components/ui/card";
import { ToastProvider } from "@/components/ui/toast";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export default function LoginPage({ searchParams }: { searchParams?: { redirect?: string } }) {
  const redirectPath = resolveRedirectPath(searchParams?.redirect, "/");
  const redirectParam = redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">SiroundChat</p>
            <h1 className="text-4xl font-semibold">Welcome back to your dashboard</h1>
            <p className="text-white/70">
              Sign in to keep your bot on-brand, review conversations, and ship updates in minutes.
            </p>
            <div className="flex items-center gap-3 text-sm text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Secure login - Demo-friendly
            </div>
          </div>
          <Card className="flex-1 border-white/10 bg-white/5">
            <LoginForm redirect={redirectPath} />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
              <Link href="/forgot-password" className="text-white/80 hover:text-white">
                Forgot password?
              </Link>
              <Link href={`/signup${redirectParam}`} className="text-[#00A3FF]">
                Create an account
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </ToastProvider>
  );
}
