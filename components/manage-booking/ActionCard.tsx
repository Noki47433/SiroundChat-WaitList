"use client";

import { motion, useReducedMotion } from "framer-motion";
import { rgba, surface, ink, destructive, motion as motionTokens } from "@/lib/manage-booking/theme";

export type ActionVariant = "accent" | "neutral" | "destructive";

export interface ActionCardProps {
  label: string;
  hint?: string | null;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: ActionVariant;
  accent: string;
  disabled?: boolean;
}

/** Large (72px) tappable action row: icon box · label + hint · chevron. */
export function ActionCard({
  label,
  hint,
  icon,
  onClick,
  variant = "neutral",
  accent,
  disabled = false
}: ActionCardProps) {
  const reduce = useReducedMotion();

  const fg =
    variant === "accent" ? accent : variant === "destructive" ? destructive : "#EDEDF2";
  const bg =
    variant === "accent"
      ? rgba(accent, 0.13)
      : variant === "destructive"
        ? rgba(destructive, 0.09)
        : surface.raised;
  const border =
    variant === "accent"
      ? `1px solid ${rgba(accent, 0.3)}`
      : variant === "destructive"
        ? `1px solid ${rgba(destructive, 0.28)}`
        : `1px solid ${surface.line}`;
  const iconBg =
    variant === "accent"
      ? rgba(accent, 0.16)
      : variant === "destructive"
        ? rgba(destructive, 0.14)
        : surface.inset;
  const iconFg = variant === "accent" ? accent : variant === "destructive" ? destructive : "#A8A8B2";
  const hintColor =
    variant === "accent" ? rgba(accent, 0.75) : variant === "destructive" ? rgba(destructive, 0.75) : "#75757F";

  return (
    <motion.button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      whileTap={reduce || disabled ? undefined : { scale: 0.99 }}
      transition={{ duration: motionTokens.press }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        minHeight: 72,
        padding: "0 16px",
        border,
        borderRadius: 20,
        background: bg,
        color: fg,
        font: "inherit",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        opacity: disabled ? 0.55 : 1,
        transition: reduce ? "none" : "filter .15s ease"
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          flex: "none",
          borderRadius: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: iconBg,
          color: iconFg
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", color: fg }}>{label}</span>
        {hint ? <span style={{ fontSize: 12.5, fontWeight: 400, color: hintColor }}>{hint}</span> : null}
      </span>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden style={{ opacity: 0.5, color: ink.secondary }}>
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}
