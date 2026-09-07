// Phase 3 · Manage Booking — theme + design-token derivation.
//
// Given a business WidgetTheme (brand colours are UNTRUSTED inputs), derive a
// WCAG-safe accent + on-accent text colour for the dark manage-booking chassis,
// plus the CSS variables the page/components consume. Colour-mix helpers here
// mirror the pattern in components/chat-widget/ChatWindow.tsx (mixColors /
// clampColorValue) — copied and adapted locally so this module has no coupling
// to private widget internals.
//
// Presentation only: nothing here affects auth, availability, or booking logic.

import type { WidgetTheme } from "@/lib/types/core";

/* ────────────────────────── colour primitives ────────────────────────── */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Clamp a channel to a valid 0–255 integer. Adapted from ChatWindow.tsx. */
export function clampColorValue(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clampColorValue(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Blend `baseHex` toward `mixHex` by `weight` (0..1), returning a hex string.
 * Mirrors ChatWindow.tsx `mixColors` but keeps hex output so results can be
 * fed back into further mixing / contrast math.
 */
export function mixColors(baseHex: string, mixHex: string, weight: number): string {
  try {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHex);
    return rgbToHex(
      base.r + (mix.r - base.r) * weight,
      base.g + (mix.g - base.g) * weight,
      base.b + (mix.b - base.b) * weight
    );
  } catch {
    return baseHex;
  }
}

/** Translucent version of a hex colour as an rgba() string. */
export function rgba(hex: string, alpha: number): string {
  try {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return hex;
  }
}

function channelLuminance(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Lift (or drop) a brand colour toward white/black until it reads at `min`
 * contrast against `surface`. Never trust the raw brand colour for legibility —
 * a business can pick badly and this keeps the UI readable.
 */
export function safeAccentOn(brand: string, surface: string, min = 4.5): string {
  const toward = relativeLuminance(surface) > 0.35 ? "#000000" : "#FFFFFF";
  let out = brand;
  for (let t = 0; t <= 0.92; t += 0.06) {
    out = mixColors(brand, toward, t);
    if (contrastRatio(out, surface) >= min) return out;
  }
  return out;
}

/** Pick the legible ink colour to place ON an accent fill. */
export function onAccentColor(fill: string): string {
  return contrastRatio("#111114", fill) >= 4.5 ? "#111114" : "#FFFFFF";
}

/* ────────────────────────── design tokens ────────────────────────── */

/** Corner radii (px) — prototype §7. */
export const radius = { sm: 12, md: 20, lg: 28, full: 9999 } as const;

/** Spacing scale (px) — prototype §7. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 } as const;

/** Dark neutral chassis surfaces. */
export const surface = {
  page: "#07070A",
  card: "#131317",
  raised: "#17171C",
  sheet: "#1A1A20",
  inset: "#1C1C22",
  line: "rgba(255,255,255,0.06)",
  lineStrong: "rgba(255,255,255,0.10)"
} as const;

export const ink = {
  primary: "#F2F2F5",
  secondary: "#8A8A94",
  faint: "#5A5A64",
  meta: "#6E6E78"
} as const;

/** Destructive coral — used ONLY for destructive meaning, never as a banner. */
export const destructive = "#E8796C";

export type BookingStatusKey = "confirmed" | "pending" | "canceled" | "completed" | "noshow";

/** Restrained status colours (pills only, never giant banners). */
export const statusColor: Record<BookingStatusKey, string> = {
  confirmed: "#3FBF7F",
  pending: "#D9A63C",
  canceled: "#6E6E78",
  completed: "#6E8FB0",
  noshow: "#8A7A6E"
};

/** Motion durations in seconds (framer-motion) and ms (CSS), + sheet easing. */
export const motion = {
  press: 0.12,
  state: 0.18,
  sheet: 0.26,
  success: 0.32,
  ambient: 2.8,
  sheetEase: [0.32, 0.72, 0, 1] as [number, number, number, number]
} as const;

export const durationMs = {
  press: 120,
  state: 180,
  sheet: 260,
  success: 320,
  ambient: 2800
} as const;

/* ────────────────────────── theme derivation ────────────────────────── */

/** A (possibly partial) stored business theme; every field is optional here. */
export type ManageThemeInput = Partial<WidgetTheme> | null | undefined;

export interface ManageTokens {
  /** Raw brand inputs (untrusted for legibility). */
  brandPrimary: string;
  brandSecondary: string;
  /** WCAG-safe (>=4.5:1 on the page) accent — safe for text + fills. */
  accent: string;
  /** Legible ink to place on the accent fill. */
  onAccent: string;
  /** Tinted accent variants for soft fills, hairlines and glows. */
  accentSoft: string;
  accentSofter: string;
  accentLine: string;
  accentGlow: string;
  /** CSS custom properties to spread on the route root. */
  cssVars: Record<string, string>;
}

const FALLBACK_PRIMARY = "#C9A227";
const FALLBACK_SECONDARY = "#17171C";

/**
 * Derive the manage-booking token set from a business theme. The accent is
 * always contrast-checked against the dark page — the raw brand colour is never
 * trusted for text.
 */
export function deriveManageTokens(theme: ManageThemeInput): ManageTokens {
  const brandPrimary =
    typeof theme?.primary === "string" && theme.primary.trim() ? theme.primary : FALLBACK_PRIMARY;
  const brandSecondary =
    (typeof theme?.accent === "string" && theme.accent.trim() && theme.accent) ||
    (typeof theme?.secondary === "string" && theme.secondary.trim() && theme.secondary) ||
    FALLBACK_SECONDARY;

  const accent = safeAccentOn(brandPrimary, surface.page, 4.5);
  const onAccent = onAccentColor(accent);
  const accentSoft = rgba(accent, 0.13);
  const accentSofter = rgba(accent, 0.16);
  const accentLine = rgba(accent, 0.3);
  const accentGlow = rgba(accent, 0.8);

  const cssVars: Record<string, string> = {
    "--mb-accent": accent,
    "--mb-on-accent": onAccent,
    "--mb-accent-soft": accentSoft,
    "--mb-accent-softer": accentSofter,
    "--mb-accent-line": accentLine,
    "--mb-accent-glow": accentGlow,
    "--mb-page": surface.page,
    "--mb-card": surface.card,
    "--mb-raised": surface.raised,
    "--mb-sheet": surface.sheet,
    "--mb-text": ink.primary,
    "--mb-text-2": ink.secondary
  };

  return {
    brandPrimary,
    brandSecondary,
    accent,
    onAccent,
    accentSoft,
    accentSofter,
    accentLine,
    accentGlow,
    cssVars
  };
}

/** Normalize any incoming status string to a known status key. */
export function normalizeStatus(status: string | null | undefined): BookingStatusKey {
  const s = (status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (s === "pending" || s === "pending_approval" || s === "awaiting_confirmation") return "pending";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "completed" || s === "done" || s === "fulfilled") return "completed";
  if (s === "noshow" || s === "no_show" || s === "missed") return "noshow";
  return "confirmed";
}

/**
 * Static (SSR-safe) reduced-motion helper. Returns false on the server so the
 * first paint is stable; components should also subscribe reactively (e.g. via
 * framer-motion's useReducedMotion) for runtime changes.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
