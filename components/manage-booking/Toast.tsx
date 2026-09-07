"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@/lib/manage-booking/theme";

export interface ToastProps {
  /** Message to show, or null to hide. */
  message: string | null;
}

/** Transient pill toast pinned near the bottom of the app frame. */
export function Toast({ message }: ToastProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {message ? (
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 44,
            zIndex: 70,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <motion.div
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: motionTokens.state }}
            style={{
              padding: "11px 18px",
              borderRadius: 999,
              background: "rgba(32,32,38,.94)",
              border: "1px solid rgba(255,255,255,.08)",
              fontSize: 13.5,
              color: "#EDEDF2",
              boxShadow: "0 12px 30px -12px rgba(0,0,0,.8)",
              maxWidth: "100%"
            }}
          >
            {message}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
