import type { SiteThemeTokens } from "@/lib/website-builder/types";
import { resolveThemeFontPair } from "@/lib/website-builder/theme/fonts";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value?: string | null) => {
  const raw = (value ?? "").trim().replace("#", "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (raw.length === 6) {
    return `#${raw}`;
  }
  return null;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixColors = (base: string, overlay: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const weight = clamp(amount, 0, 1);
  return rgbToHex(
    baseRgb.r + (overlayRgb.r - baseRgb.r) * weight,
    baseRgb.g + (overlayRgb.g - baseRgb.g) * weight,
    baseRgb.b + (overlayRgb.b - baseRgb.b) * weight
  );
};

const getContrastText = (background: string) => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111827" : "#FFFFFF";
};

const isNearWhite = (value: string) => {
  const rgb = hexToRgb(value);
  if (!rgb) return false;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => channel / 255);
  return r > 0.92 && g > 0.92 && b > 0.92;
};

export const buildTheme = (
  primaryColor: string,
  backgroundColor: string,
  fontFamily?: string | null
): SiteThemeTokens => {
  const primary = normalizeHex(primaryColor) ?? "#111827";
  const baseBg = normalizeHex(backgroundColor) ?? "#F3F4F6";
  const bg = isNearWhite(baseBg) ? mixColors(primary, "#FFFFFF", 0.92) : baseBg;
  const text = getContrastText(bg);
  const muted = mixColors(text, bg, 0.65);
  const surface = text === "#FFFFFF" ? mixColors(bg, "#111827", 0.35) : mixColors(bg, "#FFFFFF", 0.7);
  const border = text === "#FFFFFF" ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.12)";
  const buttonText = getContrastText(primary);
  const fonts = resolveThemeFontPair(fontFamily);

  return {
    primary,
    secondary: bg,
    bg,
    text,
    muted,
    surface,
    border,
    buttonText,
    accent: primary,
    radius: "xl",
    fontHeading: fonts.heading,
    fontBody: fonts.body,
    textStyles: {
      h1: { size: "2.75rem", weight: 600, lineHeight: "1.1" },
      h2: { size: "2.1rem", weight: 600, lineHeight: "1.2" },
      h3: { size: "1.6rem", weight: 600, lineHeight: "1.25" },
      body: { size: "1rem", weight: 400, lineHeight: "1.6" },
      caption: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    },
    pageTransitions: "fade"
  };
};
