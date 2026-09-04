/**
 * Operation authorization — the boundary between presentation and operational truth.
 *
 * `applyOps` decides whether an operation is *structurally* possible. This
 * module decides whether it is *allowed*, which is a different question and the
 * one the audit cared about: the website must not become a second place where
 * prices, durations, opening hours and contact details are edited.
 *
 * The rule the mission locks:
 *
 *   > "Change haircut to EUR 4" must be rejected as a website edit if the
 *   > canonical service price is EUR 8. Operational truth belongs in Business.
 *
 * So a copy edit that asserts an operational fact is checked against canonical
 * Business data. If it agrees, it is allowed and flagged as something that will
 * go stale. If it disagrees, it is refused and the owner is routed to Business
 * rather than being quietly given what they asked for.
 *
 * This runs on every edit — model-authored or not.
 */
import type { BusinessPayload } from "@/lib/business/load";
import { formatDuration, formatServicePrice } from "@/lib/site-spec/resolve";
import type { SiteSpec } from "@/lib/site-spec/schema";
import type { SiteSpecOp } from "@/lib/site-spec/ops";

export type RejectionReason =
  /** The edit asserts a price, duration, opening time or contact detail. */
  | "operational_fact"
  /** The edit names something that does not exist on this site. */
  | "unknown_target"
  /** The edit is structurally possible but not something an owner may do here. */
  | "not_permitted";

export type OpRejection = {
  op: SiteSpecOp;
  index: number;
  reason: RejectionReason;
  /** Owner-facing. Says what was refused and where the change actually belongs. */
  message: string;
};

export type OpWarning = {
  op: SiteSpecOp;
  index: number;
  kind: "stale_fact";
  message: string;
};

export type AuthorizeResult = {
  authorized: SiteSpecOp[];
  rejected: OpRejection[];
  warnings: OpWarning[];
};

export type AuthorizeContext = {
  spec: SiteSpec;
  business: BusinessPayload;
  locale?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Detecting operational assertions in copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Money. Deliberately broad — symbol before or after, ISO code either side,
 * decimal comma or point. A false positive costs the owner a clear explanation;
 * a false negative costs them a wrong price on their live website.
 */
const MONEY = /(?:(?:[€£$]|\b(?:EUR|USD|GBP|CHF|RSD|ALL|MKD)\b)\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:[€£$]|\b(?:EUR|USD|GBP|CHF|RSD|ALL|MKD)\b))/gi;

/** "30 min", "45 minutes", "1 hr", "2 hours", "90min". */
const DURATION = /\b\d{1,3}\s*(?:min(?:ute)?s?|hrs?|hours?)\b/gi;

/** "09:00", "9am", "18.30" — a clock time, which on a website means opening hours. */
const CLOCK = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b|\b(?:1[0-2]|0?\d)\s*(?:am|pm)\b/gi;

/** A run of digits long enough to be a phone number. */
const PHONE = /(?:\+\d[\d\s().-]{7,}\d)|(?:\b\d[\d\s().-]{8,}\d\b)/g;

const normaliseNumber = (value: string): string =>
  value.replace(/[^\d.,]/g, "").replace(",", ".").replace(/\.0+$/, "");

/** Every money string the business's own data would produce. */
const canonicalMoney = (business: BusinessPayload, locale: string): Set<string> => {
  const set = new Set<string>();
  for (const service of business.services) {
    const formatted = formatServicePrice(service, locale);
    if (formatted) {
      set.add(normaliseNumber(formatted));
    }
    if (service.basePriceCents != null) {
      set.add(normaliseNumber(String(service.basePriceCents / 100)));
    }
  }
  return set;
};

const canonicalDurations = (business: BusinessPayload): Set<string> => {
  const set = new Set<string>();
  for (const service of business.services) {
    set.add(formatDuration(service.durationMin).toLowerCase());
    set.add(`${service.durationMin} min`);
    set.add(`${service.durationMin} minutes`);
  }
  return set;
};

const canonicalClockTimes = (business: BusinessPayload): Set<string> => {
  const set = new Set<string>();
  for (const row of business.hours) {
    if (row.open) set.add(row.open.slice(0, 5));
    if (row.close) set.add(row.close.slice(0, 5));
  }
  for (const row of business.rawHours) {
    if (row.open) set.add(String(row.open).slice(0, 5));
    if (row.close) set.add(String(row.close).slice(0, 5));
  }
  return set;
};

type FactCheck =
  | { verdict: "clean" }
  | { verdict: "matches_canonical"; kind: string; found: string }
  | { verdict: "contradicts"; kind: string; found: string; routeTo: string };

/**
 * Does this piece of copy assert an operational fact, and if so does it agree
 * with the business record?
 */
