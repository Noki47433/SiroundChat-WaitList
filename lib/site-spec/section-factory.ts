/**
 * Deterministic section construction.
 *
 * The Stage 3C canary found that "add a gallery" could not be done
 * conversationally. The reason was structural, not a prompt problem: the only
 * insertion operation took a whole `SectionSchema` object, so the model had to
 * author a complete, valid Site Spec section — nested heading, layout,
 * presentation, an exact tile count, framing, media refs. It reliably could not,
 * and the applier correctly refused the result.
 *
 * The fix keeps the typed-op architecture rather than relaxing it. The model now
 * makes only the choices a person would make — *what kind of section, roughly
 * where, and how it should feel* — from closed vocabularies. This file turns
 * that bounded intent into a section that is valid by construction:
 *
 *   · the id is unique within the spec and derived, never model-supplied
 *   · the tile count is exactly `GALLERY_TILE_COUNT[presentation]`, so a grid
 *     can never render a hole
 *   · media slots bind the site's own `builder_site_assets` where they exist and
 *     fall back to deterministic art where they do not — the same rule the rest
 *     of the renderer follows
 *   · everything else takes the schema's own defaults
 *
 * Pure and side-effect free, so it is exhaustively testable without a model or a
 * database.
 */
import {
  GALLERY_TILE_COUNT,
  type BookingPresentation,
  type GalleryPresentation
} from "@/lib/site-spec/vocabulary";
import type { Section, SiteSpec } from "@/lib/site-spec/schema";

/** Section types the factory can build. Deliberately small and closed. */
export const INSERTABLE_SECTIONS = ["gallery", "booking"] as const;
export type InsertableSection = (typeof INSERTABLE_SECTIONS)[number];

export type SectionPlacement =
  | { at: "start" }
  | { at: "end" }
  | { after: string }
  | { before: string };

export type InsertSectionIntent = {
  section: InsertableSection;
  presentation: GalleryPresentation | BookingPresentation;
  placement: SectionPlacement;
  title?: string;
  eyebrow?: string;
};

/** An asset the site owns, as the guard hands them over: ids and labels only. */
export type AssetChoice = { id: string; label?: string };

/**
 * A section id that is stable, readable and guaranteed not to collide.
 * `gallery`, then `gallery-2`, `gallery-3`… — never a random string, because an
 * id shows up in reorder operations and in history labels a person reads.
 */
export const nextSectionId = (spec: SiteSpec, base: string): string => {
  const taken = new Set(spec.sections.map((section) => section.id));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("could not allocate a section id");
};

/** Where the new section goes. An unknown anchor falls back to the end. */
export const resolveInsertIndex = (spec: SiteSpec, placement: SectionPlacement): number => {
  if ("at" in placement) return placement.at === "start" ? 0 : spec.sections.length;
  const anchor = "after" in placement ? placement.after : placement.before;
  const index = spec.sections.findIndex((section) => section.id === anchor);
  if (index === -1) return spec.sections.length;
  return "after" in placement ? index + 1 : index;
};

/**
 * Build a valid gallery section.
 *
 * `assets` are bound in order up to the presentation's fixed tile count; any
 * remaining tiles are deterministic art with distinct seeds, so the grid is
 * always full and always reproducible.
 */
export const buildGallerySection = (
  spec: SiteSpec,
  intent: InsertSectionIntent,
  assets: AssetChoice[]
): Section => {
  const presentation = intent.presentation as GalleryPresentation;
  const tiles = GALLERY_TILE_COUNT[presentation];
  const items = Array.from({ length: tiles }, (_, index) => {
    const asset = assets[index];
    return asset
      ? ({
          kind: "asset" as const,
          assetId: asset.id,
          // A neutral, generated accessible name. The `label` is an internal UI
          // hint ("gallery 2") chosen by the guard, not something a person wrote
          // about the picture, so echoing it into the page would put arbitrary
          // internal text — a URL, in the worst case — in front of a screen
          // reader. The owner can rename any image conversationally afterwards.
          alt: `Gallery image ${index + 1}`,
          fallbackSeed: index % 64
        })
      : ({ kind: "generated" as const, seed: index % 64 });
  });

  return {
    id: nextSectionId(spec, "gallery"),
    type: "gallery",
    layout: "wide",
    presentation,
    heading: {
      ...(intent.eyebrow ? { eyebrow: intent.eyebrow.slice(0, 60) } : {}),
      title: (intent.title ?? "Gallery").slice(0, 80)
    },
    items,
    captions: [],
    framing: {}
  } as unknown as Section;
};

