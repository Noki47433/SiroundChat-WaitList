"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils/cn";

type SheetContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

export function Sheet({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
}

const useSheet = () => {
  const ctx = useContext(SheetContext);
  if (!ctx) {
    throw new Error("Sheet components must be used within <Sheet />");
  }
  return ctx;
};

export function SheetContent({ className, children }: HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange } = useSheet();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label="Close panel"
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-neutral-950 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-white/65", className)} {...props} />;
}
