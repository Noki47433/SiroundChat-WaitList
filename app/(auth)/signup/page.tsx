import Link from "next/link";
import RegisterForm from "@/components/forms/RegisterForm";
import { Card } from "@/components/ui/card";
import { ToastProvider } from "@/components/ui/toast";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export const dynamic = "force-dynamic";

export default function SignupPage({ searchParams }: { searchParams?: { redirect?: string } }) {
  const redirectPath = resolveRedirectPath(searchParams?.redirect, "/");
  const redirectParam = redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">SiroundChat</p>
            <h1 className="text-4xl font-semibold">Launch your AI support hub</h1>
            <p className="text-white/70">
              Create your workspace, customize the bot voice, and start capturing leads today.
            </p>
            <div className="flex items-center gap-3 text-sm text-white/60">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              No credit card required
            </div>
          </div>

          <Card className="flex-1 border-white/10 bg-white/5 p-6">
            <RegisterForm redirect={redirectPath} />

            <div className="mt-6 text-sm text-white/60">
              Already have an account?{" "}
              <Link href={`/login${redirectParam}`} className="text-[#00A3FF] hover:underline">
                Login
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </ToastProvider>
  );
}
