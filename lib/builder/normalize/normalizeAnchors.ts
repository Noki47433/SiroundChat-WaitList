import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";

type NormalizeAnchorsOptions = {
  bookingSelected: boolean;
  contactSelected: boolean;
};

type SectionRef = {
  pageIndex: number;
  sectionIndex: number;
  section: SiteSection;
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

const assignStandardAnchorId = (sections: SectionRef[], type: SiteSection["type"], forcedId: string) => {
  const target = sections.find((entry) => entry.section.type === type);
  if (!target) return;
  target.section.id = forcedId;
};

const dedupeSectionIds = (sections: SectionRef[]) => {
  const oldToNew = new Map<string, string>();
  const seen = new Set<string>();
  const counters = new Map<string, number>();

  sections.forEach((entry) => {
    const oldId = entry.section.id;
    let nextId = oldId;
    if (seen.has(nextId)) {
      const count = counters.get(oldId) ?? 1;
      let candidate = `${oldId}-${count}`;
      let nextCount = count + 1;
      while (seen.has(candidate)) {
        candidate = `${oldId}-${nextCount}`;
        nextCount += 1;
      }
      counters.set(oldId, nextCount);
      nextId = candidate;
    }
    seen.add(nextId);
    entry.section.id = nextId;
    if (!oldToNew.has(oldId)) {
      oldToNew.set(oldId, nextId);
    }
  });

  return oldToNew;
};

const normalizeHref = (
  href: string,
  section: SiteSection,
  options: NormalizeAnchorsOptions,
  anchorSet: Set<string>,
  fallbackTarget: string,
  contactTarget: string | null,
  reservationTarget: string | null,
  remap: Map<string, string>
) => {
  const trimmed = href.trim();
  const content = (section.content as Record<string, unknown>) ?? {};
  const intentSource = `${trimmed} ${String(content.ctaLabel ?? "")}`.trim();

  const heroTarget =
    options.bookingSelected && reservationTarget
      ? reservationTarget
      : contactTarget ?? reservationTarget ?? fallbackTarget;

  if (!trimmed) {
    if (section.type === "hero") return heroTarget;
    if (hasBookingIntent(intentSource) && reservationTarget) return reservationTarget;
    if (hasContactIntent(intentSource) && contactTarget) return contactTarget;
    return fallbackTarget;
  }

  if (isExternalHref(trimmed)) return trimmed;

  if (trimmed.startsWith("#")) {
    const rawId = trimmed.slice(1);
    const remapped = remap.get(rawId) ?? rawId;
    const candidate = `#${remapped}`;
    if (anchorSet.has(candidate)) {
      if (section.type === "hero") return heroTarget;
      return candidate;
    }
    if (hasBookingIntent(intentSource) && reservationTarget) return reservationTarget;
    if (hasContactIntent(intentSource) && contactTarget) return contactTarget;
    if (section.type === "hero") return heroTarget;
    return fallbackTarget;
  }

  if (hasBookingIntent(intentSource) && reservationTarget) return reservationTarget;
  if (hasContactIntent(intentSource) && contactTarget) return contactTarget;
  if (section.type === "hero") return heroTarget;
  return fallbackTarget;
};

export const normalizeAnchors = (
  siteDocument: SiteDocument,
  options: NormalizeAnchorsOptions
): SiteDocument => {
  const pages = siteDocument.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      content: section.content && typeof section.content === "object" ? { ...section.content } : {}
    }))
  }));

  const refs: SectionRef[] = [];
  pages.forEach((page, pageIndex) => {
    page.sections.forEach((section, sectionIndex) => {
      refs.push({ pageIndex, sectionIndex, section });
    });
  });

  assignStandardAnchorId(refs, "contact", "contact");
  assignStandardAnchorId(refs, "reservation", "reservation");
  const remap = dedupeSectionIds(refs);

  const anchors = new Set<string>();
  const sectionIdToPageSlug = new Map<string, string>();
  pages.forEach((page) => {
    page.sections.forEach((section) => {
      anchors.add(`#${section.id}`);
      sectionIdToPageSlug.set(section.id, page.slug);
    });
  });

  const contactSection = refs.find((entry) => entry.section.type === "contact")?.section;
  const reservationSection = refs.find((entry) => entry.section.type === "reservation")?.section;
  const firstSection = refs[0]?.section;

  const contactTarget = contactSection ? `#${contactSection.id}` : null;
  const reservationTarget = reservationSection ? `#${reservationSection.id}` : null;
  const fallbackTarget = firstSection ? `#${firstSection.id}` : "#home";

  const normalizedPages = pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      const content = section.content as Record<string, any>;
      const currentHref = typeof content.ctaHref === "string" ? content.ctaHref : "";
      const nextHref = normalizeHref(
        currentHref,
        section,
        options,
        anchors,
        fallbackTarget,
        contactTarget,
        reservationTarget,
        remap
      );

      if (section.type === "hero") {
        if (options.bookingSelected && reservationTarget) {
          content.ctaHref = reservationTarget;
        } else if (options.contactSelected && contactTarget) {
          content.ctaHref = contactTarget;
        } else {
          content.ctaHref = nextHref;
        }
      } else if (section.type === "contact") {
        content.ctaHref = contactTarget ?? nextHref;
      } else if (section.type === "reservation") {
        content.ctaHref = reservationTarget ?? nextHref;
      } else if (section.type === "cta" || typeof content.ctaHref === "string") {
        content.ctaHref = nextHref;
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
    pages: normalizedPages
  };
};
