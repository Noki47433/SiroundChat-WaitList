/**
 * What the model says should be observably true afterwards — and the code that
 * checks it.
 *
 * Stage 3F.2 added one check of this kind, for one word: if an owner asked for
 * something "shorter" and the result was not shorter, the edit went back through
 * the bounded repair and then, failing that, was refused. It worked, and it did
 * not generalise, because it was keyed off a keyword. Stage 3G and 3G.1 then
 * found the same shape of failure in requests that keyword never saw: "columns"
 * moved a layout, "side by side" moved a presentation, a heading weight was
 * never reached at all.
 *
 * So the model now states, in a closed vocabulary, what should be true of the
 * SITE once its operations are applied, and this file checks those statements
 * against the before and after specs. The rules that follow from that:
 *
 *   · the model cannot invent a check — every one is a variant of the union
 *     below, and anything it cannot express it simply cannot assert;
 *   · a check can only ever REFUSE an edit. It never relaxes validation, never
 *     authorises an operation, and never reaches the owner's reply;
 *   · a failed check is fed back once, with what was actually observed, through
 *     the same bounded repair the applier failures use; a second failure is an
 *     honest refusal with nothing saved.
 *
 * Every expectation is evaluated in code against the stored spec. The model's
 * prose is never the definition of success.
 */
import { readToken } from "@/lib/site-spec/ai/edit";
import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";
import { CopyTargetSchema, TOKEN_PATHS, type TokenPath } from "@/lib/site-spec/ops";
import { SECTION_LAYOUTS, type SectionLayout } from "@/lib/site-spec/vocabulary";
import type { SiteSpec } from "@/lib/site-spec/schema";

/** The closed set of things the model may claim will be true. */
export type Expectation =
  | { check: "token_equals"; path: TokenPath; value: string }
  | { check: "token_increases"; path: TokenPath }
  | { check: "token_decreases"; path: TokenPath }
  | { check: "section_layout"; sectionId: string; layout: SectionLayout }
  | { check: "section_presentation"; sectionId: string; presentation: string }
  | { check: "section_before"; sectionId: string; otherSectionId: string }
  | { check: "section_last"; sectionId: string }
  | { check: "text_shorter"; what: TextTarget }
  | { check: "text_changed"; what: TextTarget }
  | { check: "text_on_page"; words: string }
  | { check: "menu_includes"; sectionId: string }
  | { check: "menu_excludes"; sectionId: string }
  | { check: "menu_length"; count: number }
  | { check: "photo_changed"; where: "hero" | "gallery" }
  | { check: "photo_is_generated"; where: "hero" }
  | { check: "gallery_photo_count_decreases" }
  | { check: "gallery_every_photo_captioned" }
  | { check: "terminology_says"; key: string; words: string }
  /**
   * Stage 3G.3. "Nothing needs to change, and here is the request I read that
   * way." Without it the vocabulary could only describe MOVEMENT, which put it
   * in direct contradiction with the already-true rule: that rule tells the
   * model to answer a request the site already satisfies by proposing the
   * operation with the value it already has, and no movement check can hold for
   * an operation like that. Stage 3G.2 refused four correct no-ops on exactly
   * that contradiction.
   */
  | { check: "already_satisfied" };

/** The pieces of text an expectation can be about. Closed, like everything else. */
export type TextTarget =
  | { field: "hero.headline" }
  | { field: "hero.body" }
  | { field: "hero.eyebrow" }
  | { field: "hero.primaryCta" }
  | { field: "nav.cta" }
  | { field: "footer.note" }
  | { field: "seo.title" }
  | { field: "seo.description" }
  | { field: "section.title"; sectionId: string }
  | { field: "section.sub"; sectionId: string }
  | { field: "section.cta"; sectionId: string };

export type ExpectationFailure = { expectation: Expectation; observed: string };

// ── reading the spec ──────────────────────────────────────────────────────────

