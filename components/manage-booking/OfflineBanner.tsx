"use client";

import { motion, useReducedMotion } from "framer-motion";
import { surface, ink, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface OfflineBannerProps {
  onRetry: () => void;
  accent: string;
  /** Copy variant: plain offline vs. rate-limited slow-down. */
  variant?: "offline" | "rate-limited";
  message?: string;
  retryLabel?: string;
}

/** Calm inline banner — preserves loaded details, offers a retry. Not a red wall. */
export function OfflineBanner({
  onRetry,
  accent,
  variant = "offline",
  message,
  retryLabel = "Try again"
}: OfflineBannerProps) {
  const reduce = useReducedMotion();
  const text =
    message ??
    (variant === "rate-limited"
      ? "Too many changes just now. Try again in a few minutes."
      : "You're offline. Your booking is still here.");

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.state }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderRadius: 16,
        background: surface.raised,
        border: `1px solid ${surface.line}`
      }}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden style={{ color: "#B4B4BE", flex: "none" }}>
        {variant === "rate-limited" ? (
          <>
            <circle cx="9" cy="9" r="6.6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 5.4V9l2.4 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path
              d="M2 6.5c4-3 10-3 14 0M4.5 9.6c2.7-2 6.3-2 9 0M7 12.7c1.2-.9 2.8-.9 4 0M9 15.6v.2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M15.5 2.5 3 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span style={{ flex: 1, fontSize: 13.5, color: "#C2C2CC" }}>{text}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          border: 0,
          background: "none",
          font: "inherit",
          fontSize: 13.5,
          fontWeight: 600,
          color: accent,
          cursor: "pointer",
          padding: 4,
          minHeight: 44
        }}
      >
        {retryLabel}
      </button>
    </motion.div>
  );
}
