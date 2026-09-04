/**
 * Turning a validated design into CSS.
 *
 * This is the only module that produces CSS text, and it is deliberately dull:
 * every value it emits comes from a number that the schema has already bounded
 * or an enum member it looks up in a table. No spec field is ever interpolated
 * into CSS as-is, so there is no path by which spec content can close a
 * declaration and start a new one.
 */
import type { CSSProperties } from "react";

import type { ArtDirection, ArtStop, Design, SiteSpec } from "@/lib/site-spec/schema";
import { FONT_STACKS } from "@/lib/site-spec/vocabulary";

/**
 * Rounded to 3 decimals and forced through `Number`, so an unexpected value
 * becomes `0` rather than a string that lands in the stylesheet.
 */
const num = (value: number): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 1000) / 1000);
};

const px = (value: number) => `${num(value)}px`;

/** Density scales the whole rhythm. `spacious` is the prototype's premium modifier. */
const DENSITY_SCALE: Record<Design["density"], number> = {
  compact: 0.82,
  regular: 1,
  spacious: 1.16
};

/**
 * The custom properties the renderer stylesheet reads. Returned as a React
 * style object rather than a string so React does the escaping and the value
 * never touches `dangerouslySetInnerHTML`.
 */
export const designToCssVariables = (design: Design): CSSProperties => {
  const { palette, geometry, typography, hero } = design;
  const scale = DENSITY_SCALE[design.density];

  return {
    "--w-bg": palette.background,
    "--w-ink": palette.ink,
    "--w-mut": palette.muted,
    "--w-acc": palette.accent,
    "--w-acc-ink": palette.accentInk,
    "--w-line": palette.line,
    "--w-soft": palette.soft,
    "--w-panel": palette.panel,

    "--w-rad": px(geometry.radius),
    "--w-rad-lg": px(geometry.radiusLg),
    "--w-pad": px(geometry.sectionPad * scale),
    "--w-padx": px(geometry.sectionPadX * scale),
    "--w-gap": px(geometry.gap * scale),
    "--w-colgap": px(geometry.colGap * scale),
    "--w-rule": px(geometry.rule),

    "--w-font": FONT_STACKS[typography.body],
    "--w-disp": FONT_STACKS[typography.display],
    "--w-dispw": num(typography.displayWeight),
    "--w-herow": num(typography.heroWeight),
    "--w-track": `${num(typography.tracking)}em`,
    "--w-measure": `${num(typography.measure)}ch`,

    "--hero-h": px(hero.height),
    "--hero-m-h": px(hero.mobileHeight),
    "--hero-measure": px(hero.measure),

    ...heroScrim(palette)
  } as CSSProperties;
};

/**
 * The full-bleed hero draws white type over a photograph, so it always needs a
 * dark scrim — but a scrim tinted to the site rather than flat black is part of
 * what stops the four art directions reading the same. Tint from whichever of
 * the two palette anchors is actually dark.
 */
const heroScrim = (palette: Design["palette"]): Record<string, string> => {
  const anchor =
    relativeLuminance(palette.background) <= relativeLuminance(palette.ink)
      ? palette.background
      : palette.ink;
  const [r, g, b] = hexToRgb(anchor);
  const at = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
  return {
    "--scrim-a": at(0.94),
    "--scrim-b": at(0.2),
    "--scrim-c": at(0.34)
  };
};

const hexToRgb = (hex: string): [number, number, number] => {
  const raw = hex.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
};

const relativeLuminance = (hex: string): number => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Data attributes the stylesheet keys its chrome variants off. */
export const designToDataAttributes = (design: Design) => ({
  "data-nav": design.chrome.nav,
  "data-navpos": design.chrome.navPosition,
  "data-cta": design.chrome.cta,
  "data-eyebrow": design.chrome.eyebrow,
  "data-density": design.density,
  "data-treatment": design.art.treatment
});

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic art
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw one image from the site's art sequence.
 *
 * There is no randomness and no clock: the same spec and the same index always
 * produce the same picture, which is what makes renderer output comparable
 * between a preview, a published page and a test.
 *
 * Each image gets three layers, back to front:
 *   1. the base gradient — the site's light direction and tonal range
 *   2. a plane edge — a hard-ish line standing in for a wall, shoulder or table
 *   3. radial forms — the light source and the tonal mass
 */
export const artBackgroundImage = (art: ArtDirection, index: number): string => {
  const { sequence } = art;
  const i = ((index % sequence.length) + sequence.length) % sequence.length;
  const stop: ArtStop = sequence[i];

  // The plane edge walks across the frame as the sequence advances, so
  // consecutive images on a page do not share a composition.
  const cut = 34 + i * 4.5;
  const edgeAngle = (stop.angle + 62) % 360;

  const forms = stop.forms.map(
    (form) =>
      `radial-gradient(${num(form.sizeX)}% ${num(form.sizeY)}% at ${num(form.x)}% ${num(form.y)}%, ${form.color}, transparent 70%)`
  );

  const plane = `linear-gradient(${num(edgeAngle)}deg, rgba(0,0,0,.3) 0 ${num(cut)}%, rgba(0,0,0,0) ${num(cut + 1.2)}% 100%)`;

  const base = `linear-gradient(${num(stop.angle)}deg, ${stop.stops
    .map((s) => `${s.color} ${num(s.at)}%`)
    .join(",")})`;

  return [...forms, plane, base].join(",");
};

/** The style object for one generated image tile. */
export const generatedArtStyle = (art: ArtDirection, index: number): CSSProperties => ({
  backgroundImage: artBackgroundImage(art, index)
});

// ─────────────────────────────────────────────────────────────────────────────
// Brand mark
// ─────────────────────────────────────────────────────────────────────────────

/** "Prishtina Fade Co." → "PF". Falls back to the first two letters. */
export const deriveBrandMark = (name: string): string => {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const single = words[0] ?? name.trim();
  return (single.slice(0, 2) || "SC").toUpperCase();
};

/**
 * The oversized footer wordmark is sized from its own character count so a long
 * brand name never clips. Passed as a custom property rather than a font-size
 * so the stylesheet keeps ownership of the formula.
 */
export const brandLengthVariable = (name: string): CSSProperties =>
  ({ "--brandlen": String(Math.max(name.trim().length, 4)) }) as CSSProperties;

/** Convenience for the renderer root. */
export const specRootStyle = (spec: SiteSpec): CSSProperties =>
  designToCssVariables(spec.design);
