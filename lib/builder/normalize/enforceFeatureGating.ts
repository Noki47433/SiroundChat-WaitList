import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";

type EnforceFeatureGatingOptions = {
  createRequiredSection?: (type: SiteSection["type"], pageIndex: number) => SiteSection;
  pruneEmptyGallery?: boolean;
  pruneEmptyFaq?: boolean;
};

const hasFaqItems = (section: SiteSection) => {
  const items = (section.content as Record<string, unknown>)?.items;
  return Array.isArray(items) && items.length > 0;
};

const hasGalleryImages = (section: SiteSection) => Array.isArray(section.images) && section.images.length > 0;

const insertBeforeFooter = (sections: SiteSection[], section: SiteSection) => {
  const footerIndex = sections.findIndex((item) => item.type === "footer");
  if (footerIndex === -1) {
    sections.push(section);
    return;
  }
  sections.splice(footerIndex, 0, section);
};

export const enforceFeatureGating = (
  siteDocument: SiteDocument,
  allowedSectionTypes: SiteSection["type"][],
  requiredSectionTypes: SiteSection["type"][],
  options: EnforceFeatureGatingOptions = {}
): SiteDocument => {
  const allowedSet = new Set<SiteSection["type"]>(allowedSectionTypes);
  const requiredSet = new Set<SiteSection["type"]>(requiredSectionTypes);
  const pruneEmptyGallery = options.pruneEmptyGallery !== false;
  const pruneEmptyFaq = options.pruneEmptyFaq !== false;

  const pages = siteDocument.pages.map((page, pageIndex) => {
    const filtered = page.sections.filter((section) => allowedSet.has(section.type));

    const pruned = filtered.filter((section) => {
      if (pruneEmptyGallery && section.type === "gallery" && !hasGalleryImages(section) && !requiredSet.has("gallery")) {
        return false;
      }
      if (pruneEmptyFaq && section.type === "faq" && !hasFaqItems(section)) {
        return false;
      }
      return true;
    });

    const existingTypes = new Set(pruned.map((section) => section.type));
    requiredSectionTypes.forEach((sectionType) => {
      if (!allowedSet.has(sectionType)) return;
      if (existingTypes.has(sectionType)) return;
      if (!options.createRequiredSection) return;
      const requiredSection = options.createRequiredSection(sectionType, pageIndex);
      insertBeforeFooter(pruned, { ...requiredSection, enabled: true });
      existingTypes.add(sectionType);
    });

    return {
      ...page,
      sections: pruned
    };
  });

  return {
    ...siteDocument,
    pages
  };
};
