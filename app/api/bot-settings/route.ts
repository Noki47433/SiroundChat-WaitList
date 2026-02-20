import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureBusinessRow } from "@/lib/utils/tenant";
import { isAuthDisabled } from "@/lib/config/auth";
import { getWidgetConfig, saveWidgetConfig } from "@/lib/utils/local-store";
import type { WidgetTheme } from "@/lib/types/core";
import { logActivity } from "@/lib/activity/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ================== SCHEMAS ================== */

const TonePresetSchema = z.enum(["professional", "friendly", "luxury", "short_direct", "energetic"]);

const ThemeConfigSchema = z.object({
  primaryColor: z.string().min(1),
  accentColor: z.string().min(1),
  backgroundColor: z.string().min(1),
  textColor: z.string().min(1)
});

const UpdateBotSettingsSchema = z.object({
  businessName: z.string().min(1).max(80).optional(),
  greeting: z.string().min(1).max(240).optional(),
  tonePreset: TonePresetSchema.optional(),
  theme: ThemeConfigSchema.optional()
});

type TonePreset = z.infer<typeof TonePresetSchema>;
type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

type BusinessRow = {
  id: string;
  business_name: string | null;
  greeting: string | null;
  tone: string | null;
  logo_url: string | null;
  widget_key: string | null;
};

/**
 * IMPORTANT:
 * Your WidgetTheme requires secondary:string (per your TS error).
 * So we keep a fully-defined theme type internally and never allow undefined.
 */
type StoredTheme = {
  primary: string;
  accent: string;
  secondary: string;
  background: string;
  text: string;
  shape: "rounded" | "pill" | "square";
};

/* ================== DEFAULTS ================== */

const DEFAULT_BUSINESS_NAME = "SiroundChat";
const DEFAULT_GREETING = "Hi! I can help with demos, pricing, and support questions.";
const DEFAULT_TONE: TonePreset = "friendly";

/**
 * Fully-defined default theme.
 * Also satisfies WidgetTheme, so it's always compatible with the rest of your codebase.
 */
const DEFAULT_STORED_THEME: StoredTheme = {
  primary: "#00A3FF",
  accent: "#38BDF8",
  secondary: "#111827",
  background: "#0B1222",
  text: "#FFFFFF",
  shape: "rounded"
};

/* ================== HELPERS ================== */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

const jsonNoStore = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) }
  });

const normalizeBusinessName = (v: string | null): string => v?.trim() || DEFAULT_BUSINESS_NAME;
const normalizeGreeting = (v: string | null): string => v?.trim() || DEFAULT_GREETING;

const resolveTonePreset = (tone: string | null): TonePreset =>
  TonePresetSchema.options.includes(tone as TonePreset) ? (tone as TonePreset) : DEFAULT_TONE;

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

const withCacheBust = (url: string) => `${url}?v=${Date.now()}`;

/**
 * Normalize ANY partial theme into a fully-defined StoredTheme.
 * Accepts Partial<WidgetTheme> because stored?.theme is typically that.
 */
const normalizeStoredTheme = (input?: Partial<WidgetTheme> | null): StoredTheme => {
  const primary = input?.primary ?? DEFAULT_STORED_THEME.primary;

  const accent =
    input?.accent ??
    input?.secondary ?? // if your system used secondary as accent sometimes
    primary ??
    DEFAULT_STORED_THEME.accent;

  const secondary =
    input?.secondary ??
    accent ??
    primary ??
    DEFAULT_STORED_THEME.secondary;

  const background = input?.background ?? DEFAULT_STORED_THEME.background;
  const text = input?.text ?? DEFAULT_STORED_THEME.text;

  const shape: StoredTheme["shape"] = input?.shape ?? DEFAULT_STORED_THEME.shape;

  return { primary, accent, secondary, background, text, shape };
};

const toThemeConfig = (theme?: Partial<WidgetTheme> | null): ThemeConfig => {
  const safe = normalizeStoredTheme(theme);
  return {
    primaryColor: safe.primary,
    accentColor: safe.accent,
    backgroundColor: safe.background,
    textColor: safe.text
  };
};

/**
 * Build a StoredTheme from ThemeConfig + optional base theme (stored theme).
 * Ensures secondary is ALWAYS a string (required by your WidgetTheme).
 */
const toStoredThemeFromConfig = (cfg: ThemeConfig, base?: Partial<WidgetTheme> | null): StoredTheme => {
  const merged: Partial<WidgetTheme> = {
    ...(base ?? {}),
    primary: cfg.primaryColor,
    accent: cfg.accentColor,
    secondary: cfg.accentColor,
    background: cfg.backgroundColor,
    text: cfg.textColor
  };

  return normalizeStoredTheme(merged);
};

