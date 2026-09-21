/**
 * What the owner is told, written from what actually happened to their site.
 *
 * Until Stage 3F.2 the reply after an edit was `describeOps(operations)` — the
 * name of the operation the model proposed. That is why an owner could be told
 * "Changed the navPosition." (an internal field name) and "Reordered the page."
 * (when the order was identical). The reply described the intent; this describes
 * the result.
 *
 * Two entry points, one for each outcome the no-op guard can reach:
 *
 *   describeObservedChange(before, after)  — the website moved; say how, by
 *                                            comparing the two specs
 *   describeUnchanged(ops, spec)           — nothing moved; say that the site
 *                                            already looks that way, in terms
 *                                            of the CURRENT value, and that it
 *                                            was left alone
 *
 * Every phrase is written here, in code. No model text, token path, section id
 * or operation name can reach an owner through this file — the phrases name
 * sections by the owner's own terminology or by a plain type label.
 */
import type { AlreadyTrueFact } from "@/lib/site-spec/ai/edit";
import type { SiteSpecOp } from "@/lib/site-spec/ops";
import { SiteSpecSchema, type Section, type SiteSpec } from "@/lib/site-spec/schema";
import { TYPE_SCALES, DENSITIES } from "@/lib/site-spec/vocabulary";

// ─────────────────────────────────────────────────────────────────────────────
// Words
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Section["type"], string> = {
  hero: "top",
  bookingStrip: "booking banner",
  services: "services",
  gallery: "gallery",
  story: "about",
  team: "team",
  hours: "opening hours",
  booking: "booking",
  enquiry: "enquiry",
  reviews: "reviews",
  contact: "contact"
};

const TERMINOLOGY_FOR: Partial<Record<Section["type"], keyof SiteSpec["terminology"]>> = {
  services: "services",
  gallery: "gallery",
  story: "story",
  team: "team",
  hours: "hours",
  reviews: "reviews",
  contact: "contact"
};

/** The owner's own word for a section where they have one, else a plain label. */
const sectionLabel = (spec: SiteSpec, section: Section): string => {
  const key = TERMINOLOGY_FOR[section.type];
  const own = key ? spec.terminology?.[key] : undefined;
  return (typeof own === "string" && own.trim() ? own.trim() : TYPE_LABEL[section.type]).toLowerCase();
};

const FONT_PHRASE: Record<string, string> = {
  system: "a plain modern sans-serif",
  "system-display": "a bold modern sans-serif",
  grotesk: "a clean, modern sans-serif",
  humanist: "a warm, friendly sans-serif",
  serif: "a traditional serif",
  "serif-display": "a classic display serif",
  mono: "a monospaced typeface"
};
const font = (id: unknown) => FONT_PHRASE[String(id)] ?? "a different typeface";

const LAYOUT_PHRASE: Record<string, string> = {
  wide: "full width",
  flush: "full width",
  stack: "stacked",
  split: "side by side",
  centered: "centred",
  edge: "laid out with a large heading beside it"
};

const PRESENTATION_PHRASE: Record<string, string> = {
  mosaic: "a mosaic",
  portfolio: "a portfolio",
  filmstrip: "a filmstrip",
  duo: "two large images",
  rows: "a list",
  cards: "cards",
  editorial: "an editorial layout",
  packages: "packages",
  pullquote: "a pull quote",
  column: "a column of text",
  overlay: "photos with names over them",
  plain: "a simple list",
  strip: "a strip",
  card: "a card",
  cols: "columns",
  panel: "a panel",
  invert: "a dark panel",
  list: "a list",
  empty: "a placeholder",
  center: "a centred block",
  stack: "a stack"
};

const SCALE_STATE: Record<string, string> = {
  smaller: "on the smaller setting",
  default: "at their normal size",
  larger: "on the larger setting",
  largest: "at the largest size there is"
};

