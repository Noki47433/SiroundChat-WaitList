import type { SiteThemeTokens } from "@/lib/website-builder/types";
import type { CSSProperties } from "react";

export function themeToCssVars(theme: SiteThemeTokens): CSSProperties {
  return {
    ["--site-primary" as any]: theme.primary,
    ["--site-secondary" as any]: theme.secondary,
    ["--site-bg" as any]: theme.bg,
    ["--site-text" as any]: theme.text,
    ["--site-muted" as any]: theme.muted,
    ["--site-surface" as any]: theme.surface,
    ["--site-border" as any]: theme.border,
    ["--site-buttonText" as any]: theme.buttonText,
    ["--site-accent" as any]: theme.accent ?? theme.primary,
    ["--site-radius" as any]: theme.radius === "xl" ? "1.5rem" : "1rem",
    ["--site-fontHeading" as any]: theme.fontHeading ?? "inherit",
    ["--site-fontBody" as any]: theme.fontBody ?? "inherit",
    ["--site-h1-size" as any]: theme.textStyles?.h1.size ?? "2.75rem",
    ["--site-h1-weight" as any]: theme.textStyles?.h1.weight ?? 600,
    ["--site-h1-line" as any]: theme.textStyles?.h1.lineHeight ?? "1.1",
    ["--site-h1-letter" as any]: theme.textStyles?.h1.letterSpacing ?? "0",
    ["--site-h2-size" as any]: theme.textStyles?.h2.size ?? "2.1rem",
    ["--site-h2-weight" as any]: theme.textStyles?.h2.weight ?? 600,
    ["--site-h2-line" as any]: theme.textStyles?.h2.lineHeight ?? "1.2",
    ["--site-h2-letter" as any]: theme.textStyles?.h2.letterSpacing ?? "0",
    ["--site-h3-size" as any]: theme.textStyles?.h3.size ?? "1.6rem",
    ["--site-h3-weight" as any]: theme.textStyles?.h3.weight ?? 600,
    ["--site-h3-line" as any]: theme.textStyles?.h3.lineHeight ?? "1.25",
    ["--site-h3-letter" as any]: theme.textStyles?.h3.letterSpacing ?? "0",
    ["--site-body-size" as any]: theme.textStyles?.body.size ?? "1rem",
    ["--site-body-weight" as any]: theme.textStyles?.body.weight ?? 400,
    ["--site-body-line" as any]: theme.textStyles?.body.lineHeight ?? "1.6",
    ["--site-body-letter" as any]: theme.textStyles?.body.letterSpacing ?? "0",
    ["--site-caption-size" as any]: theme.textStyles?.caption.size ?? "0.875rem",
    ["--site-caption-weight" as any]: theme.textStyles?.caption.weight ?? 400,
    ["--site-caption-line" as any]: theme.textStyles?.caption.lineHeight ?? "1.5",
    ["--site-caption-letter" as any]: theme.textStyles?.caption.letterSpacing ?? "0"
  };
}
