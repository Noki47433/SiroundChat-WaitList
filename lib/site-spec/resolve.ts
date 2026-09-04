/**
 * Resolution — where a Site Spec meets canonical business truth.
 *
 * The spec says *how* to present a business. `loadBusiness()` says *what is
 * true about it*. This module joins the two and hands the renderer a structure
 * in which every fact is already a resolved string, so the renderer itself
 * never reads the database, never formats a price and never decides what a
 * service costs.
 *
 * The direction of travel matters: a price on a published page is the price in
 * the `service` table at render time. Editing the website cannot change it, and
 * changing it in Business updates every site that shows it, with no edit.
 */
import type {
  BusinessPayload,
  BusinessService,
  BusinessTeamMember,
  HoursRow
} from "@/lib/business/load";
import type {
  Cta,
  CtaTarget,
  FactRef,
  MediaRef,
  Section,
  Selection,
  SiteSpec,
  SpecText
} from "@/lib/site-spec/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

/** One row of `builder_site_assets`, reduced to what rendering needs. */
export type SiteAsset = {
  id: string;
  url: string;
  alt: string | null;
};

/**
 * Business-level fields that live on `businesses` rather than in the booking
 * domain `loadBusiness()` covers.
 */
export type BusinessProfile = {
  description?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

export type ResolveInput = {
  spec: SiteSpec;
  business: BusinessPayload;
  assets: SiteAsset[];
  profile?: BusinessProfile;
};

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

export type ResolvedImage =
  | { kind: "asset"; url: string; alt: string }
  | { kind: "generated"; index: number; alt: string };

export type ResolvedService = {
  id: string;
  name: string;
  description: string | null;
  /** Already formatted for display, or null when the business hides pricing. */
  price: string | null;
  duration: string;
};

export type ResolvedTeamMember = {
  id: string;
  name: string;
  role: string | null;
  portrait: ResolvedImage;
};

export type ResolvedHoursRow = {
  label: string;
  value: string;
  closed: boolean;
};

export type ResolvedLink = {
  label: string;
  /**
   * Already safe: an internal anchor, a `tel:`/`mailto:` built from canonical
   * data, or an https URL the schema parsed.
   */
  href: string;
  external: boolean;
};

export type ResolvedSite = {
  spec: SiteSpec;
  locale: string;
  brandName: string;
  brandMark: string;
  logoUrl: string | null;
  seo: { title: string; description: string };
  description: string | null;
  contact: {
    address: string | null;
    phone: string | null;
    email: string | null;
    locationName: string | null;
    directionsUrl: string | null;
  };
  socials: ResolvedLink[];
  nav: { items: Array<{ id: string; label: string }>; cta: ResolvedLink };
  services: ResolvedService[];
  team: ResolvedTeamMember[];
  hours: ResolvedHoursRow[];
  hasHours: boolean;
  exceptions: Array<{ title: string; value: string }>;
  /**
   * True when this business has a live booking engine behind it. A site whose
   * spec asks for a booking panel still renders one when this is false — it
   * just does not draw time slots it cannot honour.
   */
  bookingEnabled: boolean;
  /** Asset rows keyed by id, for media the renderer resolves lazily. */
  assets: Map<string, SiteAsset>;
  /** Diagnostics: references the spec made that no longer resolve. */
  danglingRefs: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

const formatMoney = (cents: number, currency: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(cents / 100);
  } catch {
    // An unknown currency code should degrade, not throw mid-render.
    return `${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} ${currency}`;
  }
};

export const formatServicePrice = (
  service: Pick<BusinessService, "priceMode" | "basePriceCents" | "currency">,
  locale: string
): string | null => {
  if (service.priceMode === "hidden") return null;
  if (service.basePriceCents == null) return null;
  const amount = formatMoney(service.basePriceCents, service.currency, locale);
  return service.priceMode === "from" ? `from ${amount}` : amount;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return hours === 1 ? "1 hr" : `${hours} hrs`;
  return `${hours} hr ${rest} min`;
};

const formatHoursRow = (row: HoursRow): ResolvedHoursRow => ({
  label: row.label,
  value: row.closed || !row.open || !row.close ? "Closed" : `${row.open}–${row.close}`,
  closed: row.closed
});

// ─────────────────────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset URLs come from the database, not from the spec, but they are still
 * data the renderer is about to put in an `src`. Anything that is not plain
 * http(s) is dropped rather than rendered.
 */
const safeAssetUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

/** `tel:` / `mailto:` targets are built here from canonical data, never from spec text. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const mailHref = (email: string) => `mailto:${email.replace(/[\s<>"']/g, "")}`;
const directionsHref = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const deriveMark = (name: string): string => {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return ((words[0] ?? name).slice(0, 2) || "SC").toUpperCase();
};

/**
 * `team_member` carries no job title. Naming the one service somebody is the
 * only provider for is a fact; inventing "Master barber" is not.
 */
const deriveRole = (member: BusinessTeamMember, services: ResolvedService[]): string | null => {
  if (member.serviceIds.length !== 1) return null;
  return services.find((service) => service.id === member.serviceIds[0])?.name ?? null;
};

const applySelection = <T extends { id: string }>(selection: Selection, rows: T[]): T[] => {
  if (selection.mode === "all") {
    return selection.limit ? rows.slice(0, selection.limit) : rows;
  }
  // Preserve the curated order the spec asked for, and silently drop ids that
  // no longer exist — a deleted service must not break a published page.
  const byId = new Map(rows.map((row) => [row.id, row]));
  return selection.ids.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Everything below is a pure function of `ResolvedSite`. Nothing captures a
 * closure over the load-time inputs, so a resolved site stays a plain,
 * comparable value — which is what makes renderer determinism testable.
 */

const contactAnchor = (spec: SiteSpec): string => {
  const contact = spec.sections.find((section) => section.type === "contact");
  return `#${contact?.id ?? spec.sections[0].id}`;
};

export const resolveFact = (site: ResolvedSite, ref: FactRef): string | undefined => {
  switch (ref.ref) {
    case "business.name":
      return site.brandName;
    case "business.description":
      return site.description ?? undefined;
    case "location.address":
      return site.contact.address ?? undefined;
    case "location.phone":
      return site.contact.phone ?? undefined;
    case "location.name":
      return site.contact.locationName ?? undefined;
    case "service.name":
      return site.services.find((service) => service.id === ref.id)?.name;
    case "service.price":
      return site.services.find((service) => service.id === ref.id)?.price ?? undefined;
    case "service.duration":
      return site.services.find((service) => service.id === ref.id)?.duration;
    case "team.name":
      return site.team.find((member) => member.id === ref.id)?.name;
    case "team.role":
      return site.team.find((member) => member.id === ref.id)?.role ?? undefined;
    default:
      return undefined;
  }
};

/**
 * The renderer asks for text through this, so a spec that binds a fact which has
 * since disappeared renders nothing at all rather than the word "undefined".
 */
export const specTextToString = (
  site: ResolvedSite,
  value: SpecText | undefined
): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  return resolveFact(site, value);
};

export const resolveTarget = (site: ResolvedSite, target: CtaTarget): string => {
  const { spec } = site;
  switch (target.kind) {
    case "section":
      return `#${target.sectionId}`;
    case "booking": {
      const booking = spec.sections.find((section) => section.type === "booking");
      return booking ? `#${booking.id}` : contactAnchor(spec);
    }
    case "enquiry": {
      const enquiry = spec.sections.find((section) => section.type === "enquiry");
      return enquiry ? `#${enquiry.id}` : contactAnchor(spec);
    }
    case "phone":
      return site.contact.phone ? telHref(site.contact.phone) : contactAnchor(spec);
    case "email":
      return site.contact.email ? mailHref(site.contact.email) : contactAnchor(spec);
    case "directions":
      return site.contact.directionsUrl ?? contactAnchor(spec);
    case "external":
      return target.url;
    default:
      return contactAnchor(spec);
  }
};

export const resolveCtaLink = (site: ResolvedSite, cta: Cta): ResolvedLink => ({
  label: cta.label,
  href: resolveTarget(site, cta.target),
  external: cta.target.kind === "external"
});

/**
 * A media slot resolves to a real asset when one is pinned and readable, and to
 * the spec's own deterministic art otherwise. A missing asset therefore
 * degrades to a picture rather than a broken image.
 */
export const resolveMedia = (
  site: ResolvedSite,
  media: MediaRef,
  fallbackAlt: string
): ResolvedImage => {
  if (media.kind === "generated") {
    return { kind: "generated", index: media.seed, alt: media.alt || fallbackAlt };
  }
  const asset = site.assets.get(media.assetId);
  const url = asset ? safeAssetUrl(asset.url) : null;
  if (url) return { kind: "asset", url, alt: media.alt || asset?.alt || fallbackAlt };
  return { kind: "generated", index: media.fallbackSeed, alt: media.alt || fallbackAlt };
};

export const selectServices = (site: ResolvedSite, selection: Selection): ResolvedService[] =>
  applySelection(selection, site.services);

export const selectTeam = (site: ResolvedSite, selection: Selection): ResolvedTeamMember[] =>
  applySelection(selection, site.team);

/** Narrow the section union by type — used by the per-section components. */
export const sectionsOfType = <T extends Section["type"]>(
  spec: SiteSpec,
  type: T
): Array<Extract<Section, { type: T }>> =>
  spec.sections.filter((section): section is Extract<Section, { type: T }> => section.type === type);

const navLabelFor = (spec: SiteSpec, id: string): string => {
  const section = spec.sections.find((candidate) => candidate.id === id);
  const t = spec.terminology;
  if (!section) return t.contact;
  switch (section.type) {
    case "services":
      return t.services;
    case "team":
      return t.team;
    case "gallery":
      return t.gallery;
    case "hours":
      return t.hours;
    case "story":
      return t.story;
    case "reviews":
      return t.reviews;
    case "contact":
      return t.contact;
    case "booking":
    case "enquiry":
      return t.primaryAction;
    default:
      return t.contact;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// The join
// ─────────────────────────────────────────────────────────────────────────────

export const resolveSite = ({ spec, business, assets, profile }: ResolveInput): ResolvedSite => {
  const locale = spec.meta.locale;
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  const brandName = spec.meta.brandName || business.businessName || "Business";
  const address = business.location?.address ?? null;

  const services: ResolvedService[] = business.services
    .filter((service) => service.isActive)
    .map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: formatServicePrice(service, locale),
      duration: formatDuration(service.durationMin)
    }));

  // Portrait overrides are declared on team sections, keyed by team member id.
  const portraitOverrides = new Map<string, MediaRef>();
  for (const section of spec.sections) {
    if (section.type !== "team") continue;
    for (const [memberId, media] of Object.entries(section.portraits)) {
      portraitOverrides.set(memberId, media);
    }
  }

  const site: ResolvedSite = {
    spec,
    locale,
    brandName,
    brandMark: spec.meta.brandMark || deriveMark(brandName),
    logoUrl: profile?.logoUrl ? safeAssetUrl(profile.logoUrl) : null,
    seo: spec.meta.seo,
    description: profile?.description ?? null,
    contact: {
      address,
      phone: business.location?.phone ?? null,
      email: profile?.email ?? null,
      locationName: business.location?.name ?? null,
      directionsUrl: address ? directionsHref(address) : null
    },
    socials: spec.socials.map((social) => ({
      label: social.label,
      href: social.url,
      external: true
    })),
    // Filled in below, once `site` exists for the pure resolvers to read.
    nav: { items: [], cta: { label: spec.nav.cta.label, href: "#", external: false } },
    services,
    team: [],
    hours: business.hours.map(formatHoursRow),
    hasHours: business.hasHours,
    exceptions: business.exceptions.map((exception) => ({
      title: exception.title,
      value: exception.value
    })),
    // Only the neutral engine can quote and hold a real slot. In legacy mode the
    // site still invites a booking; it just does not draw times it cannot keep.
    bookingEnabled: business.capabilities.mode === "neutral",
    assets: assetsById,
    danglingRefs: []
  };

  site.team = business.team
    .filter((member) => member.isActive)
    .map((member, index) => {
      const override = portraitOverrides.get(member.id);
      return {
        id: member.id,
        name: member.name,
        role: deriveRole(member, services),
        portrait: override
          ? resolveMedia(site, override, member.name)
          : { kind: "generated" as const, index: index + 2, alt: member.name }
      };
    });

  site.nav = {
    items: spec.nav.items.map((id) => ({ id, label: navLabelFor(spec, id) })),
    cta: resolveCtaLink(site, spec.nav.cta)
  };

  site.danglingRefs = collectDanglingRefs(site, portraitOverrides);
  return site;
};

