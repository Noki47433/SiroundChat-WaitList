import type { HTMLAttributes, ReactNode } from "react";

interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
}

export function Tooltip({ children, label, ...props }: TooltipProps) {
  return (
    <span className="group relative inline-flex" {...props}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
        {label}
      </span>
    </span>
  );
}
