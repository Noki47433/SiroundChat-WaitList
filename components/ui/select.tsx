import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-4 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3FF]/70",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
