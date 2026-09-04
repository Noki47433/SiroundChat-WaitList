/**
 * Art sequences for the four renderer regression fixtures.
 *
 * Lifted verbatim from the approved Phase 3 visual craft pass so the production
 * renderer can be checked against a known-good result. `rgba()` was converted to
 * `#rrggbbaa` because the Site Spec accepts hex only — the rendered colour is
 * identical.
 *
 * These are TEST FIXTURES. Nothing in `lib/site-spec` or `components/site-spec`
 * imports them, and no renderer branch depends on which one is in play.
 */
import type { ArtStop } from "@/lib/site-spec/schema";

export const FADE_ART: ArtStop[] = [
  { angle: 158, stops: [{ color: "#7A5522", at: 0 }, { color: "#2A1F14", at: 46 }, { color: "#08080A", at: 100 }], forms: [{ x: 26, y: 24, sizeX: 58, sizeY: 52, color: "#FFCB7880" }, { x: 76, y: 70, sizeX: 52, sizeY: 46, color: "#000000A8" }] },
  { angle: 132, stops: [{ color: "#6B4A20", at: 0 }, { color: "#221A12", at: 52 }, { color: "#0A0A0B", at: 100 }], forms: [{ x: 68, y: 30, sizeX: 46, sizeY: 44, color: "#FFC47066" }, { x: 22, y: 76, sizeX: 54, sizeY: 48, color: "#00000099" }] },
  { angle: 168, stops: [{ color: "#4C3A22", at: 0 }, { color: "#1A1510", at: 54 }, { color: "#08080A", at: 100 }], forms: [{ x: 44, y: 20, sizeX: 40, sizeY: 46, color: "#FFD6965C" }, { x: 82, y: 82, sizeX: 44, sizeY: 40, color: "#000000B2" }] },
  { angle: 146, stops: [{ color: "#8A6026", at: 0 }, { color: "#2E2216", at: 44 }, { color: "#0B0A0A", at: 100 }], forms: [{ x: 18, y: 62, sizeX: 50, sizeY: 50, color: "#FFBE6870" }, { x: 72, y: 22, sizeX: 42, sizeY: 40, color: "#00000085" }] },
  { angle: 120, stops: [{ color: "#5A4423", at: 0 }, { color: "#1E1811", at: 50 }, { color: "#09090A", at: 100 }], forms: [{ x: 58, y: 56, sizeX: 48, sizeY: 52, color: "#FFCE8057" }, { x: 12, y: 16, sizeX: 40, sizeY: 38, color: "#0000008C" }] },
  { angle: 174, stops: [{ color: "#6F5028", at: 0 }, { color: "#231B13", at: 48 }, { color: "#0A090A", at: 100 }], forms: [{ x: 36, y: 74, sizeX: 52, sizeY: 46, color: "#FFC77661" }, { x: 86, y: 28, sizeX: 40, sizeY: 44, color: "#0000009E" }] },
];

export const LUMI_ART: ArtStop[] = [
  { angle: 146, stops: [{ color: "#FDF2F6", at: 0 }, { color: "#F0CFDC", at: 56 }, { color: "#DFAFC4", at: 100 }], forms: [{ x: 30, y: 26, sizeX: 54, sizeY: 50, color: "#FFFFFFDB" }, { x: 78, y: 76, sizeX: 46, sizeY: 44, color: "#B4547A33" }] },
  { angle: 118, stops: [{ color: "#FBEAF1", at: 0 }, { color: "#EBC4D5", at: 58 }, { color: "#D69FB8", at: 100 }], forms: [{ x: 72, y: 24, sizeX: 48, sizeY: 46, color: "#FFFFFFC7" }, { x: 20, y: 80, sizeX: 44, sizeY: 42, color: "#9646682E" }] },
  { angle: 162, stops: [{ color: "#FEF6F9", at: 0 }, { color: "#F4DAE5", at: 52 }, { color: "#E4B8CC", at: 100 }], forms: [{ x: 46, y: 34, sizeX: 42, sizeY: 44, color: "#FFFFFFE6" }, { x: 84, y: 70, sizeX: 38, sizeY: 40, color: "#AA5A7C29" }] },
  { angle: 134, stops: [{ color: "#F9E7EF", at: 0 }, { color: "#E9C0D2", at: 54 }, { color: "#D298B4", at: 100 }], forms: [{ x: 22, y: 66, sizeX: 52, sizeY: 48, color: "#FFFFFFCC" }, { x: 76, y: 20, sizeX: 40, sizeY: 38, color: "#96466833" }] },
  { angle: 104, stops: [{ color: "#FDF0F5", at: 0 }, { color: "#F0CEDD", at: 56 }, { color: "#DDA9C1", at: 100 }], forms: [{ x: 62, y: 58, sizeX: 46, sizeY: 48, color: "#FFFFFFD6" }, { x: 16, y: 18, sizeX: 40, sizeY: 38, color: "#A0507224" }] },
  { angle: 172, stops: [{ color: "#FCEEF4", at: 0 }, { color: "#EEC8D9", at: 50 }, { color: "#D8A2BC", at: 100 }], forms: [{ x: 38, y: 76, sizeX: 50, sizeY: 46, color: "#FFFFFFD1" }, { x: 88, y: 30, sizeX: 36, sizeY: 42, color: "#9646682E" }] },
];

