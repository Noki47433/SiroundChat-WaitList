const DEFAULT_PUBLISHED_SITE_ROOT_DOMAIN = "siroundchat.com";
const DEFAULT_PUBLISHED_SITE_URL_MODE = "path";

type PublishedSiteUrlMode = "path" | "subdomain";

const normalizeSlug = (value: string) => value.trim().toLowerCase();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const stripProtocolAndPath = (value: string) =>
  trimTrailingSlash(value.trim().toLowerCase())
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

export const normalizeHost = (value?: string | null) => {
  const normalized = stripProtocolAndPath((value ?? "").split(",")[0] ?? "");
  return normalized.replace(/:\d+$/, "");
};

export const getPublishedSiteRootDomain = () =>
  normalizeHost(
    process.env.NEXT_PUBLIC_PUBLISHED_SITE_ROOT_DOMAIN ??
      process.env.PUBLISHED_SITE_ROOT_DOMAIN ??
      DEFAULT_PUBLISHED_SITE_ROOT_DOMAIN
  );

export const getPublishedSiteUrlMode = (): PublishedSiteUrlMode => {
  const configuredMode = (
    process.env.NEXT_PUBLIC_PUBLISHED_SITE_URL_MODE ??
    process.env.PUBLISHED_SITE_URL_MODE ??
    DEFAULT_PUBLISHED_SITE_URL_MODE
  )
    .trim()
    .toLowerCase();

  return configuredMode === "subdomain" ? "subdomain" : "path";
};

export const isLocalHost = (value?: string | null) => {
  const host = normalizeHost(value);
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1"
  );
};

export const buildPublishedSiteOrigin = (slug: string) =>
  getPublishedSiteUrlMode() === "subdomain"
    ? `https://${normalizeSlug(slug)}.${getPublishedSiteRootDomain()}`
    : `https://${getPublishedSiteRootDomain()}`;

export const buildPublishedSiteUrl = (slug: string, path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (getPublishedSiteUrlMode() === "subdomain") {
    return `${buildPublishedSiteOrigin(slug)}${normalizedPath}`;
  }

  const normalizedSlug = normalizeSlug(slug);
  const routePath = normalizedPath === "/" ? `/s/${normalizedSlug}` : `/s/${normalizedSlug}${normalizedPath}`;
  return `${buildPublishedSiteOrigin(slug)}${routePath}`;
};

export const extractPublishedSiteSlugFromHost = (value?: string | null) => {
  const host = normalizeHost(value);
  const rootDomain = getPublishedSiteRootDomain();

  if (!host || isLocalHost(host) || host === rootDomain || host === `www.${rootDomain}`) {
    return null;
  }

  if (!host.endsWith(`.${rootDomain}`)) {
    return null;
  }

  const slug = host.slice(0, -(rootDomain.length + 1));
  if (!slug || slug === "www" || slug.includes(".")) {
    return null;
  }

  return slug;
};

export const getRequestHost = (headersLike: Pick<Headers, "get">) =>
  normalizeHost(headersLike.get("x-forwarded-host") || headersLike.get("host"));

export const getRequestProtocol = (headersLike: Pick<Headers, "get">) => {
  const forwardedProto = headersLike.get("x-forwarded-proto") || "https";
  return forwardedProto.split(",")[0]?.trim() || "https";
};

export const isPublishedSiteHost = (value?: string | null) => Boolean(extractPublishedSiteSlugFromHost(value));
