import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { WidgetConfigSchema } from "@/lib/validation/widget";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildUpgradeRequiredPayload,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getWidgetConfigFromOnboardingData, setWidgetConfigInOnboardingData } from "@/lib/server/widget-config-store";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { ensureBusinessRow, getTenantFromSession } from "@/lib/utils/tenant";
import { getWidgetConfig, saveWidgetConfig } from "@/lib/utils/local-store";
import { isAuthDisabled } from "@/lib/config/auth";
import { FAQ_PRESETS } from "@/app/components/chatbot/chatbotFaqPresets";
import {
  getSiroundChatDemoWidgetOverrides,
  isSiroundChatDemoBot,
  SIROUNDCHAT_DEMO_WIDGET_KEY
} from "@/lib/chatbot/siroundchat-demo";
import { resolveBotConfig } from "@/lib/config/industry-presets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const DEFAULT_THEME = {
  primary: "#00A3FF",
  accent: "#38BDF8",
  secondary: "#111827",
  background: "#0B1222",
  text: "#FFFFFF",
  shape: "rounded" as const
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

const generateFallbackUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const generateWidgetKey = () => {
  try {
    return randomUUID();
  } catch {
    return generateFallbackUuid();
  }
};

const normalizeString = (value?: string | null) => (typeof value === "string" ? value.trim() : "");

const resolveTonePreset = (value?: string | null) => {
  const trimmed = normalizeString(value);
  if (!trimmed) return null;
  if (trimmed === "professional" || trimmed === "friendly" || trimmed === "luxury" || trimmed === "short_direct" || trimmed === "energetic") {
    return trimmed;
  }
  return null;
};

