import type { SiteApp, SiteDocument } from "@/lib/website-builder/types";

type ResolveLiveChatOptions = {
  widgetKey?: string | null;
};

export type ResolvedLiveChat = {
  app: SiteApp | null;
  document: SiteDocument;
  enabled: boolean;
  scriptSrc: string | null;
  inlineScript: string | null;
  error: string | null;
};

const WIDGET_LOADER_PREFIX = "/api/widget/loader?key=";

const normalizeSrc = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith(WIDGET_LOADER_PREFIX)) return trimmed;
  return null;
};

const isWidgetLoaderUrl = (value: string) => {
  if (value.startsWith(WIDGET_LOADER_PREFIX)) return true;
  try {
    const parsed = new URL(value);
    return parsed.pathname === "/api/widget/loader";
  } catch {
    return false;
  }
};

const replaceWidgetLoaderKey = (value: string, widgetKey?: string | null) => {
  const trimmedKey = widgetKey?.trim();
  if (!trimmedKey) return value;

  const nextWidgetSrc = `${WIDGET_LOADER_PREFIX}${encodeURIComponent(trimmedKey)}`;

  if (value.startsWith(WIDGET_LOADER_PREFIX)) {
    return nextWidgetSrc;
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname !== "/api/widget/loader") return value;
    return nextWidgetSrc;
  } catch {
    return value;
  }
};

const normalizeInlineScript = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const fallbackWidgetSrc = (widgetKey?: string | null) =>
  widgetKey?.trim() ? `${WIDGET_LOADER_PREFIX}${encodeURIComponent(widgetKey.trim())}` : null;

const getLiveChatApp = (document: SiteDocument) =>
  (document.apps ?? []).find((app) => app?.id === "live-chat") ?? null;

export function resolveLiveChat(document: SiteDocument, options: ResolveLiveChatOptions = {}): ResolvedLiveChat {
  const apps = Array.isArray(document.apps) ? [...document.apps] : [];
  const appIndex = apps.findIndex((app) => app?.id === "live-chat");
  const app = appIndex >= 0 ? apps[appIndex] : null;

  if (!app) {
    return {
      app: null,
      document,
      enabled: false,
      scriptSrc: null,
      inlineScript: null,
      error: null
    };
  }

  if (!app.enabled) {
    return {
      app,
      document,
      enabled: false,
      scriptSrc: null,
      inlineScript: null,
      error: null
    };
  }

  const normalizedSrc = normalizeSrc(app.config?.src);
  const preferredSrc =
    normalizedSrc && isWidgetLoaderUrl(normalizedSrc)
      ? replaceWidgetLoaderKey(normalizedSrc, options.widgetKey)
      : normalizedSrc;
  const inlineScript = normalizeInlineScript(app.config?.script);
  const fallbackSrc = fallbackWidgetSrc(options.widgetKey);
  const scriptSrc = preferredSrc ?? (!inlineScript ? fallbackSrc : null);

  if (!scriptSrc && !inlineScript) {
    return {
      app,
      document,
      enabled: true,
      scriptSrc: null,
      inlineScript: null,
      error: "Live chat is enabled but no valid widget script is configured."
    };
  }

  if (scriptSrc && scriptSrc !== normalizedSrc) {
    const nextApp: SiteApp = {
      ...app,
      config: {
        ...(app.config ?? {}),
        src: scriptSrc
      }
    };
    apps[appIndex] = nextApp;
    return {
      app: nextApp,
      document: {
        ...document,
        apps
      },
      enabled: true,
      scriptSrc,
      inlineScript,
      error: null
    };
  }

  return {
    app,
    document,
    enabled: true,
    scriptSrc,
    inlineScript,
    error: null
  };
}
