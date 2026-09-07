"use client";

import { motion, useReducedMotion } from "framer-motion";
import { rgba, ink, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface SuccessStateProps {
  title: string;
  body: string;
  accent: string;
}

/** Subtle success confirmation — badge pop + drawn check + fading ring. */
export function SuccessState({ title, body, accent }: SuccessStateProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.state }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "6px 0 8px"
      }}
    >
      <div
        style={{
          position: "relative",
          width: 76,
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18
        }}
      >
        {!reduce ? (
          <motion.span
            aria-hidden
            initial={{ scale: 0.7, opacity: 0.55 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 38,
              border: `2px solid ${rgba(accent, 0.5)}`
            }}
          />
        ) : null}
        <motion.span
          aria-hidden
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: motionTokens.success, ease: motionTokens.sheetEase }}
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            background: rgba(accent, 0.16),
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
            <motion.path
              d="M10 18.6 15.4 24 26 12.6"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.42, delay: 0.1, ease: "easeOut" }}
            />
          </svg>
        </motion.span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 8, color: ink.primary }}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.55, color: "#9E9EA8", maxWidth: "32ch" }}>{body}</div>
    </motion.div>
  );
}