const withCacheBust = (url: string, version: number) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", String(version));
    return parsed.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}v=${version}`;
  }
};

const resolveBusinessByWidgetKey = async (widgetKey: string) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await (admin as any)
    .from("businesses")
    .select("id, business_name, greeting, tone, logo_url, onboarding_data")
    .eq("widget_key", widgetKey)
    .maybeSingle();

  if (error) {
    console.error("[WIDGET_KEY_LOOKUP_ERROR]", error);
  }
  return (
    data as {
      id?: string;
      business_name?: string | null;
      greeting?: string | null;
      tone?: string | null;
      logo_url?: string | null;
      onboarding_data?: Record<string, unknown> | null;
    } | null
  ) ?? null;
};

const hasWidgetAccess = async (businessId: string) => {
  const access = await getBusinessEntitlementAccess(businessId, "chatbot_embed");
  return access.allowed;
};

const isFirstPartyHomepageWidget = (widgetKey: string) => widgetKey === SIROUNDCHAT_DEMO_WIDGET_KEY;

const ensureWidgetKeyForBusiness = async (businessId: string) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await (admin as any)
    .from("businesses")
    .select("widget_key")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("[BUSINESS_WIDGET_KEY_LOOKUP_ERROR]", error);
  }

  const row = data as { widget_key?: string | null } | null;
  if (row?.widget_key) return row.widget_key;

  const widgetKey = generateWidgetKey();
  const { error: updateError } = await (admin as any)
    .from("businesses")
    .update({ widget_key: widgetKey })
    .eq("id", businessId);

  if (updateError) {
    console.error("[BUSINESS_WIDGET_KEY_UPDATE_ERROR]", updateError);
    return row?.widget_key ?? null;
  }

  return widgetKey;
};

export async function GET(request: Request) {
  try {
    const authDisabled = isAuthDisabled();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const siteId = searchParams.get("siteId");
    const configKey = key ?? siteId;
    if (!configKey) {
      return NextResponse.json({ error: "Missing key" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    let business: {
      id?: string;
      business_name?: string | null;
      greeting?: string | null;
      tone?: string | null;
      logo_url?: string | null;
      onboarding_data?: Record<string, unknown> | null;
    } | null = null;
    if (!authDisabled) {
      business = await resolveBusinessByWidgetKey(configKey);
      if (!business?.id) {
        return NextResponse.json({ error: "Widget not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      const allowed = await hasWidgetAccess(business.id);
      if (!allowed && !isFirstPartyHomepageWidget(configKey)) {
        const access = await getBusinessEntitlementAccess(business.id, "chatbot_embed");
        return NextResponse.json(
          buildUpgradeRequiredPayload("chatbot_embed", access),
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    const stored = authDisabled
      ? await getWidgetConfig(configKey)
      : getWidgetConfigFromOnboardingData(business?.onboarding_data ?? null, configKey);
    const config: z.infer<typeof WidgetConfigSchema> =
      stored ?? {
        siteId: configKey,
        businessName: "Website Chatbot",
        greeting: "Hi there! How can I help today?",
        launcherPosition: "right",
        launcherVariant: "iconWithLabel",
        businessType: "custom",
        faqs: FAQ_PRESETS.custom,
        language: "auto",
        showLogo: true,
        logoUrl: null,
        iconId: null,
        theme: DEFAULT_THEME
      };

    if (business) {
      const businessName = normalizeString(business.business_name);
      if (businessName) {
        config.businessName = businessName;
      }
      const greeting = normalizeString(business.greeting);
      if (greeting) {
        config.greeting = greeting;
      }
      const tonePreset = resolveTonePreset(business.tone);
      if (tonePreset) {
        config.tonePreset = tonePreset;
      }
      const businessLogoUrl = normalizeString(business.logo_url);
      if (businessLogoUrl) {
        // DB stores clean URL; responses add cache-bust for immediate logo refresh.
        config.logoUrl = withCacheBust(businessLogoUrl, Date.now());
      }
    }

    if (
      isSiroundChatDemoBot({
        widgetKey: configKey,
        businessName: config.businessName ?? business?.business_name ?? null
      })
    ) {
      Object.assign(config, getSiroundChatDemoWidgetOverrides(config.iconId ?? null));
    }

    // Attach quick buttons from botConfig so the embed widget can render them dynamically
    if (business?.onboarding_data) {
      const rawBotConfig = (business.onboarding_data as Record<string, unknown>).botConfig ?? null;
      const botConfig = resolveBotConfig(rawBotConfig);
      const enabledButtons = botConfig.quickButtons.filter((btn) => btn.enabled);
      if (enabledButtons.length > 0) {
        config.quickButtons = botConfig.quickButtons;
      }
    }

    const publicConfig = WidgetConfigSchema.parse(config);
    return NextResponse.json(publicConfig, {
      headers: NO_STORE_HEADERS
    });
  } catch (error) {
    console.error("[WIDGET_CONFIG_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to load widget config" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PUT(request: Request) {
  try {
    const authDisabled = isAuthDisabled();
    const supabase = getSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    const queryKey = searchParams.get("key");
    const querySiteId = searchParams.get("siteId");

    const json = await request.json().catch(() => null);
    const bodyKey = typeof json?.key === "string" ? json.key : null;
    const bodySiteId = typeof json?.siteId === "string" ? json.siteId : null;
    const explicitKey = queryKey ?? bodyKey;
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!authDisabled && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user && !(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = WidgetConfigSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), received: json }, { status: 400 });
    }

    if (authDisabled) {
      const configKey = explicitKey ?? bodySiteId ?? querySiteId;
      if (!configKey) {
        return NextResponse.json({ error: "Missing key" }, { status: 400 });
      }

      const toSave = {
        ...parsed.data,
        siteId: configKey,
        theme: parsed.data.theme ?? DEFAULT_THEME,
        greeting: parsed.data.greeting ?? "Hi there! How can I help?"
      };

      await saveWidgetConfig(toSave);
      return NextResponse.json({ success: true });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromSession(user.id);
    let businessId = tenant.businessId;
    if (!businessId) {
      const ensured = await ensureBusinessRow({ userId: user.id });
      businessId = ensured.businessId;
    }
    if (!businessId) {
      return NextResponse.json({ error: "Business not found for user" }, { status: 404 });
    }

    const allowed = await hasWidgetAccess(businessId);
    if (!allowed) {
      const access = await getBusinessEntitlementAccess(businessId, "chatbot_embed");
      return NextResponse.json(buildUpgradeRequiredPayload("chatbot_embed", access), { status: 403 });
    }

    const widgetKey = await ensureWidgetKeyForBusiness(businessId);
    if (!widgetKey) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }
    if (explicitKey && explicitKey !== widgetKey) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }
    if (!isUuid(widgetKey)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const toSave = {
      ...parsed.data,
      siteId: widgetKey,
      theme: parsed.data.theme ?? DEFAULT_THEME,
      greeting: parsed.data.greeting ?? "Hi there! How can I help?"
    };

    const admin = getSupabaseAdminClient();
    const { data: business, error: businessError } = await (admin as any)
      .from("businesses")
      .select("onboarding_data")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[WIDGET_CONFIG_BUSINESS_LOOKUP_ERROR]", businessError);
      return NextResponse.json({ error: "Failed to save widget config" }, { status: 500 });
    }

    const nextOnboardingData = setWidgetConfigInOnboardingData(business?.onboarding_data ?? null, toSave);

    const { error: updateError } = await (admin as any)
      .from("businesses")
      .update({
        onboarding_data: nextOnboardingData,
        updated_at: new Date().toISOString()
      })
      .eq("id", businessId);

    if (updateError) {
      console.error("[WIDGET_CONFIG_SAVE_ERROR]", updateError);
      return NextResponse.json({ error: "Failed to save widget config" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WIDGET_CONFIG_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to save widget config" }, { status: 500 });
  }
}
