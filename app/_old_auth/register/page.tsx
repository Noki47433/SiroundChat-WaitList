// Summary: Registration page that redirects to dashboard if auth is disabled and renders the signup form with copy.
import Link from "next/link";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/forms/RegisterForm";
import { ToastProvider } from "@/components/ui/toast";
import { isAuthDisabled } from "@/lib/config/auth";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export default function RegisterPage({ searchParams }: { searchParams?: { redirect?: string } }) {
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
            <p className="text-sm uppercase text-white/50">SiroundChat for Kosovo & Albania</p>
            <h1 className="mt-4 text-4xl font-semibold">Launch your website + AI chat in one go</h1>
            <p className="mt-4 text-white/70">
              We built SiroundChat so local business owners can go live without touching code. Tell us your industry and we
              spin up a site, chat widget, and lead inbox instantly.
            </p>
          </div>
          <div className="flex-1 rounded-3xl border border-white/5 bg-white/5 p-8 text-white shadow-2xl">
            <RegisterForm redirect={redirectPath} />
            <p className="mt-6 text-sm text-white/60">
              Already have an account?{" "}
              <Link href={`/auth/login${redirectParam}`} className="text-[#00A3FF]">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
