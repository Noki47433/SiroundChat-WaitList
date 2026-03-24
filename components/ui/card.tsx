import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "sc-card rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.35)] transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
