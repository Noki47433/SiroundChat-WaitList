import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { WidgetConfigSchema } from "@/lib/validation/widget";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { ensureBusinessRow, getTenantFromSession } from "@/lib/utils/tenant";
import { getWidgetConfig, saveWidgetConfig } from "@/lib/utils/local-store";
import { isAuthDisabled } from "@/lib/config/auth";
import { FAQ_PRESETS } from "@/app/components/chatbot/chatbotFaqPresets"; // Default FAQs for preview fallback

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
    .select("id, business_name, greeting, tone, logo_url")
    .eq("widget_key", widgetKey)
    .maybeSingle();

  if (error) {
    console.error("[WIDGET_KEY_LOOKUP_ERROR]", error);
  }

  return (data as { id?: string; business_name?: string | null; greeting?: string | null; tone?: string | null; logo_url?: string | null } | null) ?? null;
};

const hasWidgetAccess = async (businessId: string) => {
  const access = await getBusinessEntitlementAccess(businessId, "chatbot_embed");
  return access.allowed;
};

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

    let business: { id?: string; business_name?: string | null; greeting?: string | null; tone?: string | null; logo_url?: string | null } | null = null;
    if (!authDisabled) {
      business = await resolveBusinessByWidgetKey(configKey);
      if (!business?.id) {
        return NextResponse.json({ error: "Widget not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      const allowed = await hasWidgetAccess(business.id);
      if (!allowed) {
        return NextResponse.json(
          { error: "Chatbot embed is not available on the current plan" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    const stored = await getWidgetConfig(configKey);
    const config: z.infer<typeof WidgetConfigSchema> =
      stored ?? {
        siteId: configKey,
        businessName: "SiroundChat demo",
        greeting: "Pershendetje 👋 We reply instantly thanks to SiroundChat.",
        launcherPosition: "right",
        launcherVariant: "iconWithLabel",
        businessType: "restaurant", // Default business type for preview content
        faqs: FAQ_PRESETS.restaurant, // Default FAQ list for preview responses
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
      return NextResponse.json({ error: "Chatbot embed is not available on the current plan" }, { status: 403 });
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

    await saveWidgetConfig(toSave);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WIDGET_CONFIG_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to save widget config" }, { status: 500 });
  }
}
