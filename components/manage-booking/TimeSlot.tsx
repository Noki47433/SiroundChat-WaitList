"use client";

import { motion, useReducedMotion } from "framer-motion";
import { rgba, surface, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface TimeSlotProps {
  label: string;
  active: boolean;
  onSelect: () => void;
  accent: string;
  onAccent: string;
}

/** A single available time chip. Only ever rendered for real, open slots. */
export function TimeSlot({ label, active, onSelect, accent, onAccent }: TimeSlotProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      animate={reduce ? undefined : { scale: active ? 1.02 : 1 }}
      transition={{ duration: motionTokens.press }}
      style={{
        minHeight: 52,
        borderRadius: 16,
        font: "inherit",
        fontSize: 16,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-.01em",
        cursor: "pointer",
        border: active ? `1px solid ${rgba(accent, 0.6)}` : `1px solid ${surface.line}`,
        background: active ? accent : surface.raised,
        color: active ? onAccent : "#EDEDF2",
        transition: reduce ? "none" : "background .16s ease, color .16s ease"
      }}
    >
      {label}
    </motion.button>
  );
}