export const ELEGANCE_ART: ArtStop[] = [
  { angle: 152, stops: [{ color: "#F3E8DE", at: 0 }, { color: "#DCC2B2", at: 54 }, { color: "#BE9C89", at: 100 }], forms: [{ x: 34, y: 28, sizeX: 52, sizeY: 48, color: "#FFF8F0B8" }, { x: 80, y: 74, sizeX: 44, sizeY: 42, color: "#60443447" }] },
  { angle: 126, stops: [{ color: "#EFE0D5", at: 0 }, { color: "#D3B7A6", at: 56 }, { color: "#B4907C", at: 100 }], forms: [{ x: 70, y: 26, sizeX: 46, sizeY: 44, color: "#FFF7EEA8" }, { x: 24, y: 78, sizeX: 44, sizeY: 42, color: "#583E304C" }] },
  { angle: 166, stops: [{ color: "#F6EDE5", at: 0 }, { color: "#E1CBBC", at: 50 }, { color: "#C4A491", at: 100 }], forms: [{ x: 48, y: 32, sizeX: 42, sizeY: 46, color: "#FFFAF4B2" }, { x: 86, y: 78, sizeX: 38, sizeY: 40, color: "#5C423242" }] },
  { angle: 138, stops: [{ color: "#F1E4D9", at: 0 }, { color: "#D8BEAD", at: 52 }, { color: "#B99680", at: 100 }], forms: [{ x: 20, y: 64, sizeX: 50, sizeY: 48, color: "#FFF8F0A3" }, { x: 74, y: 22, sizeX: 40, sizeY: 38, color: "#583E3042" }] },
  { angle: 110, stops: [{ color: "#F4EAE1", at: 0 }, { color: "#DEC5B4", at: 56 }, { color: "#C09E8B", at: 100 }], forms: [{ x: 60, y: 58, sizeX: 46, sizeY: 48, color: "#FFF9F2AD" }, { x: 14, y: 20, sizeX: 40, sizeY: 38, color: "#5C42323D" }] },
  { angle: 176, stops: [{ color: "#F2E6DC", at: 0 }, { color: "#D9BFAE", at: 50 }, { color: "#BB9884", at: 100 }], forms: [{ x: 40, y: 74, sizeX: 50, sizeY: 46, color: "#FFF8F0A8" }, { x: 88, y: 32, sizeX: 36, sizeY: 42, color: "#583E3047" }] },
];

export const LENS_ART: ArtStop[] = [
  { angle: 162, stops: [{ color: "#7B8492", at: 0 }, { color: "#2A2F37", at: 50 }, { color: "#0B0C0E", at: 100 }], forms: [{ x: 30, y: 26, sizeX: 56, sizeY: 50, color: "#E2ECFF80" }, { x: 78, y: 74, sizeX: 48, sizeY: 44, color: "#0000009E" }] },
  { angle: 128, stops: [{ color: "#5E6672", at: 0 }, { color: "#22262D", at: 54 }, { color: "#0A0B0D", at: 100 }], forms: [{ x: 70, y: 30, sizeX: 48, sizeY: 46, color: "#D6E2F66B" }, { x: 22, y: 78, sizeX: 46, sizeY: 42, color: "#00000094" }] },
  { angle: 174, stops: [{ color: "#8A93A1", at: 0 }, { color: "#31363E", at: 48 }, { color: "#0C0D10", at: 100 }], forms: [{ x: 44, y: 22, sizeX: 44, sizeY: 46, color: "#ECF4FF70" }, { x: 84, y: 80, sizeX: 40, sizeY: 42, color: "#000000A8" }] },
  { angle: 140, stops: [{ color: "#4E555F", at: 0 }, { color: "#1D2127", at: 52 }, { color: "#090A0C", at: 100 }], forms: [{ x: 18, y: 60, sizeX: 52, sizeY: 50, color: "#CEDCF266" }, { x: 74, y: 20, sizeX: 42, sizeY: 40, color: "#0000008A" }] },
  { angle: 112, stops: [{ color: "#6D7684", at: 0 }, { color: "#262B32", at: 52 }, { color: "#0A0B0E", at: 100 }], forms: [{ x: 60, y: 56, sizeX: 48, sizeY: 50, color: "#DCE8FC61" }, { x: 14, y: 18, sizeX: 40, sizeY: 38, color: "#00000099" }] },
  { angle: 184, stops: [{ color: "#5A616D", at: 0 }, { color: "#20242A", at: 50 }, { color: "#090A0C", at: 100 }], forms: [{ x: 38, y: 74, sizeX: 52, sizeY: 46, color: "#D4E2F866" }, { x: 88, y: 30, sizeX: 38, sizeY: 42, color: "#000000A3" }] },
];
