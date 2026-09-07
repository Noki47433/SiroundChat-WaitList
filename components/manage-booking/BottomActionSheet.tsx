"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { rgba, surface, ink, destructive, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface BottomActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  /** Non-destructive primary (e.g. "Keep booking"). */
  keepLabel: string;
  /** Optional destructive action — the ONLY control tinted restrained red. */
  destructiveLabel?: string;
  onDestructive?: () => void;
  destructiveBusy?: boolean;
  /** Optional supplemental action (e.g. "Call the salon instead"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  accent: string;
  /** Optional booking summary block. */
  children?: React.ReactNode;
}

/**
 * Bottom sheet for confirmations. Primary "keep" action is restrained neutral;
 * the destructive action is the only red control. Focus is trapped to the
 * dialog and Escape closes it.
 */
export function BottomActionSheet({
  open,
  onClose,
  title,
  body,
  keepLabel,
  destructiveLabel,
  onDestructive,
  destructiveBusy = false,
  secondaryLabel,
  onSecondary,
  accent,
  children
}: BottomActionSheetProps) {
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the sheet for keyboard + SR users.
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <motion.button
            type="button"
            aria-label="Dismiss"
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: motionTokens.state }}
            style={{
              position: "absolute",
              inset: 0,
              border: 0,
              padding: 0,
              background: "rgba(4,4,6,.62)",
              backdropFilter: "blur(6px)",
              cursor: "default"
            }}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { y: "102%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "102%" }}
            transition={{ duration: motionTokens.sheet, ease: motionTokens.sheetEase }}
            style={{
              position: "relative",
              background: surface.sheet,
              borderRadius: "30px 30px 0 0",
              padding: "26px 22px 34px",
              boxShadow: "0 -20px 60px -20px rgba(0,0,0,.9)"
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.16)", margin: "-10px auto 18px" }} aria-hidden />
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.02em", marginBottom: 8, color: ink.primary }}>{title}</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: "#9E9EA8" }}>{body}</div>

            {children}

            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={reduce ? undefined : { scale: 0.99 }}
                transition={{ duration: motionTokens.press }}
                style={{
                  minHeight: 54,
                  border: 0,
                  borderRadius: 17,
                  background: "#26262E",
                  color: ink.primary,
                  font: "inherit",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {keepLabel}
              </motion.button>

              {destructiveLabel && onDestructive ? (
                <motion.button
                  type="button"
                  onClick={onDestructive}
                  disabled={destructiveBusy}
                  whileTap={reduce || destructiveBusy ? undefined : { scale: 0.99 }}
                  transition={{ duration: motionTokens.press }}
                  style={{
                    minHeight: 54,
                    border: `1px solid ${rgba(destructive, 0.32)}`,
                    borderRadius: 17,
                    background: rgba(destructive, 0.09),
                    color: destructive,
                    font: "inherit",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: destructiveBusy ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: destructiveBusy ? 0.7 : 1
                  }}
                >
                  {/* icon reinforces destructive meaning (not colour alone) */}
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  {destructiveBusy ? "Canceling…" : destructiveLabel}
                </motion.button>
              ) : null}

              {secondaryLabel && onSecondary ? (
                <button
                  type="button"
                  onClick={onSecondary}
                  style={{
                    minHeight: 52,
                    border: 0,
                    borderRadius: 16,
                    background: "none",
                    color: accent,
                    font: "inherit",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {secondaryLabel}
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
