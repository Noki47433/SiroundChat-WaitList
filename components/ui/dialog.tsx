import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/60 transition hover:text-white"
          aria-label="Close dialog"
        >
          ×
        </button>
        {title ? <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2> : null}
        <div className={cn("text-sm text-white/90")}>{children}</div>
      </div>
    </div>
  );
}
