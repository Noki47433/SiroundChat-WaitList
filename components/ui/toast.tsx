"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Toast = {
  id: string;
  title: string;
  message?: string;
  variant?: "default" | "success" | "error" | "info";
};

type ToastContextValue = {
  push: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "min-w-[240px] rounded-2xl border px-4 py-3 text-sm text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
              toast.variant === "success" && "border-emerald-500/30 bg-emerald-500/20",
              toast.variant === "error" && "border-red-500/30 bg-red-500/20",
              toast.variant === "info" && "border-sky-500/30 bg-sky-500/20",
              toast.variant === "default" && "border-white/10 bg-white/10"
            )}
          >
            <p className="font-semibold">{toast.title}</p>
            {toast.message ? <p className="text-xs text-white/80">{toast.message}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("ToastProvider is missing; toast call ignored.");
        }
      }
    };
  }
  return ctx;
};