/**
 * References the spec makes that no longer resolve. Never fatal — a published
 * page must survive a service being deleted in Business — but the builder
 * surfaces these so the owner can see that something they pinned has gone.
 */
const collectDanglingRefs = (
  site: ResolvedSite,
  portraits: Map<string, MediaRef>
): string[] => {
  const dangling: string[] = [];

  const checkMedia = (media: MediaRef) => {
    if (media.kind !== "asset") return;
    const asset = site.assets.get(media.assetId);
    if (!asset || !safeAssetUrl(asset.url)) dangling.push(`asset:${media.assetId}`);
  };

  const checkText = (value: SpecText | undefined) => {
    if (!value || typeof value === "string") return;
    if (resolveFact(site, value) === undefined) {
      dangling.push(value.id ? `${value.ref}:${value.id}` : value.ref);
    }
  };

  for (const media of portraits.values()) checkMedia(media);

  for (const section of site.spec.sections) {
    checkText(section.heading.eyebrow);
    checkText(section.heading.title);
    checkText(section.heading.sub);
    if (section.type === "hero") {
      checkText(section.eyebrow);
      checkText(section.body);
      checkMedia(section.media);
    }
    if (section.type === "gallery") section.items.forEach(checkMedia);
    if (section.type === "services" && section.selection.mode === "include") {
      for (const id of section.selection.ids) {
        if (!site.services.some((service) => service.id === id)) dangling.push(`service:${id}`);
      }
    }
    if (section.type === "team" && section.selection.mode === "include") {
      for (const id of section.selection.ids) {
        if (!site.team.some((member) => member.id === id)) dangling.push(`team:${id}`);
      }
    }
  }

  return Array.from(new Set(dangling));
};
