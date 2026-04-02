import "server-only";
import type { WidgetConfig } from "@/lib/types/core";
import { WidgetConfigSchema } from "@/lib/validation/widget";

const WIDGET_CONFIG_ONBOARDING_KEY = "widgetConfig";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getWidgetConfigFromOnboardingData = (onboardingData: unknown, siteId: string): WidgetConfig | null => {
  if (!isRecord(onboardingData)) return null;

  const stored = onboardingData[WIDGET_CONFIG_ONBOARDING_KEY];
  if (!isRecord(stored)) return null;

  const parsed = WidgetConfigSchema.safeParse({
    ...stored,
    siteId
  });

  if (!parsed.success) {
    console.error("[WIDGET_CONFIG_ONBOARDING_PARSE_ERROR]", parsed.error.flatten());
    return null;
  }

  return parsed.data;
};

export const setWidgetConfigInOnboardingData = (onboardingData: unknown, config: WidgetConfig) => {
  const base = isRecord(onboardingData) ? onboardingData : {};
  const parsedConfig = WidgetConfigSchema.parse(config);

  return {
    ...base,
    [WIDGET_CONFIG_ONBOARDING_KEY]: parsedConfig
  };
};
