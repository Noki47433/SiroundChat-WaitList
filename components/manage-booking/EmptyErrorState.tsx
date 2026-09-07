"use client";

import { motion, useReducedMotion } from "framer-motion";
import { surface, ink, motion as motionTokens } from "@/lib/manage-booking/theme";

export type EmptyErrorGlyph = "calendar-x" | "clock" | "link-off" | "wifi-off";

export interface EmptyErrorStateProps {
  glyph?: EmptyErrorGlyph;
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  accent: string;
  onAccent: string;
}

function Glyph({ glyph }: { glyph: EmptyErrorGlyph }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none"
  };
  if (glyph === "clock") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" {...common}>
        <circle cx="14" cy="14" r="10.2" />
        <path d="M14 9v5.6l3.4 2.2" />
      </svg>
    );
  }
  if (glyph === "link-off") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" {...common}>
        <path d="M11.5 16.5 16.5 11.5M12 8.2 14.8 5.4a5.4 5.4 0 0 1 7.6 7.6l-2.8 2.8M16 19.8l-2.8 2.8a5.4 5.4 0 0 1-7.6-7.6l2.8-2.8" />
        <path d="M4 4l20 20" strokeWidth="1.4" />
      </svg>
    );
  }
  if (glyph === "wifi-off") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" {...common}>
        <path d="M3 10c6-4.6 16-4.6 22 0M7 14.5c4-3 10-3 14 0M11 19c1.8-1.3 4.2-1.3 6 0M14 23.5v.2" />
        <path d="M24 4 4 24" strokeWidth="1.4" />
      </svg>
    );
  }
  // calendar-x
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" {...common}>
      <rect x="3.5" y="5.5" width="19" height="17" rx="4.5" />
      <path d="M3.5 10.5h19M9 3v4M17 3v4" />
      <path d="M10 15.5l6 4M16 15.5l-6 4" />
    </svg>
  );
}

/**
 * Thoughtful empty / dead-end / error state (no-availability, invalid/expired
 * token, window closed, rate-limited). Never leaks token or debug detail.
 */
export function EmptyErrorState({
  glyph = "calendar-x",
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  accent,
  onAccent
}: EmptyErrorStateProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.state }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "34px 22px",
        borderRadius: 26,
        background: surface.card,
        border: `1px solid ${surface.line}`
      }}
    >
      <div
        aria-hidden
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          background: surface.inset,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#7A7A84",
          marginBottom: 16
        }}
      >
        <Glyph glyph={glyph} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.015em", marginBottom: 6, color: ink.primary, maxWidth: "26ch" }}>
        {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: "#8E8E98", maxWidth: "32ch" }}>{body}</div>

      {primaryLabel && onPrimary ? (
        <button
          type="button"
          onClick={onPrimary}
          style={{
            marginTop: 22,
            width: "100%",
            minHeight: 52,
            border: 0,
            borderRadius: 16,
            background: accent,
            color: onAccent,
            font: "inherit",
            fontSize: 15.5,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {primaryLabel}
        </button>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <button
          type="button"
          onClick={onSecondary}
          style={{
            marginTop: 9,
            width: "100%",
            minHeight: 48,
            border: 0,
            borderRadius: 16,
            background: primaryLabel ? "none" : surface.raised,
            color: primaryLabel ? accent : "#EDEDF2",
            font: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {secondaryLabel}
        </button>
      ) : null}
    </motion.div>
  );
}