export const checkCopyForOperationalFacts = (
  text: string,
  business: BusinessPayload,
  locale: string
): FactCheck => {
  const money = text.match(MONEY);
  if (money?.length) {
    const canonical = canonicalMoney(business, locale);
    const unknown = money.find((raw) => !canonical.has(normaliseNumber(raw)));
    if (unknown) {
      return {
        verdict: "contradicts",
        kind: "price",
        found: unknown.trim(),
        routeTo: "Services in your Business settings"
      };
    }
    return { verdict: "matches_canonical", kind: "price", found: money[0].trim() };
  }

  const durations = text.match(DURATION);
  if (durations?.length) {
    const canonical = canonicalDurations(business);
    const unknown = durations.find(
      (raw) => !canonical.has(raw.trim().toLowerCase().replace(/\s+/g, " "))
    );
    if (unknown) {
      return {
        verdict: "contradicts",
        kind: "duration",
        found: unknown.trim(),
        routeTo: "Services in your Business settings"
      };
    }
    return { verdict: "matches_canonical", kind: "duration", found: durations[0].trim() };
  }

  const clocks = text.match(CLOCK);
  if (clocks?.length) {
    const canonical = canonicalClockTimes(business);
    const unknown = clocks.find((raw) => !canonical.has(raw.trim().replace(".", ":")));
    if (unknown) {
      return {
        verdict: "contradicts",
        kind: "opening time",
        found: unknown.trim(),
        routeTo: "Opening hours in your Business settings"
      };
    }
    return { verdict: "matches_canonical", kind: "opening time", found: clocks[0].trim() };
  }

  const phones = text.match(PHONE);
  if (phones?.length) {
    const canonicalPhone = business.location?.phone?.replace(/\D/g, "") ?? "";
    const unknown = phones.find((raw) => raw.replace(/\D/g, "") !== canonicalPhone);
    if (unknown) {
      return {
        verdict: "contradicts",
        kind: "phone number",
        found: unknown.trim(),
        routeTo: "Contact details in your Business settings"
      };
    }
    return { verdict: "matches_canonical", kind: "phone number", found: phones[0].trim() };
  }

  return { verdict: "clean" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

/** Copy fields where an operational-looking string is genuinely never wanted. */
const FACT_CHECKED_OPS = new Set(["set_copy", "set_terminology"]);

/**
 * Decide which operations may proceed.
 *
 * Returns the authorized subset plus an explanation for everything refused, so
 * the conversation can tell the owner *why* and where the change belongs —
 * rather than silently doing something adjacent to what they asked for.
 */
export const authorizeOps = (ops: SiteSpecOp[], context: AuthorizeContext): AuthorizeResult => {
  const { spec, business } = context;
  const locale = context.locale ?? spec.meta.locale;

  const authorized: SiteSpecOp[] = [];
  const rejected: OpRejection[] = [];
  const warnings: OpWarning[] = [];

  const sectionIds = new Set(spec.sections.map((section) => section.id));

  for (const [index, op] of ops.entries()) {
    // ── 1 · the target has to exist ─────────────────────────────────────
    const namedSection = referencedSectionId(op);
    if (namedSection && !sectionIds.has(namedSection) && op.op !== "add_section") {
      rejected.push({
        op,
        index,
        reason: "unknown_target",
        message: `There is no "${namedSection}" section on this site.`
      });
      continue;
    }

    // ── 2 · operational truth stays in Business ─────────────────────────
    if (FACT_CHECKED_OPS.has(op.op)) {
      const text = op.op === "set_copy" ? op.value : op.op === "set_terminology" ? op.value : "";
      const check = checkCopyForOperationalFacts(text, business, locale);

      if (check.verdict === "contradicts") {
        rejected.push({
          op,
          index,
          reason: "operational_fact",
          message:
            `I can't put "${check.found}" on the website — that ${check.kind} doesn't match your ` +
            `business record, and the website shows whatever is in there. ` +
            `Change it in ${check.routeTo} and the site will follow.`
        });
        continue;
      }

      if (check.verdict === "matches_canonical") {
        warnings.push({
          op,
          index,
          kind: "stale_fact",
          message:
            `This copy states a ${check.kind} ("${check.found}") that is correct today but is ` +
            `written into the text, so it will not update when your business record changes.`
        });
      }
    }

    // ── 3 · things an owner may not do from here ────────────────────────
    if (op.op === "remove_section") {
      const section = spec.sections.find((candidate) => candidate.id === op.sectionId);
      if (section?.type === "hero") {
        rejected.push({
          op,
          index,
          reason: "not_permitted",
          message: "Every site needs its opening section, so that one can't be removed."
        });
        continue;
      }
    }

    authorized.push(op);
  }

  return { authorized, rejected, warnings };
};

/** The section an operation names, if it names one. */
const referencedSectionId = (op: SiteSpecOp): string | null => {
  switch (op.op) {
    case "set_layout":
    case "set_presentation":
    case "remove_section":
      return op.sectionId;
    case "set_copy":
      return "sectionId" in op.target ? op.target.sectionId : null;
    default:
      return null;
  }
};
