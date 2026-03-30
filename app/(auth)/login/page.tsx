import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "@/components/forms/LoginForm";
import { ToastProvider } from "@/components/ui/toast";
import { resolveRedirectPath } from "@/lib/utils/redirect";

export default function LoginPage({ searchParams }: { searchParams?: { redirect?: string } }) {
  const redirectPath = resolveRedirectPath(searchParams?.redirect, "/dashboard");
  const redirectParam = redirectPath !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  return (
    <ToastProvider>
      <div className="relative min-h-screen overflow-hidden bg-[#F7D507] text-slate-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[#F7D507]" />
          <div className="absolute -left-[8%] -top-[6%] h-[34%] w-[44%] bg-[#FDE888]/80 [clip-path:polygon(0_0,100%_10%,70%_100%,0_84%)]" />
          <div className="absolute left-[26%] -top-[4%] h-[34%] w-[40%] bg-[#F7D955]/75 [clip-path:polygon(12%_0,100%_0,78%_100%,0_72%)]" />
          <div className="absolute right-[-4%] top-[5%] h-[28%] w-[34%] bg-[#FCEFA8]/70 [clip-path:polygon(24%_0,100%_8%,84%_100%,0_84%)]" />
          <div className="absolute -left-[6%] top-[28%] h-[30%] w-[36%] bg-[#E1A51A]/65 [clip-path:polygon(0_8%,80%_0,100%_78%,24%_100%)]" />
          <div className="absolute left-[30%] top-[36%] h-[26%] w-[44%] bg-[#F2C226]/65 [clip-path:polygon(0_20%,72%_0,100%_80%,24%_100%)]" />
          <div className="absolute right-[-8%] top-[44%] h-[30%] w-[38%] bg-[#F8D95D]/60 [clip-path:polygon(0_8%,78%_0,100%_84%,20%_100%)]" />
          <div className="absolute -left-[10%] bottom-[-4%] h-[34%] w-[46%] bg-[#D99713]/65 [clip-path:polygon(0_18%,82%_0,100%_82%,20%_100%)]" />
          <div className="absolute left-[24%] bottom-[-6%] h-[34%] w-[44%] bg-[#F4CB2C]/70 [clip-path:polygon(0_28%,84%_0,100%_100%,22%_100%)]" />
          <div className="absolute right-[-6%] bottom-[-4%] h-[30%] w-[34%] bg-[#FAE57E]/70 [clip-path:polygon(18%_0,100%_12%,100%_100%,0_82%)]" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-white/8" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full overflow-hidden rounded-[40px] border border-white/80 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
              <section className="relative overflow-hidden border-b border-white/70 bg-gradient-to-br from-[#FFF8DF] via-[#FFF4C7] to-[#FFE49F] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:border-white/70 lg:p-12">
                <div className="pointer-events-none absolute -right-16 top-20 h-52 w-52 rounded-full bg-amber-200/45 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/70 shadow-sm">
                      <Image
                        src="/images-logo/SiroundChatLogo.png"
                        alt="SiroundChat logo"
                        width={38}
                        height={28}
                        className="h-8 w-auto"
                        priority
                      />
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-slate-900">SiroundChat</p>
                  </div>

                  <h1 className="mt-8 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                    Welcome back to your dashboard
                  </h1>
                  <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">
                    Sign in to keep your bot on-brand, review conversations, and ship updates in minutes.
                  </p>

                  <div className="mt-8 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Secure login
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white/95 p-8 sm:p-10 lg:p-12">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-600">Login</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Access your account</h2>
                <p className="mt-2 text-sm text-slate-500">Continue where you left off.</p>

                <div className="mt-7">
                  <LoginForm redirect={redirectPath} variant="light" />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                  <Link href={`/signup${redirectParam}`} className="font-medium text-slate-600 hover:text-slate-900">
                    New here? Create account
                  </Link>
                  <Link href="/forgot-password" className="font-medium text-slate-600 hover:text-slate-900">
                    Forgot password?
                  </Link>
                  <Link href="/" className="font-semibold text-amber-600 hover:text-amber-700">
                    Back to home
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