/* ================== DB HELPERS ================== */

const fetchBusinessRow = async (admin: any, businessId: string) => {
  const { data, error } = await (admin as any)
    .from("businesses")
    .select("id, business_name, greeting, tone, logo_url, widget_key")
    .eq("id", businessId)
    .single();

  if (error) return null;
  return data as BusinessRow;
};

const ensureWidgetKey = async (admin: any, row: BusinessRow) => {
  if (row.widget_key) return row.widget_key;

  const key = generateWidgetKey();
  await (admin as any)
    .from("businesses")
    .update({ widget_key: key })
    .eq("id", row.id);

  return key;
};

/* ================== GET ================== */

export async function GET() {
  try {
    const supabase = getSupabaseRouteClient();
    const admin = getSupabaseAdminClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user && !isAuthDisabled()) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = user ? await ensureBusinessRow({ userId: user.id }) : null;
    if (!tenant?.businessId) {
      return jsonNoStore({ error: "Business not found" }, { status: 404 });
    }

    const row = await fetchBusinessRow(admin, tenant.businessId);
    if (!row) {
      return jsonNoStore({ error: "Business not found" }, { status: 404 });
    }

    const widgetKey = await ensureWidgetKey(admin, row);
    const stored = await getWidgetConfig(widgetKey);

    const safeTheme = normalizeStoredTheme(stored?.theme ?? DEFAULT_STORED_THEME);

    return jsonNoStore({
      businessId: row.id,
      businessName: normalizeBusinessName(row.business_name),
      greeting: normalizeGreeting(row.greeting),
      tonePreset: resolveTonePreset(row.tone),
      logoUrl: row.logo_url ? withCacheBust(row.logo_url) : null,
      theme: toThemeConfig(safeTheme)
    });
  } catch (err) {
    console.error(err);
    return jsonNoStore({ error: "Failed to load bot settings" }, { status: 500 });
  }
}

/* ================== PATCH ================== */

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabaseRouteClient();
    const admin = getSupabaseAdminClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user && !isAuthDisabled()) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = user ? await ensureBusinessRow({ userId: user.id }) : null;
    if (!tenant?.businessId) {
      return jsonNoStore({ error: "Business not found" }, { status: 404 });
    }

    const parsed = UpdateBotSettingsSchema.parse(await req.json());

    // Supabase typing in your repo is not wired -> use (admin as any)
    const updates: any = {};
    if (parsed.businessName) updates.business_name = parsed.businessName;
    if (parsed.greeting) updates.greeting = parsed.greeting;
    if (parsed.tonePreset) updates.tone = parsed.tonePreset;

    if (Object.keys(updates).length) {
      await (admin as any)
        .from("businesses")
        .update(updates)
        .eq("id", tenant.businessId);
    }

    const row = await fetchBusinessRow(admin, tenant.businessId);
    if (!row) {
      return jsonNoStore({ error: "Business not found" }, { status: 404 });
    }

    const widgetKey = await ensureWidgetKey(admin, row);
    const stored = await getWidgetConfig(widgetKey);

    let safeTheme = normalizeStoredTheme(stored?.theme ?? DEFAULT_STORED_THEME);

    if (parsed.theme) {
      safeTheme = toStoredThemeFromConfig(parsed.theme, stored?.theme);

      // LocalWidgetConfig usually requires greeting/businessName to be string (NOT undefined)
      await saveWidgetConfig({
        ...(stored ?? {}),
        siteId: widgetKey,
        greeting: normalizeGreeting(row.greeting),
        businessName: normalizeBusinessName(row.business_name),
        theme: safeTheme as unknown as WidgetTheme, // safeTheme satisfies WidgetTheme requirements in your repo
        logoUrl: row.logo_url ?? null,
        iconId: stored?.iconId ?? null
      });
    }

    await logActivity({
      businessId: tenant.businessId,
      userId: user?.id ?? null,
      actorType: "business_user",
      eventType: "chatbot_edit",
      summary: "Updated chatbot settings",
      meta: {
        updated_fields: Object.keys(parsed)
      }
    });

    return jsonNoStore({
      businessId: row.id,
      businessName: normalizeBusinessName(row.business_name),
      greeting: normalizeGreeting(row.greeting),
      tonePreset: resolveTonePreset(row.tone),
      logoUrl: row.logo_url ? withCacheBust(row.logo_url) : null,
      theme: toThemeConfig(safeTheme)
    });
  } catch (err) {
    console.error(err);
    return jsonNoStore({ error: "Failed to save bot settings" }, { status: 500 });
  }
}
