import type { CSSProperties } from "react";
import type {
  IntegratedTemplateId,
  IntegratedTemplateTheme
} from "@/lib/builder/template-sites/schema";

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

const hexToRgb = (value?: string | null) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const mixColors = (base: string, overlay: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const weight = clamp(amount, 0, 1);
  const next = {
    r: baseRgb.r + (overlayRgb.r - baseRgb.r) * weight,
    g: baseRgb.g + (overlayRgb.g - baseRgb.g) * weight,
    b: baseRgb.b + (overlayRgb.b - baseRgb.b) * weight
  };
  return `#${[next.r, next.g, next.b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

const withAlpha = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const relativeLuminance = (value?: string | null) => {
  const rgb = hexToRgb(value);
  if (!rgb) return 0.5;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const next = channel / 255;
    return next <= 0.03928 ? next / 12.92 : Math.pow((next + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrastText = (value?: string | null) =>
  relativeLuminance(value) > 0.56 ? "#111827" : "#F8FAFC";

const rgbToHue = (rgb: { r: number; g: number; b: number } | null) => {
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  switch (max) {
    case r:
      hue = ((g - b) / delta) % 6;
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }
  return Math.round(hue * 60 < 0 ? hue * 60 + 360 : hue * 60);
};

const describeColor = (value?: string | null) => {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const luminance = relativeLuminance(value);
  const hue = rgbToHue(rgb);
  const tone =
    luminance < 0.18 ? "deep" : luminance < 0.4 ? "rich" : luminance > 0.82 ? "soft" : "warm";

  if (hue === null) return `${tone} neutral`;
  if (hue >= 0 && hue < 18) return `${tone} red`;
  if (hue >= 18 && hue < 48) return `${tone} amber`;
  if (hue >= 48 && hue < 75) return `${tone} gold`;
  if (hue >= 75 && hue < 155) return `${tone} green`;
  if (hue >= 155 && hue < 205) return `${tone} teal`;
  if (hue >= 205 && hue < 255) return `${tone} blue`;
  if (hue >= 255 && hue < 315) return `${tone} violet`;
  return `${tone} rose`;
};

export const describePalette = (primaryColor?: string | null, secondaryColor?: string | null) => {
  const primary = describeColor(primaryColor);
  const secondary = describeColor(secondaryColor);
  if (primary && secondary) return `${primary} primary with ${secondary} supporting tones`;
  if (primary) return `${primary} brand-led palette`;
  if (secondary) return `${secondary} hospitality palette`;
  return null;
};

export const getPaletteSelectionBias = (primaryColor?: string | null, secondaryColor?: string | null) => {
  const primaryRgb = hexToRgb(primaryColor);
  const primaryHue = rgbToHue(primaryRgb);
  const primaryLuminance = relativeLuminance(primaryColor);
  const secondaryLuminance = relativeLuminance(secondaryColor);
  const bias: Record<IntegratedTemplateId, number> = {
    evasion: 0,
    essence: 0,
    hously: 0,
    "food-truck": 0
  };

  if (primaryLuminance < 0.22 || secondaryLuminance < 0.24) {
    bias.evasion += 2;
    bias.essence += 1;
  }

  if (secondaryLuminance > 0.78) {
    bias.hously += 2;
    bias.essence += 1;
  }

  if (primaryHue !== null && primaryHue >= 18 && primaryHue <= 58) {
    bias.essence += 1;
    bias["food-truck"] += 2;
  }

  if (primaryHue !== null && primaryHue >= 185 && primaryHue <= 245) {
    bias.hously += 2;
  }

  return bias;
};

const TEMPLATE_FALLBACKS: Record<IntegratedTemplateId, { primary: string; accent: string }> = {
  evasion: { primary: "#111315", accent: "#bfa06a" },
  essence: { primary: "#1a1612", accent: "#b58c57" },
  hously: { primary: "#181512", accent: "#1f1a16" },
  "food-truck": { primary: "#090909", accent: "#f4b938" }
};

export const buildIntegratedTemplateTheme = (
  template: IntegratedTemplateId,
  primaryColor?: string | null,
  secondaryColor?: string | null
): IntegratedTemplateTheme => {
  const dominant = normalizeHex(primaryColor) ?? TEMPLATE_FALLBACKS[template].primary;
  const accent = normalizeHex(secondaryColor) ?? TEMPLATE_FALLBACKS[template].accent;

  return {
    primaryColor: dominant,
    secondaryColor: accent,
    mode: relativeLuminance(dominant) < 0.34 ? "dark" : "light"
  };
};

export const buildIntegratedTemplateCssVarsFromTheme = (
  template: IntegratedTemplateId,
  theme: IntegratedTemplateTheme
) => {
  const dominant = normalizeHex(theme.primaryColor) ?? TEMPLATE_FALLBACKS[template].primary;
  const accent = normalizeHex(theme.secondaryColor) ?? TEMPLATE_FALLBACKS[template].accent;
  const darkDominant = theme.mode === "dark";
  const bg = darkDominant ? mixColors(dominant, accent, 0.08) : mixColors("#ffffff", dominant, 0.06);
  const surface = darkDominant ? mixColors(bg, "#ffffff", 0.04) : mixColors(bg, accent, 0.08);
  const surfaceStrong = darkDominant ? mixColors(bg, "#ffffff", 0.08) : mixColors(bg, accent, 0.16);
  const text = getContrastText(bg);
  const textSoft = withAlpha(text, darkDominant ? 0.8 : 0.74);
  const muted = withAlpha(text, darkDominant ? 0.68 : 0.62);
  const textFaint = withAlpha(text, darkDominant ? 0.48 : 0.38);
  const border = withAlpha(accent, darkDominant ? 0.24 : 0.18);
  const buttonText = getContrastText(accent);
  const accentSoft = darkDominant ? withAlpha(accent, 0.18) : withAlpha(accent, 0.14);
  const accentStrong = mixColors(accent, darkDominant ? "#ffffff" : dominant, darkDominant ? 0.12 : 0.08);
  const sharedVars = {
    "--site-primary": dominant,
    "--site-secondary": accent,
    "--site-background": bg,
    "--site-surface": surface,
    "--site-surface-strong": surfaceStrong,
    "--site-text": text,
    "--site-text-soft": textSoft,
    "--site-text-faint": textFaint,
    "--site-muted": muted,
    "--site-border": border,
    "--site-accent": accent,
    "--site-accent-soft": accentSoft,
    "--site-accent-strong": accentStrong,
    "--site-primary-foreground": buttonText,
    "--site-overlay": darkDominant ? "rgba(4, 6, 9, 0.66)" : "rgba(12, 18, 28, 0.42)"
  } as CSSProperties;

  switch (template) {
    case "evasion":
      return {
        ...sharedVars,
        "--evasion-bg": bg,
        "--evasion-surface": surface,
        "--evasion-surface-2": surfaceStrong,
        "--evasion-text": text,
        "--evasion-muted": muted,
        "--evasion-border": border,
        "--evasion-accent": accent,
        "--evasion-shadow": darkDominant
          ? "0 28px 90px rgba(2,6,13,0.35)"
          : "0 28px 90px rgba(17,17,17,0.18)"
      } as CSSProperties;
    case "essence":
      return {
        ...sharedVars,
        "--essence-bg": bg,
        "--essence-foreground": text,
        "--essence-muted": muted,
        "--essence-border": border,
        "--essence-primary": accent,
        "--essence-primary-foreground": buttonText,
        "--essence-secondary": surface,
        "--essence-accent": accent
      } as CSSProperties;
    case "hously":
      return {
        ...sharedVars,
        "--hously-background": bg,
        "--hously-foreground": text,
        "--hously-primary": accent,
        "--hously-primary-foreground": buttonText,
        "--hously-secondary": surface,
        "--hously-muted": muted,
        "--hously-border": border,
        "--hously-accent": accent
      } as CSSProperties;
    case "food-truck": {
      return {
        ...sharedVars,
        "--ft-bg": bg,
        "--ft-surface": surface,
        "--ft-surface-strong": surfaceStrong,
        "--ft-border": border,
        "--ft-text": text,
        "--ft-muted": muted,
        "--ft-primary": accent,
        "--ft-primary-strong": mixColors(accent, "#ffffff", 0.12),
        "--ft-accent": accentStrong
      } as CSSProperties;
    }
    default:
      return {} as CSSProperties;
  }
};

export const buildIntegratedTemplateCssVars = (
  template: IntegratedTemplateId,
  primaryColor?: string | null,
  secondaryColor?: string | null
) =>
  buildIntegratedTemplateCssVarsFromTheme(
    template,
    buildIntegratedTemplateTheme(template, primaryColor, secondaryColor)
  );
