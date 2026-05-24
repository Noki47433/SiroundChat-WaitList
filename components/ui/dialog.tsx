import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  titleClassName?: string;
  contentClassName?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  overlayClassName,
  panelClassName,
  panelStyle,
  titleClassName,
  contentClassName
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur",
        overlayClassName
      )}
    >
      <div
        className={cn(
          "relative w-full max-w-lg rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl",
          panelClassName
        )}
        style={panelStyle}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 transition"
          style={{ color: "var(--site-muted, rgba(255,255,255,0.6))" }}
          aria-label="Close dialog"
        >
          ×
        </button>
        {title ? (
          <h2 className={cn("mb-4 text-lg font-semibold", titleClassName)} style={{ color: "var(--site-text, #fff)" }}>
            {title}
          </h2>
        ) : null}
        <div className={cn("text-sm", contentClassName)} style={{ color: "var(--site-text, #fff)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
