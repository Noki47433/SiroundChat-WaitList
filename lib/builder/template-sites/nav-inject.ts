import type { NavigationItem } from "./schema";

type NavEntry = { label: string; href: string };

const RESERVED_SLUGS = new Set([
  "api", "admin", "dashboard", "login", "signup", "register", "preview",
  "home", "_next", "favicon.ico"
]);

export function normalizePageSlug(raw: string, existing: string[]): string {
  let slug = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) slug = "page";
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-page`;

  // Deduplicate
  if (existing.includes(slug)) {
    let i = 2;
    while (existing.includes(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }

  return slug;
}

/**
 * Inject document-level navigationItems into template data so headers render
 * additional page links alongside their existing in-page anchor links.
 *
 * Called after mapIntegratedTemplateData() on every studio-edit save.
 * Safe to call when navigationItems is empty — returns data unchanged.
 */
export function injectNavigationItemsIntoTemplateData(
  template: string,
  data: unknown,
  navigationItems: NavigationItem[] | undefined
): unknown {
  if (!data || typeof data !== "object") return data;
  if (!navigationItems?.length) return data;

  const enabled = navigationItems
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order);

  if (!enabled.length) return data;

  const newEntries: NavEntry[] = enabled.map((item) => ({
    label: item.label,
    href: item.href
  }));

  const d = data as Record<string, unknown>;

  if (template === "food-truck") {
    const header = ((d.header ?? {}) as Record<string, unknown>);
    const existing = Array.isArray(header.links) ? (header.links as NavEntry[]) : [];
    const anchorLinks = existing.filter((l) => !String(l.href).startsWith("?page="));
    return {
      ...d,
      header: { ...header, links: [...anchorLinks, ...newEntries] }
    };
  }

  // evasion, essence, hously — use header.navItems
  const header = ((d.header ?? {}) as Record<string, unknown>);
  const existing = Array.isArray(header.navItems) ? (header.navItems as NavEntry[]) : [];
  const anchorItems = existing.filter((item) => !String(item.href).startsWith("?page="));
  return {
    ...d,
    header: { ...header, navItems: [...anchorItems, ...newEntries] }
  };
}
