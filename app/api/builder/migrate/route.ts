import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/tenant";
import { saveWidgetConfig } from "@/lib/utils/local-store";
import { isAuthDisabled } from "@/lib/config/auth";

const DEFAULT_THEME = {
  primary: "#00A3FF",
  accent: "#38BDF8",
  secondary: "#111827",
  background: "#0B1222",
  text: "#FFFFFF",
  shape: "rounded" as const
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

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const authDisabled = isAuthDisabled();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !authDisabled) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user && !(await userHasLaunchAccess(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const builderConfig = payload?.builderConfig;
  if (!builderConfig || typeof builderConfig !== "object") {
    return NextResponse.json({ error: "Missing builder config" }, { status: 400 });
  }

  const businessName =
    typeof builderConfig.businessName === "string" && builderConfig.businessName.trim()
      ? builderConfig.businessName.trim()
      : "Your business";
  const greeting =
    typeof builderConfig.greeting === "string" && builderConfig.greeting.trim()
      ? builderConfig.greeting.trim()
      : "Hi there! How can I help?";
  const businessType = typeof builderConfig.businessType === "string" ? builderConfig.businessType : null;
  const logoUrl =
    typeof builderConfig.logoUrl === "string"
      ? builderConfig.logoUrl
      : builderConfig.logoUrl === null
        ? null
        : null;
  const tone = typeof builderConfig.tone === "string" ? builderConfig.tone : null;

  let businessId = "";
  let widgetKey = "";

  if (user) {
    const tenant = await ensureBusinessRow({ userId: user.id, businessName, industry: businessType ?? undefined });
    businessId = tenant.businessId;

    if (businessId) {
      const { data: business, error: businessError } = await (supabase as any)
        .from("businesses")
        .select("widget_key")
        .eq("id", businessId)
        .maybeSingle();

      if (businessError) {
        console.error("[BUILDER_MIGRATE_LOOKUP_ERROR]", businessError);
      }

      widgetKey = business?.widget_key ?? "";
      if (!widgetKey) {
        const generatedKey = generateWidgetKey();
        const { error: updateError } = await (supabase as any)
          .from("businesses")
          .update({ widget_key: generatedKey })
          .eq("id", businessId);
        if (updateError) {
          console.error("[BUILDER_MIGRATE_WIDGET_KEY_ERROR]", updateError);
        } else {
          widgetKey = generatedKey;
        }
      }

      const updatePayload: Record<string, unknown> = {
        business_name: businessName,
        greeting,
        logo_url: logoUrl,
        industry: businessType ?? null
      };
      if (tone) updatePayload.tone = tone;

      const { error: updateError } = await (supabase as any)
        .from("businesses")
        .update(updatePayload)
        .eq("id", businessId);

      if (updateError) {
        console.error("[BUILDER_MIGRATE_BUSINESS_ERROR]", updateError);
      }
    }
  }

  if (!widgetKey) {
    widgetKey = generateWidgetKey();
  }

  const theme = builderConfig.theme ?? {};
  const shape =
    builderConfig.launcherShape === "pill"
      ? "pill"
      : builderConfig.launcherShape === "square"
        ? "square"
        : "rounded";

  await saveWidgetConfig({
    siteId: widgetKey,
    businessName,
    greeting,
    theme: {
      primary: typeof theme.primaryColor === "string" ? theme.primaryColor : DEFAULT_THEME.primary,
      accent: typeof theme.accentColor === "string" ? theme.accentColor : DEFAULT_THEME.accent,
      secondary: typeof theme.accentColor === "string" ? theme.accentColor : DEFAULT_THEME.secondary,
      background: typeof theme.backgroundColor === "string" ? theme.backgroundColor : DEFAULT_THEME.background,
      text: typeof theme.textColor === "string" ? theme.textColor : DEFAULT_THEME.text,
      shape
    },
    businessType: businessType ?? undefined,
    faqs: Array.isArray(builderConfig.faqs) ? builderConfig.faqs : undefined,
    launcherVariant: builderConfig.launcherVariant,
    logoUrl,
    iconId: builderConfig.iconId ?? null
  });

  return NextResponse.json({ ok: true, businessId, widgetKey });
}