const rank = (ladder: readonly string[], value: unknown, fallback: string) => {
  const found = ladder.indexOf(String(value ?? fallback));
  return found === -1 ? ladder.indexOf(fallback) : found;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Both sides through the schema first, so a default the parser fills in on one
 * side and not the other is never mistaken for a change. The same reason the
 * semantic fingerprint parses before it hashes.
 */
const normalise = (spec: SiteSpec): SiteSpec => {
  const parsed = SiteSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : spec;
};
const quote = (value: unknown) => (typeof value === "string" && value.length <= 40 ? `"${value}"` : null);

// ─────────────────────────────────────────────────────────────────────────────
// A change that happened
// ─────────────────────────────────────────────────────────────────────────────

const designPhrases = (a: SiteSpec, b: SiteSpec): string[] => {
  const out: string[] = [];
  const ta = a.design.typography as any;
  const tb = b.design.typography as any;

  for (const [key, what] of [
    ["headingScale", "headings"],
    ["bodyScale", "body text"]
  ] as const) {
    const from = rank(TYPE_SCALES, ta[key], "default");
    const to = rank(TYPE_SCALES, tb[key], "default");
    if (from === to) continue;
    if (tb[key] === "default" || (tb[key] == null && ta[key] != null)) out.push(`Put the ${what} back to their normal size`);
    else if (to > from) out.push(`Made the ${what} ${tb[key] === "largest" ? "as large as they go" : "larger"}`);
    else out.push(`Made the ${what} smaller`);
  }
  if (ta.display !== tb.display) out.push(`Switched the headings to ${font(tb.display)}`);
  if (ta.body !== tb.body) out.push(`Switched the body text to ${font(tb.body)}`);
  if (["displayWeight", "heroWeight", "tracking", "measure"].some((k) => ta[k] !== tb[k])) {
    out.push("Adjusted the typography");
  }

  const da = rank(DENSITIES, a.design.density, "regular");
  const db = rank(DENSITIES, b.design.density, "regular");
  if (db > da) out.push("Gave the page more breathing room");
  if (db < da) out.push("Tightened the spacing");

  const ga = a.design.geometry as any;
  const gb = b.design.geometry as any;
  if (gb.sectionPad > ga.sectionPad) out.push("Added more space between sections");
  if (gb.sectionPad < ga.sectionPad) out.push("Reduced the space between sections");
  if (gb.radius > ga.radius || (gb.radius === ga.radius && gb.radiusLg > ga.radiusLg)) {
    out.push("Rounded the corners of cards and images");
  } else if (gb.radius < ga.radius || (gb.radius === ga.radius && gb.radiusLg < ga.radiusLg)) {
    out.push("Made the corners of cards and images sharper");
  }
  if (["sectionPadX", "gap", "colGap", "rule"].some((k) => ga[k] !== gb[k])) out.push("Adjusted the proportions of the page");

  const ca = a.design.chrome;
  const cb = b.design.chrome;
  if (ca.cta !== cb.cta) {
    out.push(
      cb.cta === "pill"
        ? "Gave the buttons fully rounded ends"
        : cb.cta === "square"
          ? "Made the buttons square"
          : "Turned the buttons into underlined links"
    );
  }
  if (ca.navPosition !== cb.navPosition) {
    out.push(cb.navPosition === "center" ? "Centred the menu links in the header" : "Moved the menu links to the side of the header");
  }
  if (ca.nav !== cb.nav) out.push("Changed the style of the menu links");
  if (ca.eyebrow !== cb.eyebrow) out.push("Changed the style of the small labels above headings");

  if (a.design.art?.treatment !== b.design.art?.treatment) out.push("Changed the photo style");

  const pa = a.design.palette as any;
  const pb = b.design.palette as any;
  const named: string[] = [];
  if (pa.background !== pb.background) named.push("background");
  if (pa.ink !== pb.ink) named.push("text");
  if (pa.accent !== pb.accent) named.push("accent");
  const otherColours = ["muted", "accentInk", "line", "soft", "panel"].some((k) => pa[k] !== pb[k]);
  if (named.length === 1) out.push(`Changed the ${named[0]} colour`);
  else if (named.length > 1) out.push(`Changed the ${named.slice(0, -1).join(", ")} and ${named[named.length - 1]} colours`);
  else if (otherColours) out.push("Adjusted the colour palette");

  if (!same((a.design as any).hero, (b.design as any).hero)) out.push("Adjusted the size of the top of the page");
  return out;
};

const heroPhrases = (a: any, b: any): string[] => {
  const out: string[] = [];
  if (!same(a.headline, b.headline)) out.push("Rewrote the headline");
  if (!same(a.body, b.body)) out.push("Rewrote the intro text");
  if (!same(a.eyebrow, b.eyebrow)) {
    out.push(!a.eyebrow ? "Added a line above the headline" : !b.eyebrow ? "Removed the line above the headline" : "Rewrote the line above the headline");
  }
  if (!same(a.primaryCta?.label, b.primaryCta?.label)) {
    const label = quote(b.primaryCta?.label);
    out.push(label ? `Changed the main button to say ${label}` : "Changed the main button's wording");
  }
  if (!same(a.secondaryCta, b.secondaryCta)) out.push("Changed the second button");
  const identity = (media: any) => (media?.kind === "asset" ? `asset:${media.assetId}` : `generated:${media?.seed}`);
  if (identity(a.media) !== identity(b.media)) out.push("Changed the picture at the top of the page");
  else if (!same(a.media, b.media)) out.push("Updated the description of the picture at the top of the page");
  if (a.variant !== b.variant) out.push("Changed the layout of the top of the page");
  if (!same(a.bandCaption, b.bandCaption) || a.accentRule !== b.accentRule) out.push("Adjusted the top of the page");
  return out;
};

const sectionPhrases = (spec: SiteSpec, a: any, b: any): string[] => {
  if (a.type === "hero") return heroPhrases(a, b);
  const out: string[] = [];
  const label = sectionLabel(spec, b);
  if ("layout" in b && a.layout !== b.layout) out.push(`Made the ${label} section ${LAYOUT_PHRASE[b.layout] ?? "use a different layout"}`);
  if ("presentation" in b && a.presentation !== b.presentation) {
    out.push(`Changed the ${label} to ${PRESENTATION_PHRASE[b.presentation] ?? "a different layout"}`);
  }
  if (!same(a.heading?.title, b.heading?.title)) {
    const title = quote(b.heading?.title);
    out.push(title ? `Changed the ${label} heading to ${title}` : `Rewrote the ${label} heading`);
  }
  if (!same(a.heading?.eyebrow, b.heading?.eyebrow) || !same(a.heading?.sub, b.heading?.sub)) {
    out.push(`Rewrote the text under the ${label} heading`);
  }
  if (a.type === "gallery" && !same(a.items, b.items)) out.push("Changed the photos in the gallery");
  if (a.type === "gallery" && !same(a.captions, b.captions)) out.push("Updated the gallery captions");

  // Anything else in the section: said generally rather than not at all.
  const rest = (s: any) => {
    const { layout, presentation, heading, items, captions, ...other } = s;
    return other;
  };
  if (!out.length && !same(rest(a), rest(b))) out.push(`Rewrote the text in the ${label} section`);
  else if (out.length && !same(rest(a), rest(b))) out.push(`Updated the ${label} section`);
  return out;
};

const orderPhrases = (spec: SiteSpec, a: SiteSpec, b: SiteSpec): string[] => {
  const ids = new Set(b.sections.map((s) => s.id));
  const before = a.sections.map((s) => s.id).filter((id) => ids.has(id));
  const beforeIds = new Set(before);
  const after = b.sections.map((s) => s.id).filter((id) => beforeIds.has(id));
  if (same(before, after)) return [];

  // One section moved? Then name it, and where it went. A swap of neighbours
  // has two true single-move readings — A went up, or B went down — and owners
  // ask for things to go up ("move the booking higher"), so the one that rose
  // is the one named.
  const candidates = before.filter((id) => {
    const without = (list: string[]) => list.filter((x) => x !== id);
    return same(without(before), without(after));
  });
  const rose = candidates.find((id) => after.indexOf(id) < before.indexOf(id));
  for (const id of rose ? [rose] : candidates.slice(0, 1)) {
    const section = b.sections.find((s) => s.id === id)!;
    const at = after.indexOf(id);
    const next = after[at + 1] ? b.sections.find((s) => s.id === after[at + 1]) : undefined;
    const label = sectionLabel(spec, section);
    if (next) return [`Moved the ${label} section above the ${sectionLabel(spec, next)} section`];
    return [`Moved the ${label} section to the bottom of the page`];
  }
  return ["Rearranged the order of the sections"];
};

/** One sentence, from the difference between two specs. */
export const describeObservedChange = (beforeRaw: SiteSpec, afterRaw: SiteSpec): string => {
  const before = normalise(beforeRaw);
  const after = normalise(afterRaw);
  const phrases: string[] = [];

  const beforeIds = new Set(before.sections.map((s) => s.id));
  const afterIds = new Set(after.sections.map((s) => s.id));
  for (const section of after.sections) {
    if (!beforeIds.has(section.id)) {
      const label = sectionLabel(after, section);
      phrases.push(`Added ${/^[aeiou]/.test(label) ? "an" : "a"} ${label} section`);
    }
  }
  for (const section of before.sections) {
    if (!afterIds.has(section.id)) phrases.push(`Removed the ${sectionLabel(before, section)} section`);
  }

  phrases.push(...orderPhrases(after, before, after));

  for (const b of after.sections) {
    const a = before.sections.find((s) => s.id === b.id);
    if (a && !same(a, b)) phrases.push(...sectionPhrases(after, a, b));
  }

  phrases.push(...designPhrases(before, after));

  for (const key of Object.keys(after.terminology) as Array<keyof SiteSpec["terminology"]>) {
    const from = before.terminology[key];
    const to = after.terminology[key];
    if (from !== to) phrases.push(`Changed "${from}" to "${to}" across the site`);
  }

  if (!same(before.nav.items, after.nav.items)) {
    const added = after.nav.items.filter((id) => !before.nav.items.includes(id));
    const removed = before.nav.items.filter((id) => !after.nav.items.includes(id));
    const name = (id: string) => {
      const section = after.sections.find((s) => s.id === id) ?? before.sections.find((s) => s.id === id);
      return section ? `the ${sectionLabel(after, section)}` : "a section";
    };
    if (added.length) phrases.push(`Added ${added.map(name).join(" and ")} to the menu`);
    if (removed.length) phrases.push(`Took ${removed.map(name).join(" and ")} out of the menu`);
    if (!added.length && !removed.length) phrases.push("Reordered the menu");
  }
  if (!same(before.nav.cta, after.nav.cta)) {
    const label = quote(after.nav.cta?.label);
    phrases.push(label ? `Changed the menu button to say ${label}` : "Changed the menu button");
  }

  if (before.footer.presentation !== after.footer.presentation) {
    phrases.push(after.footer.presentation === "minimal" ? "Simplified the footer" : "Changed the footer style");
  }
  if (!same(before.footer.ctaHeadline, after.footer.ctaHeadline) || !same(before.footer.note, after.footer.note)) {
    phrases.push("Updated the footer text");
  }

  if (!same(before.meta.seo, after.meta.seo)) phrases.push("Updated how the page appears in search results");
  if (!same(before.meta.brandName, after.meta.brandName) || !same(before.meta.brandMark, after.meta.brandMark)) {
    phrases.push("Changed the name shown on the site");
  }
  if (!same(before.socials, after.socials)) phrases.push("Updated the social links");

  const unique = [...new Set(phrases)];
  if (!unique.length) return "Updated your site.";
  const lowerFirst = (phrase: string) => phrase.charAt(0).toLowerCase() + phrase.slice(1);
  if (unique.length === 1) return `${unique[0]}.`;
  if (unique.length <= 3) {
    return `${unique[0]}${unique.slice(1, -1).map((p) => `, ${lowerFirst(p)}`).join("")} and ${lowerFirst(unique[unique.length - 1])}.`;
  }
  const others = unique.length - 2;
  return `${unique[0]}, ${lowerFirst(unique[1])}, and made ${others} other change${others > 1 ? "s" : ""}.`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Nothing happened — say so, and why
// ─────────────────────────────────────────────────────────────────────────────

const tokenAlready = (op: Extract<SiteSpecOp, { op: "set_token" }>, spec: SiteSpec): string => {
  const t = spec.design.typography as any;
  switch (op.path) {
    case "typography.headingScale":
      return `Your headings are already ${SCALE_STATE[String(t.headingScale ?? "default")] ?? "at that size"}`;
    case "typography.bodyScale":
      return `Your body text is already ${SCALE_STATE[String(t.bodyScale ?? "default")] ?? "at that size"}`;
    case "typography.display":
      return `Your headings already use ${font(t.display)}`;
    case "typography.body":
      return `Your body text already uses ${font(t.body)}`;
    case "density":
      return spec.design.density === "spacious"
        ? "Your page is already on the most spacious setting"
        : `Your page already uses that spacing`;
    case "geometry.sectionPad":
      return "The space between sections is already set that way";
    case "geometry.radius":
    case "geometry.radiusLg":
      return "The corners of cards and images are already rounded that much";
    case "chrome.cta":
      return spec.design.chrome.cta === "pill"
        ? "Your buttons are already fully rounded"
        : spec.design.chrome.cta === "square"
          ? "Your buttons are already square"
          : "Your buttons are already underlined links";
    case "chrome.navPosition":
      return spec.design.chrome.navPosition === "center"
        ? "Your menu links are already centred in the header"
        : "Your menu links already sit at the sides of the header";
    case "chrome.nav":
      return "Your menu links already have that style";
    case "chrome.eyebrow":
      return "The small labels above your headings already have that style";
    case "art.treatment":
      return "Your photos already have that style";
    case "palette.background":
      return "Your background is already that colour";
    case "palette.ink":
      return "Your text is already that colour";
    case "palette.accent":
      return "Your accent colour is already that colour";
    default:
      return op.path.startsWith("palette.")
        ? "Your colours are already set that way"
        : "That part of your design is already set that way";
  }
};

const opAlready = (op: SiteSpecOp, spec: SiteSpec): string => {
  const section = "sectionId" in op ? spec.sections.find((s) => s.id === (op as any).sectionId) : undefined;
  const label = section ? sectionLabel(spec, section) : "that";
  switch (op.op) {
    case "set_token":
      return tokenAlready(op, spec);
    case "set_layout":
      return `The ${label} section is already ${LAYOUT_PHRASE[(section as any)?.layout] ?? "laid out that way"}`;
    case "set_presentation":
      return `Your ${label} is already shown as ${PRESENTATION_PHRASE[(section as any)?.presentation] ?? "that"}`;
    case "reorder_sections":
      return "Your sections are already in that order";
    case "bind_asset":
      return op.slot.kind === "hero" ? "That photo is already the picture at the top of your page" : "That photo is already in place";
    case "set_copy":
      return "That text already says that";
    case "set_terminology":
      return `Your site already says ${quote(op.value) ?? "that"}`;
    case "set_nav":
      return "Your menu already links to those sections";
    case "set_footer":
      return spec.footer.presentation === "minimal" ? "Your footer is already as simple as it gets" : "Your footer is already set up that way";
    default:
      return "Your site already looks that way";
  }
};

/** One sentence for a request the site already satisfies. Always contains "already". */
export const describeUnchanged = (ops: SiteSpecOp[], specRaw: SiteSpec): string => {
  const spec = normalise(specRaw);
  const clauses = [...new Set(ops.map((op) => opAlready(op, spec)))];
  const said =
    clauses.length === 1
      ? clauses[0]
      : `${clauses[0]}, and ${clauses[1].charAt(0).toLowerCase()}${clauses[1].slice(1)}`;
  return `${said}, so I left the site as it is.`;
};

/** Code-owned answers for requests that are true of every site. */
export const ALREADY_TRUE_REPLIES: Record<AlreadyTrueFact, string> = {
  menu_at_top:
    "Your menu is already at the top of every page, in the header, so I left the site as it is. If you'd like the links centred in the header, just say so."
};
