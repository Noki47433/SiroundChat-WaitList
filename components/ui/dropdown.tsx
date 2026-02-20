"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
}

export function Dropdown({ trigger, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2">
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 min-w-[200px] rounded-2xl border border-white/10 bg-neutral-900/95 p-2 shadow-2xl"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