const sections = (spec: SiteSpec) => spec.sections as unknown as Array<Record<string, any>>;
const byId = (spec: SiteSpec, id: string) => sections(spec).find((section) => section.id === id);
const indexOf = (spec: SiteSpec, id: string) => sections(spec).findIndex((section) => section.id === id);
const hero = (spec: SiteSpec) => sections(spec).find((section) => section.type === "hero");
const gallery = (spec: SiteSpec) => sections(spec).find((section) => section.type === "gallery");

const readText = (spec: SiteSpec, target: TextTarget): string | undefined => {
  const value = (() => {
    switch (target.field) {
      case "hero.headline":
        return hero(spec)?.headline;
      case "hero.body":
        return hero(spec)?.body;
      case "hero.eyebrow":
        return hero(spec)?.eyebrow;
      case "hero.primaryCta":
        return hero(spec)?.primaryCta?.label;
      case "nav.cta":
        return spec.nav.cta?.label;
      case "footer.note":
        return spec.footer?.note;
      case "seo.title":
        return spec.meta?.seo?.title;
      case "seo.description":
        return spec.meta?.seo?.description;
      case "section.title":
        return byId(spec, target.sectionId)?.heading?.title;
      case "section.sub":
        return byId(spec, target.sectionId)?.heading?.sub;
      case "section.cta":
        return byId(spec, target.sectionId)?.cta?.label;
      default:
        return undefined;
    }
  })();
  return typeof value === "string" ? value : undefined;
};

const describeTarget = (target: TextTarget): string =>
  "sectionId" in target ? `${target.field} of ${target.sectionId}` : target.field;

/** Everything a visitor could read, for a claim the owner asked to appear. */
const wordsOnPage = (spec: SiteSpec): string => {
  const out: string[] = [];
  const skip = new Set(["id", "kind", "type", "assetId", "presentation", "layout", "variant", "target"]);
  const walk = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if (!skip.has(String(key))) out.push(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach((entry) => walk(entry));
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, k);
    }
  };
  walk(spec.sections);
  walk(spec.footer);
  walk(spec.meta?.seo);
  return out.join(" • ").toLowerCase();
};

const photoIdentity = (media: any): string =>
  media ? (media.kind === "asset" ? `asset:${media.assetId}` : `generated:${media.seed}`) : "(none)";

// ── checking one expectation ──────────────────────────────────────────────────

