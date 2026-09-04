/**
 * Deriving a site's art sequence from its palette.
 *
 * The Site Spec's art sequence is six graded stops with light sources and plane
 * edges — a lot of structure, and exactly the kind of thing a model produces
 * badly and inconsistently. So the model never writes it. It picks a palette and
 * a treatment; this module derives the sequence deterministically.
 *
 * That buys three things: generated imagery always shares the site's own light
 * and colour, two sites with different palettes never look alike, and the same
 * palette always yields the same pictures.
 */
import type { ArtStop, ArtDirection, Palette } from "@/lib/site-spec/schema";
import type { ArtTreatment } from "@/lib/site-spec/vocabulary";

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const raw = hex.replace("#", "");
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

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((channel) => clamp(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const withAlpha = (rgb: Rgb, alpha: number): string =>
  `${rgbToHex(rgb)}${clamp(alpha * 255).toString(16).padStart(2, "0").toUpperCase()}`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];

const luminance = (rgb: Rgb): number => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
};

/** Nudge a colour toward warmth or coolness without changing its identity. */
const temper = (rgb: Rgb, warmth: number): Rgb => [
  rgb[0] + warmth * 12,
  rgb[1],
  rgb[2] - warmth * 12
];

// ─────────────────────────────────────────────────────────────────────────────
// Treatment character
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each treatment grades differently, so each wants a different underlying
 * gradient. These constants are the difference between four art directions and
 * four tints of the same one.
 */
const CHARACTER: Record<
  ArtTreatment,
  {
    /** Where the base angle starts, and how far consecutive frames rotate. */
    baseAngle: number;
    angleStep: number;
    /** How far the light colour departs from the accent. */
    lightMix: number;
    /** How dark the far end of the gradient goes, toward the page ground. */
    depth: number;
    /** Warm (+1) or cool (−1) bias. */
    warmth: number;
    /** Strength of the light source. */
    lightAlpha: number;
    /** Strength of the opposing shadow mass. */
    shadowAlpha: number;
  }
> = {
  cinematic: { baseAngle: 158, angleStep: -13, lightMix: 0.42, depth: 0.94, warmth: 1, lightAlpha: 0.5, shadowAlpha: 0.66 },
  clean: { baseAngle: 146, angleStep: -11, lightMix: 0.86, depth: 0.24, warmth: 0.2, lightAlpha: 0.86, shadowAlpha: 0.2 },
  editorial: { baseAngle: 138, angleStep: 9, lightMix: 0.7, depth: 0.5, warmth: 0.7, lightAlpha: 0.68, shadowAlpha: 0.3 },
  photographic: { baseAngle: 168, angleStep: -17, lightMix: 0.34, depth: 0.9, warmth: -0.8, lightAlpha: 0.38, shadowAlpha: 0.62 }
};

/** Six deterministic light/shadow placements — no two frames compose alike. */
const PLACEMENTS: Array<{ lx: number; ly: number; sx: number; sy: number; lw: number; lh: number; sw: number; sh: number }> = [
  { lx: 26, ly: 24, sx: 76, sy: 70, lw: 58, lh: 52, sw: 52, sh: 46 },
  { lx: 68, ly: 30, sx: 22, sy: 76, lw: 46, lh: 44, sw: 54, sh: 48 },
  { lx: 44, ly: 20, sx: 82, sy: 82, lw: 40, lh: 46, sw: 44, sh: 40 },
  { lx: 18, ly: 62, sx: 72, sy: 22, lw: 50, lh: 50, sw: 42, sh: 40 },
  { lx: 58, ly: 56, sx: 12, sy: 16, lw: 48, lh: 52, sw: 40, sh: 38 },
  { lx: 36, ly: 74, sx: 86, sy: 28, lw: 52, lh: 46, sw: 40, sh: 44 }
];

export const ART_SEQUENCE_LENGTH = PLACEMENTS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the six-stop art sequence for a palette and treatment.
 *
 * Deterministic: same inputs, same sequence, every time.
 */
export const deriveArtSequence = (palette: Palette, treatment: ArtTreatment): ArtStop[] => {
  const character = CHARACTER[treatment];
  const background = hexToRgb(palette.background);
  const accent = hexToRgb(palette.accent);
  const ink = hexToRgb(palette.ink);

  // On a light page the imagery still needs somewhere dark to resolve into, and
  // on a dark page it needs somewhere light. Anchor to whichever is further from
  // the accent so every frame has real tonal range.
  const isDarkPage = luminance(background) < luminance(ink);
  const ground = isDarkPage ? background : mix(ink, background, 0.18);
  const highlight = temper(mix(accent, [255, 255, 255], character.lightMix), character.warmth);

  return PLACEMENTS.map((placement, index) => {
    const drift = index / (PLACEMENTS.length - 1); // 0 → 1 across the sequence
    const angle = ((character.baseAngle + character.angleStep * index) % 360 + 360) % 360;

    // Three stops: light source → mid tone → the page's own ground.
    const near = temper(mix(highlight, accent, 0.15 + drift * 0.3), character.warmth);
    const mid = mix(mix(accent, ground, 0.55 + character.depth * 0.2), ground, drift * 0.25);
    const far = mix(ground, isDarkPage ? [0, 0, 0] : ground, character.depth * 0.25);

    return {
      angle,
      stops: [
        { color: rgbToHex(near), at: 0 },
        { color: rgbToHex(mid), at: Math.round(44 + index * 2) },
        { color: rgbToHex(far), at: 100 }
      ],
      forms: [
        {
          x: placement.lx,
          y: placement.ly,
          sizeX: placement.lw,
          sizeY: placement.lh,
          color: withAlpha(
            temper(mix(highlight, [255, 255, 255], 0.35), character.warmth),
            character.lightAlpha - drift * 0.12
          )
        },
        {
          x: placement.sx,
          y: placement.sy,
          sizeX: placement.sw,
          sizeY: placement.sh,
          color: withAlpha(
            mix(ground, [0, 0, 0], isDarkPage ? 0.6 : 0.35),
            character.shadowAlpha - drift * 0.08
          )
        }
      ]
    };
  });
};

export const deriveArtDirection = (palette: Palette, treatment: ArtTreatment): ArtDirection => ({
  treatment,
  sequence: deriveArtSequence(palette, treatment)
});