/**
 * Build a booking section.
 *
 * The section carries no times and no availability — the renderer draws the
 * shell and the runtime panel asks the canonical engine. So there is nothing
 * here to get wrong except the shape, which is why it can be built outright.
 */
export const buildBookingSection = (spec: SiteSpec, intent: InsertSectionIntent): Section =>
  ({
    id: nextSectionId(spec, "booking"),
    type: "booking",
    layout: "wide",
    presentation: intent.presentation,
    heading: {
      ...(intent.eyebrow ? { eyebrow: intent.eyebrow.slice(0, 60) } : {}),
      title: (intent.title ?? "Book an appointment").slice(0, 80)
    },
    cta: { label: "Book now", target: { kind: "booking" } },
    framing: {}
  }) as unknown as Section;

/**
 * Re-derive a gallery's tiles for a new presentation.
 *
 * A gallery's tile count is a property of its presentation, not a free choice —
 * `mosaic` is six tiles and `duo` is two, and a grid with the wrong number of
 * them has a hole in it. Changing only the enum therefore produced a section the
 * validator refused, and an owner asking for a carousel got "that change would
 * have left the site in a state I can't render", which is true and useless.
 *
 * So the presentation change goes back through the same construction rule that
 * built the section:
 *
 *  · bound images are kept, in order, as far as the new count allows
 *  · growing fills the rest deterministically, exactly as a fresh gallery would
 *  · shrinking drops the trailing tiles — and drops only the tile. The asset row
 *    is untouched, so the picture is still in the library and can come back.
 */
export const withGalleryPresentation = (
  section: Section,
  presentation: GalleryPresentation
): Section => {
  const current = ((section as any).items ?? []) as Array<Record<string, unknown>>;
  const target = GALLERY_TILE_COUNT[presentation];

  const items = Array.from({ length: target }, (_, index) => {
    const existing = current[index];
    if (existing) return existing;
    return { kind: "generated" as const, seed: index % 64 };
  });

  return { ...(section as any), presentation, items } as unknown as Section;
};

export type InsertSectionResult =
  | { ok: true; spec: SiteSpec; sectionId: string }
  | { ok: false; reason: "unsupported_section" | "duplicate_section" | "too_many_sections" };

/** Maximum sections a page may carry, matching the reorder operation's bound. */
export const MAX_SECTIONS = 14;

/**
 * Insert a factory-built section into a spec.
 *
 * Returns a NEW spec; the caller validates it exactly as it validates every
 * other operation's result, so an insertion has no privileged path.
 */
export const insertSection = (
  spec: SiteSpec,
  intent: InsertSectionIntent,
  assets: AssetChoice[] = []
): InsertSectionResult => {
  if (!(INSERTABLE_SECTIONS as readonly string[]).includes(intent.section)) {
    return { ok: false, reason: "unsupported_section" };
  }
  if (spec.sections.length >= MAX_SECTIONS) {
    return { ok: false, reason: "too_many_sections" };
  }
  // One gallery is a gallery; two is a mistake nobody asked for.
  if (spec.sections.some((section) => section.type === intent.section)) {
    return { ok: false, reason: "duplicate_section" };
  }

  const section =
    intent.section === "booking"
      ? buildBookingSection(spec, intent)
      : buildGallerySection(spec, intent, assets);
  const index = resolveInsertIndex(spec, intent.placement);
  const sections = [...spec.sections];
  sections.splice(index, 0, section);

  return { ok: true, spec: { ...spec, sections } as SiteSpec, sectionId: section.id };
};
