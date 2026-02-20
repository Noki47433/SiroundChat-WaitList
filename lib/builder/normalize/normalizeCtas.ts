import type { NicheRules } from "@/lib/builder/nicheRules";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";

type NormalizeCtaOptions = {
  rules: NicheRules;
};

const isExternalHref = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("sms:") ||
    normalized.startsWith("whatsapp:") ||
    normalized.startsWith("geo:")
  );
};

const hasBookingIntent = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("reserve") ||
    normalized.includes("reservation") ||
    normalized.includes("book") ||
    normalized.includes("appointment") ||
    normalized.includes("table")
  );
};

const hasContactIntent = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("contact") ||
    normalized.includes("call") ||
    normalized.includes("email") ||
    normalized.includes("message")
  );
};

const normalizeAnchor = (
  href: string,
  section: SiteSection,
  defaultTarget: string,
  contactTarget: string | null,
  reservationTarget: string | null,
  existingAnchors: Set<string>,
  rules: NicheRules
) => {
  const trimmed = href.trim();
  const intentSource = `${trimmed} ${(section.content as Record<string, unknown>)?.ctaLabel ?? ""}`;

  if (!trimmed) {
    if (rules.key === "restaurant" && reservationTarget && section.type === "hero") {
      return reservationTarget;
    }
    return defaultTarget;
  }

  if (isExternalHref(trimmed)) return trimmed;

  if (!trimmed.startsWith("#")) {
    if (hasBookingIntent(intentSource) && reservationTarget) return reservationTarget;
    if (hasContactIntent(intentSource) && contactTarget) return contactTarget;
    return defaultTarget;
  }

  if (trimmed === "#reservation" && reservationTarget) return reservationTarget;
  if (trimmed === "#contact" && contactTarget) return contactTarget;

  if (!existingAnchors.has(trimmed)) {
    if (hasBookingIntent(intentSource) && reservationTarget) return reservationTarget;
    if (hasContactIntent(intentSource) && contactTarget) return contactTarget;
    return defaultTarget;
  }

  return trimmed;
};

export const normalizeCtas = (siteDocument: SiteDocument, options: NormalizeCtaOptions): SiteDocument => {
  const { rules } = options;
  const sections = siteDocument.pages.flatMap((page) => page.sections);
  const sectionIdToPageSlug = new Map<string, string>();
  siteDocument.pages.forEach((page) => {
    page.sections.forEach((section) => {
      sectionIdToPageSlug.set(section.id, page.slug);
    });
  });

  const contactSection = sections.find((section) => section.type === "contact");
  const reservationSection = sections.find((section) => section.type === "reservation");

  const contactTarget = contactSection ? `#${contactSection.id}` : null;
  const reservationTarget = reservationSection ? `#${reservationSection.id}` : null;
  const firstTarget = sections[0] ? `#${sections[0].id}` : "#home";
  const defaultTarget =
    rules.preferredCtaTargets.primary === "#reservation" && reservationTarget
      ? reservationTarget
      : contactTarget ?? firstTarget;

  const existingAnchors = new Set(sections.map((section) => `#${section.id}`));

  const pages = siteDocument.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      const content = section.content && typeof section.content === "object" ? { ...section.content } : {};
      const currentHref = typeof content.ctaHref === "string" ? content.ctaHref : "";

      const normalizedHref = normalizeAnchor(
        currentHref,
        section,
        defaultTarget,
        contactTarget,
        reservationTarget,
        existingAnchors,
        rules
      );

      const shouldForceReservationPrimary =
        rules.key === "restaurant" && section.type === "hero" && Boolean(reservationTarget);

      if (shouldForceReservationPrimary) {
        content.ctaHref = reservationTarget;
        if (!content.ctaLabel || typeof content.ctaLabel !== "string") {
          content.ctaLabel = "Make a Reservation";
        }
      } else if (
        section.type === "contact" ||
        section.type === "reservation" ||
        typeof content.ctaHref === "string" ||
        (section.type === "hero" && typeof content.ctaLabel === "string") ||
        section.type === "cta"
      ) {
        content.ctaHref = normalizedHref;
      }

      if (typeof content.ctaHref === "string" && content.ctaHref.startsWith("#")) {
        const targetId = content.ctaHref.slice(1);
        const targetPageSlug = sectionIdToPageSlug.get(targetId);
        if (targetPageSlug && targetPageSlug !== page.slug) {
          content.ctaHref = `?page=${targetPageSlug}${content.ctaHref}`;
        }
      }

      return {
        ...section,
        content
      };
    })
  }));

  return {
    ...siteDocument,
    pages
  };
};
