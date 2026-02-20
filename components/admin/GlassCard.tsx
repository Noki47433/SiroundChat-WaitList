import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: "green" | "blue" | "warning" | "danger" | "none";
  children: ReactNode;
};

const accentMap: Record<NonNullable<GlassCardProps["accent"]>, string> = {
  green: "from-[#55FF95]/80 to-transparent",
  blue: "from-[#4DD6FF]/70 to-transparent",
  warning: "from-[#FFC547]/70 to-transparent",
  danger: "from-[#FF5D7A]/70 to-transparent",
  none: "from-transparent to-transparent"
};

export function GlassCard({ className, accent = "green", children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[var(--adm-border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-[#55FF95]/25",
        className
      )}
      {...props}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r", accentMap[accent])} />
      <div className="pointer-events-none absolute -right-16 -top-16 h-28 w-28 rounded-full bg-[#55FF95]/10 blur-3xl transition group-hover:opacity-80" />
      {children}
    </div>
  );
}
