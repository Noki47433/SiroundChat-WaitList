/**
 * What the website IS, as a single hash.
 *
 * Stage 3F.1 found that 40 of 134 edits reported `changed: true` and wrote a new
 * version whose spec was byte-identical to its parent. "A version was saved" and
 * "the website changed" had become the same sentence in the code, and they are
 * not. This is the function that tells them apart, and it is the ONE
 * implementation of that question: the edit pipeline uses it to decide whether
 * to write a version at all, and the Stage 3F.2 measurement uses it to decide
 * whether an edit did anything. Two normalisations that are supposed to agree
 * eventually do not — Stage 3F lost a checkpoint to exactly that.
 *
 * The canonical form, precisely:
 *
 *   1. The spec is parsed through `SiteSpecSchema`, so every field the schema
 *      defaults is present with its default. A heading scale that was never set
 *      and one explicitly set to "default" render identically, and fingerprint
 *      identically. If the spec does not parse, the raw value is used — an
 *      invalid spec still gets a stable fingerprint rather than an exception.
 *   2. Bookkeeping that can move without the website moving is removed:
 *      `meta.generatedAt` and `meta.updatedAt`. Nothing else is removed. SEO
 *      title and description stay, because they are what a search result shows.
 *   3. Object keys are sorted at every depth; array order is preserved, because
 *      array order is meaning here — section order, menu order, gallery order.
 *   4. `undefined` is dropped, as JSON does.
 *   5. SHA-256 of the resulting JSON, hex.
 *
 * Pure and dependency-free beyond the schema, so a test can pin every rule.
 */
import { createHash } from "node:crypto";

import { SiteSpecSchema } from "@/lib/site-spec/schema";

/** Paths removed before hashing. Each is bookkeeping, not website. */
export const VOLATILE_SPEC_PATHS = ["meta.generatedAt", "meta.updatedAt"] as const;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) continue;
      out[key] = canonical(child);
    }
    return out;
  }
  return value;
};

/** The canonical, bookkeeping-free form of a spec. Exposed so tests can inspect it. */
export const semanticForm = (spec: unknown): unknown => {
  const parsed = SiteSpecSchema.safeParse(spec);
  const base = parsed.success ? parsed.data : spec;
  // Deep copy through JSON so removing bookkeeping never touches the caller's object.
  const copy = JSON.parse(JSON.stringify(base ?? null));
  if (copy && typeof copy === "object" && copy.meta && typeof copy.meta === "object") {
    delete copy.meta.generatedAt;
    delete copy.meta.updatedAt;
  }
  return canonical(copy);
};

export const semanticFingerprint = (spec: unknown): string =>
  createHash("sha256").update(JSON.stringify(semanticForm(spec))).digest("hex");

/** True when two specs would render the same website. */
export const sameWebsite = (a: unknown, b: unknown): boolean =>
  semanticFingerprint(a) === semanticFingerprint(b);
