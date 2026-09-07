"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { rgba, surface, ink, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface BookingLinkChipProps {
  accent: string;
}

/**
 * Shows a friendly, obfuscated representation of the CURRENT page URL (never a
 * raw token dump). Copy copies the real URL to the clipboard. The real URL is
 * NEVER sent to analytics/logging.
 */
export function BookingLinkChip({ accent }: BookingLinkChipProps) {
  const reduce = useReducedMotion();
  const [href, setHref] = useState<string>("");
  const [display, setDisplay] = useState<string>("surroundchat.com/…");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const full = window.location.href;
    setHref(full);
    setDisplay(obfuscate(full));
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    // Copy the REAL url — but never emit it to logs/analytics.
    try {
      if (href && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      }
    } catch {
      /* clipboard may be unavailable; still flip the affordance */
    }
    setCopied(true);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 44,
        padding: "0 6px 0 14px",
        borderRadius: 14,
        background: surface.card,
        border: `1px solid ${surface.line}`
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        style={{ color: "#63636D", flex: "none" }}
      >
        <path
          d="M6.5 9.5 9.5 6.5M7 4.6 8.6 3a3.1 3.1 0 0 1 4.4 4.4l-1.6 1.6M9 11.4 7.4 13A3.1 3.1 0 0 1 3 8.6l1.6-1.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--font-mb-mono, ui-monospace, monospace)",
          fontSize: 13,
          color: ink.secondary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy booking link"}
        style={{
          minHeight: 34,
          minWidth: 44,
          padding: copied ? "0 12px" : "0 10px",
          border: 0,
          borderRadius: 11,
          cursor: "pointer",
          font: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: copied ? rgba(accent, 0.16) : surface.inset,
          color: copied ? accent : "#B4B4BE",
          transition: reduce ? "none" : "background .16s ease, color .16s ease"
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="copied"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: motionTokens.state }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2.5 7.4 5.4 10 11.5 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Copied</span>
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: motionTokens.state }}
              style={{ display: "flex" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="5.4" y="5.4" width="8.1" height="8.1" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M10.6 5.4V4.3c0-1-.8-1.8-1.8-1.8H4.3c-1 0-1.8.8-1.8 1.8v4.5c0 1 .8 1.8 1.8 1.8h1.1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

/** Friendly, non-revealing rendering of the URL (host + short masked tail). */
function obfuscate(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return `${host}/…/••••••`;
  } catch {
    return "your private booking link";
  }
}