const evaluate = (expectation: Expectation, before: SiteSpec, after: SiteSpec): { held: boolean; observed: string } => {
  switch (expectation.check) {
    case "token_equals": {
      const value = readToken(after, expectation.path);
      return { held: String(value) === expectation.value, observed: `${expectation.path} is ${String(value)}` };
    }
    case "token_increases":
    case "token_decreases": {
      const from = Number(readToken(before, expectation.path));
      const to = Number(readToken(after, expectation.path));
      const held = expectation.check === "token_increases" ? to > from : to < from;
      return { held, observed: `${expectation.path} went ${from} → ${to}` };
    }
    case "section_layout": {
      const section = byId(after, expectation.sectionId);
      return { held: section?.layout === expectation.layout, observed: `${expectation.sectionId} layout is ${section?.layout ?? "(no such section)"}` };
    }
    case "section_presentation": {
      const section = byId(after, expectation.sectionId);
      return {
        held: String(section?.presentation) === expectation.presentation,
        observed: `${expectation.sectionId} presentation is ${section?.presentation ?? "(no such section)"}`
      };
    }
    case "section_before": {
      const a = indexOf(after, expectation.sectionId);
      const b = indexOf(after, expectation.otherSectionId);
      return { held: a !== -1 && b !== -1 && a < b, observed: `${expectation.sectionId} is at ${a}, ${expectation.otherSectionId} at ${b}` };
    }
    case "section_last": {
      const list = sections(after);
      return { held: list.length > 0 && list[list.length - 1]?.id === expectation.sectionId, observed: `the last section is ${list[list.length - 1]?.id}` };
    }
    case "text_shorter": {
      const from = readText(before, expectation.what) ?? "";
      const to = readText(after, expectation.what) ?? "";
      return { held: to.length > 0 && to.length < from.length, observed: `${describeTarget(expectation.what)} went ${from.length} → ${to.length} characters` };
    }
    case "text_changed": {
      const from = readText(before, expectation.what);
      const to = readText(after, expectation.what);
      return { held: Boolean(to && to.trim()) && to !== from, observed: `${describeTarget(expectation.what)} ${to === from ? "did not change" : "changed"}` };
    }
    case "text_on_page": {
      const words = expectation.words.trim().toLowerCase();
      const held = words.length > 0 && wordsOnPage(after).includes(words);
      return { held, observed: held ? `"${expectation.words}" is on the page` : `"${expectation.words}" is not on the page` };
    }
    case "menu_includes":
      return { held: after.nav.items.includes(expectation.sectionId), observed: `the menu is ${JSON.stringify(after.nav.items)}` };
    case "menu_excludes":
      return { held: !after.nav.items.includes(expectation.sectionId), observed: `the menu is ${JSON.stringify(after.nav.items)}` };
    case "menu_length":
      return { held: after.nav.items.length === expectation.count, observed: `the menu has ${after.nav.items.length} links` };
    case "photo_changed": {
      if (expectation.where === "hero") {
        const from = photoIdentity(hero(before)?.media);
        const to = photoIdentity(hero(after)?.media);
        return { held: from !== to, observed: `the hero photo went ${from} → ${to}` };
      }
      const from = JSON.stringify(gallery(before)?.items ?? []);
      const to = JSON.stringify(gallery(after)?.items ?? []);
      return { held: from !== to, observed: to === from ? "the gallery photos did not change" : "the gallery photos changed" };
    }
    case "photo_is_generated": {
      const media = hero(after)?.media;
      return { held: media?.kind === "generated", observed: `the hero photo is ${photoIdentity(media)}` };
    }
    case "gallery_photo_count_decreases": {
      const from = (gallery(before)?.items ?? []).length;
      const to = (gallery(after)?.items ?? []).length;
      return { held: to < from, observed: `the gallery went from ${from} to ${to} photos` };
    }
    case "gallery_every_photo_captioned": {
      const section = gallery(after);
      const items: unknown[] = section?.items ?? [];
      const captions: unknown[] = section?.captions ?? [];
      const filled = captions.filter((caption) => typeof caption === "string" && caption.trim().length > 0).length;
      return { held: items.length > 0 && filled === items.length, observed: `${filled} of ${items.length} photos have a caption` };
    }
    case "already_satisfied":
      return {
        held: semanticFingerprint(before) === semanticFingerprint(after),
        observed: semanticFingerprint(before) === semanticFingerprint(after) ? "the site did not change" : "the site changed"
      };
    case "terminology_says": {
      const value = String((after.terminology as unknown as Record<string, string>)[expectation.key] ?? "");
      return {
        held: value.toLowerCase().includes(expectation.words.trim().toLowerCase()),
        observed: `"${expectation.key}" is ${JSON.stringify(value)}`
      };
    }
    default:
      return { held: true, observed: "no check" };
  }
};

/**
 * A claim may only name something the product can actually write.
 *
 * Suite #4 asked for a line in the footer, the model promised the footer note
 * would change, and no operation in the vocabulary could write that field — so
 * the promise was unkeepable before it was made. A field that can be asserted
 * but not written is the same defect as a control that can be written but not
 * seen, and this is the half of it that lives here.
 */
const WRITABLE_TEXT_FIELDS: ReadonlySet<string> = new Set(
  (CopyTargetSchema.options as ReadonlyArray<{ shape: { field: { value: string } } }>).map((o) => o.shape.field.value)
);

export const isWritableTextField = (field: string): boolean => WRITABLE_TEXT_FIELDS.has(field);

