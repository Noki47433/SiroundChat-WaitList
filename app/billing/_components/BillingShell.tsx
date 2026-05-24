import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type BillingShellProps = {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  aside?: ReactNode;
  className?: string;
};

export function BillingShell({
  children,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
  aside,
  className
}: BillingShellProps) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#05070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(71,101,175,0.18),transparent_28%),radial-gradient(circle_at_16%_20%,rgba(255,201,110,0.12),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(69,129,212,0.12),transparent_26%),linear-gradient(180deg,#070910_0%,#04060a_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#557dd820] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-[#f0c77812] blur-3xl" />

      <div
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-[1760px] flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-10",
          className
        )}
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/78 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>

          {aside ? <div className="min-w-0">{aside}</div> : <div aria-hidden className="hidden h-11 sm:block" />}
        </div>

        {children}
      </div>
    </div>
  );
}
