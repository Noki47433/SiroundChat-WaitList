import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full bg-white/10", className)} {...props} />;
}
