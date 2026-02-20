import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAnalyticsEvent } from "@/lib/analytics/events";
import { insertWebsiteAnalyticsEvent } from "@/lib/analytics/website-events";
import { log } from "@/lib/utils/log";

const WidgetOpenedSchema = z.object({
  key: z.string().uuid(),
  siteId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  pagePath: z.string().optional().nullable(),
  referrer: z.string().optional().nullable()
});

const ANALYTICS_DEBUG = process.env.ANALYTICS_DEBUG === "1";

const normalizePagePath = (value?: string | null, referrer?: string | null) => {
  const raw = value?.trim() || "";
  if (raw) {
    if (raw.startsWith("/")) return raw;
    try {
      return new URL(raw).pathname || "/";
    } catch {
      return `/${raw}`;
    }
  }
  if (referrer) {
    try {
      return new URL(referrer).pathname || "/";
    } catch {
      return "/";
    }
  }
  return "/";
};

const normalizeCountryCode = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === "XX" || trimmed === "UNKNOWN") return null;
  return trimmed.slice(0, 2);
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = WidgetOpenedSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { key, siteId, sessionId, pagePath, referrer } = parsed.data;

  const { data: business, error: bizError } = await (admin as any)
    .from("businesses")
    .select("id")
    .eq("widget_key", key)
    .maybeSingle();

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  if (!business?.id) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  let resolvedWebsiteSiteId: string | null = null;
  let resolvedBuilderSiteId: string | null = null;
  if (siteId) {
    const { data: websiteRow, error: websiteError } = await (admin as any)
      .from("websites")
      .select("id")
      .eq("id", siteId)
      .maybeSingle();
    if (websiteError) {
      log("error", "Failed to resolve websites.site_id", { error: websiteError });
    } else {
      resolvedWebsiteSiteId = websiteRow?.id ?? null;
    }

    const { data: builderRow, error: builderError } = await (admin as any)
      .from("builder_sites")
      .select("id")
      .eq("id", siteId)
      .maybeSingle();
    if (builderError) {
      log("error", "Failed to resolve builder_sites.site_id", { error: builderError });
    } else {
      resolvedBuilderSiteId = builderRow?.id ?? null;
    }
  }

  const dedupeWindowMs = 10 * 60 * 1000;
  const since = new Date(Date.now() - dedupeWindowMs).toISOString();
  let deduped = false;
  const resolvedSessionId = sessionId ?? randomUUID();
  const normalizedPagePath = normalizePagePath(pagePath ?? null, referrer ?? null);
  const userAgent = request.headers.get("user-agent");
  const countryCode = normalizeCountryCode(
    request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry") ??
      request.headers.get("x-country-code")
  );
  const city =
    request.headers.get("x-vercel-ip-city") ??
    request.headers.get("cf-ipcity") ??
    request.headers.get("x-city") ??
    null;

  if (sessionId) {
    const { data: existing, error: existingError } = await (admin as any)
      .from("analytics_events")
      .select("id")
      .eq("business_id", business.id)
      .eq("type", "widget_opened")
      .eq("session_id", sessionId)
      .filter("metadata->>session_id", "eq", sessionId)
      .gte("timestamp", since)
      .limit(1);

    if (existingError) {
      log("error", "Failed to check widget_opened dedupe", { error: existingError });
    } else if (existing?.length) {
      deduped = true;
    }
  }

  if (!deduped) {
    try {
      await insertAnalyticsEvent(admin as any, {
        businessId: business.id,
        siteId: resolvedWebsiteSiteId ?? null,
        type: "widget_opened",
        sessionId: sessionId ?? null,
        metadata: { source: "widget", session_id: sessionId ?? null }
      });
      await insertAnalyticsEvent(admin as any, {
        businessId: business.id,
        siteId: resolvedWebsiteSiteId ?? null,
        type: "chat_opened",
        sessionId: sessionId ?? null,
        metadata: { source: "widget", session_id: sessionId ?? null }
      });
      await insertWebsiteAnalyticsEvent(admin as any, {
        businessId: business.id,
        siteId: resolvedBuilderSiteId ?? null,
        pagePath: normalizedPagePath,
        pageTitle: null,
        eventType: "chat_open",
        channel: "chatbot",
        sessionId: resolvedSessionId,
        referrer: referrer ?? null,
        userAgent,
        countryCode,
        city
      });
    } catch (error) {
      log("error", "Failed to track widget_opened", { error });
    }
  }

  if (ANALYTICS_DEBUG) {
    log("info", "Widget opened event processed", {
      businessId: business.id,
      deduped,
      hasSessionId: Boolean(sessionId)
    });
  }

  return NextResponse.json({ success: true, deduped });
}