/** An expectation about a control or section that does not exist is not checkable. */
const isMeaningful = (expectation: Expectation, spec: SiteSpec): boolean => {
  switch (expectation.check) {
    case "token_equals":
    case "token_increases":
    case "token_decreases":
      return (TOKEN_PATHS as readonly string[]).includes(expectation.path);
    case "text_shorter":
    case "text_changed":
      return isWritableTextField(expectation.what.field);
    case "section_layout":
      return Boolean(byId(spec, expectation.sectionId)) && (SECTION_LAYOUTS as readonly string[]).includes(expectation.layout);
    case "section_presentation":
    case "section_before":
    case "section_last":
    case "menu_includes":
    case "menu_excludes":
      return true;
    default:
      return true;
  }
};

/**
 * Check every expectation against what actually happened.
 *
 * Returns the ones that did not hold, with what was observed instead — which is
 * exactly what the repair needs to be told, and what the log records.
 */
export const checkExpectations = (
  expectations: Expectation[],
  before: SiteSpec,
  after: SiteSpec
): ExpectationFailure[] => {
  /**
   * A site that did not move is the no-op guard's business, not this one.
   *
   * The already-true rule asks the model to express "it is already like that" as
   * the operation with the current value. Applying that changes nothing, so a
   * claim that something moved cannot hold — and Stage 3G.2 turned four correct
   * no-ops into refusals by treating that as a broken promise. It is not a
   * broken promise; it is a request that needed no work, and the guard that
   * compares before with after already says so truthfully, in the owner's words.
   *
   * So when nothing moved, only a claim ABOUT nothing moving is checked.
   */
  const stillTheSame = semanticFingerprint(before) === semanticFingerprint(after);
  const failures: ExpectationFailure[] = [];
  for (const expectation of expectations) {
    if (stillTheSame && expectation.check !== "already_satisfied") continue;
    if (!isMeaningful(expectation, after)) continue;
    const { held, observed } = evaluate(expectation, before, after);
    if (!held) failures.push({ expectation, observed });
  }
  return failures;
};

/**
 * What the LOG is told. Diagnostics reach an operator, so they carry the shape of
 * the failure and nothing an owner wrote: the check that failed and the section
 * or control it was about, never the words, the copy or the request.
 */
export const summariseExpectationFailures = (failures: ExpectationFailure[]): string =>
  failures
    .map(({ expectation }) => {
      const where =
        "sectionId" in expectation
          ? expectation.sectionId
          : "path" in expectation
            ? expectation.path
            : "what" in expectation
              ? describeTarget(expectation.what)
              : "where" in expectation
                ? expectation.where
                : "";
      return where ? `${expectation.check}(${where})` : expectation.check;
    })
    .join(", ");

/**
 * What the repair is told: the claim, what the site actually shows, and — where
 * there is one — the operation that would have kept the promise.
 *
 * A bare "that did not come true" left the model to guess which half of its own
 * answer was wrong, and in the Stage 3G.3 regression it guessed the same way
 * twice. Naming the field is not telling it what to do; it is telling it what it
 * already said it would do.
 */
const howToKeepIt = (expectation: Expectation): string => {
  switch (expectation.check) {
    case "text_shorter":
    case "text_changed":
      return ` — to change that text, use set_copy on "${expectation.what.field}"${
        "sectionId" in expectation.what ? ` with sectionId "${expectation.what.sectionId}"` : ""
      }, or state a claim about the field you actually changed`;
    case "already_satisfied":
      return " — either return the operation with the value the site already has, or drop that claim and make the change";
    case "section_layout":
      return ` — set_layout on "${expectation.sectionId}" changes that`;
    case "section_presentation":
      return ` — set_presentation on "${expectation.sectionId}" changes that`;
    default:
      return "";
  }
};

export const describeExpectationFailures = (failures: ExpectationFailure[]): string =>
  failures
    .map(
      ({ expectation, observed }) =>
        `you said ${JSON.stringify(expectation)} would be true, but ${observed}${howToKeepIt(expectation)}`
    )
    .join("; ");
