import {
  buildIntegratedTemplateCssVarsFromTheme,
  buildIntegratedTemplateTheme
} from "@/lib/builder/template-sites/palette";
import { EvasionTemplatePage } from "@/components/templates/evasion/Page";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";
import { EssenceTemplatePage } from "@/components/templates/essence/Page";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { HouslyTemplatePage } from "@/components/templates/hously/Page";
import type { HouslyTemplateData } from "@/components/templates/hously/data";
import { FoodTruckTemplatePage } from "@/components/templates/food-truck/Page";
import type {
  FoodTruckTemplateData,
  IntegratedTemplateEditorSettings,
  IntegratedTemplateSiteDocument
} from "@/lib/builder/template-sites/schema";
import editorStyles from "@/components/templates/template-editor.module.css";
import type { CSSProperties } from "react";

type TemplateSiteRendererProps = {
  document: IntegratedTemplateSiteDocument;
  siteId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

const sizeMap = {
  sm: {
    hero: "clamp(2.6rem, 5vw, 4.4rem)",
    body: "0.95rem"
  },
  md: {
    hero: "clamp(3rem, 6vw, 5.25rem)",
    body: "1rem"
  },
  lg: {
    hero: "clamp(3.4rem, 7vw, 6rem)",
    body: "1.08rem"
  }
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value?: string | null) => {
  const trimmed = (value ?? "").trim().replace("#", "");
  if (trimmed.length === 3) {
    return `#${trimmed
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (trimmed.length === 6) return `#${trimmed}`;
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

const withAlpha = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
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

const buildEditorCssVars = (
  template: IntegratedTemplateSiteDocument["template"],
  editorSettings: IntegratedTemplateEditorSettings | undefined,
  resolvedTheme: { primaryColor: string; secondaryColor: string; mode: "dark" | "light" }
) => {
  const textColor = normalizeHex(editorSettings?.colors?.textColor ?? null);
  const heroTextColor = normalizeHex(editorSettings?.colors?.heroTextColor ?? textColor);
  const buttonColor = normalizeHex(
    editorSettings?.colors?.secondaryColor ?? resolvedTheme.secondaryColor
  );
  const buttonText = getContrastText(buttonColor);
  const heroSize = sizeMap[editorSettings?.typography?.heroSize ?? "md"].hero;
  const bodySize = sizeMap[editorSettings?.typography?.bodySize ?? "md"].body;
  const alignment = editorSettings?.typography?.alignment ?? "default";

  const baseVars = {
    "--site-editor-text-color": textColor ?? undefined,
    "--site-editor-hero-text-color": heroTextColor ?? undefined,
    "--site-editor-button-bg": buttonColor ?? undefined,
    "--site-editor-button-text": buttonText,
    "--site-editor-button-border": buttonColor ? withAlpha(buttonColor, 0.65) : undefined,
    "--site-editor-hero-size": heroSize,
    "--site-editor-body-size": bodySize,
    "--site-editor-hero-align": alignment === "default" ? undefined : alignment
  } as CSSProperties;

  if (!textColor) return baseVars;

  return {
    ...baseVars,
    "--site-text": textColor,
    "--site-text-soft": withAlpha(textColor, 0.82),
    "--site-text-faint": withAlpha(textColor, 0.55),
    "--site-muted": withAlpha(textColor, 0.72),
    "--evasion-text": template === "evasion" ? textColor : undefined,
    "--evasion-muted": template === "evasion" ? withAlpha(textColor, 0.72) : undefined,
    "--essence-foreground": template === "essence" ? textColor : undefined,
    "--essence-muted": template === "essence" ? withAlpha(textColor, 0.72) : undefined,
    "--hously-foreground": template === "hously" ? textColor : undefined,
    "--hously-muted": template === "hously" ? withAlpha(textColor, 0.72) : undefined,
    "--ft-text": template === "food-truck" ? textColor : undefined,
    "--ft-muted": template === "food-truck" ? withAlpha(textColor, 0.72) : undefined
  } as CSSProperties;
};

export function TemplateSiteRenderer({
  document,
  siteId,
  primaryColor,
  secondaryColor
}: TemplateSiteRendererProps) {
  const settings = document.editorSettings;
  const resolvedTheme = buildIntegratedTemplateTheme(
    document.template,
    settings?.colors?.primaryColor ??
      primaryColor ??
      document.theme?.primaryColor ??
      null,
    settings?.colors?.secondaryColor ??
      secondaryColor ??
      document.theme?.secondaryColor ??
      null
  );
  const themeForCssVars =
    document.theme &&
    !primaryColor &&
    !secondaryColor &&
    !settings?.colors?.primaryColor &&
    !settings?.colors?.secondaryColor
      ? {
          ...resolvedTheme,
          mode: document.theme.mode
        }
      : resolvedTheme;
  const style = {
    ...buildIntegratedTemplateCssVarsFromTheme(document.template, themeForCssVars),
    ...buildEditorCssVars(document.template, settings, resolvedTheme)
  } as CSSProperties;
  const alignment = settings?.typography?.alignment ?? "default";
  const spacing = settings?.layout?.spacing ?? "default";

  switch (document.template) {
    case "evasion":
      return (
        <div
          style={style}
          className={editorStyles.root}
          data-text-override={settings?.colors?.textColor ? "true" : "false"}
          data-align={alignment}
          data-spacing={spacing}
        >
          <EvasionTemplatePage
            data={document.data as EvasionTemplateData}
            siteId={siteId}
            editorSettings={settings}
          />
        </div>
      );
    case "essence":
      return (
        <div
          style={style}
          className={editorStyles.root}
          data-text-override={settings?.colors?.textColor ? "true" : "false"}
          data-align={alignment}
          data-spacing={spacing}
        >
          <EssenceTemplatePage
            data={document.data as EssenceTemplateData}
            siteId={siteId}
            editorSettings={settings}
          />
        </div>
      );
    case "hously":
      return (
        <div
          style={style}
          className={editorStyles.root}
          data-text-override={settings?.colors?.textColor ? "true" : "false"}
          data-align={alignment}
          data-spacing={spacing}
        >
          <HouslyTemplatePage
            data={document.data as HouslyTemplateData}
            siteId={siteId}
            editorSettings={settings}
          />
        </div>
      );
    case "food-truck":
      return (
        <div
          style={style}
          className={editorStyles.root}
          data-text-override={settings?.colors?.textColor ? "true" : "false"}
          data-align={alignment}
          data-spacing={spacing}
        >
          <FoodTruckTemplatePage
            data={document.data as FoodTruckTemplateData}
            siteId={siteId}
            editorSettings={settings}
          />
        </div>
      );
    default:
      return (
        <div
          style={style}
          className={editorStyles.root}
          data-text-override={settings?.colors?.textColor ? "true" : "false"}
          data-align={alignment}
          data-spacing={spacing}
        >
          <HouslyTemplatePage
            data={document.data as HouslyTemplateData}
            siteId={siteId}
            editorSettings={settings}
          />
        </div>
      );
  }
}
