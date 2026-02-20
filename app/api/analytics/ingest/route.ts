import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertWebsiteAnalyticsEvent } from "@/lib/analytics/website-events";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

const EventTypeSchema = z.enum(["page_view", "cta_click", "lead_submitted", "chat_open", "chat_started"]);
const ChannelSchema = z.enum(["website", "chatbot", "form"]);
const CtaTypeSchema = z.enum(["call", "whatsapp", "email", "directions", "booking", "other"]);
const LeadTypeSchema = z.enum(["form", "chat"]);

const IngestSchema = z
  .object({
    businessId: z.string().uuid().optional(),
    widgetKey: z.string().uuid().optional(),
    siteId: z.string().uuid().optional().nullable(),
    pagePath: z.string().min(1),
    pageTitle: z.string().optional().nullable(),
    eventType: EventTypeSchema,
    channel: ChannelSchema,
    ctaType: CtaTypeSchema.optional().nullable(),
    leadType: LeadTypeSchema.optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    sessionId: z.string().min(8),
    referrer: z.string().optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (!value.businessId && !value.widgetKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "businessId or widgetKey required", path: ["businessId"] });
    }

    if (value.eventType === "page_view" && value.channel !== "website") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "page_view must use website channel", path: ["channel"] });
    }

    if ((value.eventType === "chat_open" || value.eventType === "chat_started") && value.channel !== "chatbot") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "chat events must use chatbot channel", path: ["channel"] });
    }

    if (value.eventType === "lead_submitted") {
      if (!value.leadType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "leadType required for lead_submitted", path: ["leadType"] });
      }
      if (value.leadType === "form" && value.channel !== "form") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "form leads must use form channel", path: ["channel"] });
      }
      if (value.leadType === "chat" && value.channel !== "chatbot") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "chat leads must use chatbot channel", path: ["channel"] });
      }
    }
  });

const normalizePagePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      return url.pathname || "/";
    }
  } catch {
    // ignore
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (!withoutQuery.startsWith("/")) {
    return `/${withoutQuery}`;
  }
  return withoutQuery;
};

const getHeaderValue = (request: Request, keys: string[]) => {
  for (const key of keys) {
    const value = request.headers.get(key);
    if (value) return value;
  }
  return null;
};

const normalizeCountryCode = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === "XX" || trimmed === "UNKNOWN") return null;
  return trimmed.slice(0, 2);
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = IngestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await enforceRateLimit({ key: `website-analytics:${parsed.data.sessionId}`, limit: 120, windowInSeconds: 60 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    throw error;
  }

  const admin = getSupabaseAdminClient();
  const { businessId, widgetKey, siteId, pagePath, pageTitle, eventType, channel, ctaType, leadType, leadId, sessionId } =
    parsed.data;

  let resolvedBusinessId = businessId ?? null;
  if (widgetKey) {
    const { data: business, error } = await (admin as any)
      .from("businesses")
      .select("id")
      .eq("widget_key", widgetKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!business?.id) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    if (resolvedBusinessId && resolvedBusinessId !== business.id) {
      return NextResponse.json({ error: "Business mismatch" }, { status: 403 });
    }

    resolvedBusinessId = business.id as string;
  }

  if (!resolvedBusinessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (siteId) {
    const { data: site, error } = await (admin as any)
      .from("builder_sites")
      .select("id, business_id")
      .eq("id", siteId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!site?.id) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (site.business_id !== resolvedBusinessId) {
      return NextResponse.json({ error: "Site mismatch" }, { status: 403 });
    }
  }

  const userAgent = request.headers.get("user-agent");
  const referrer = parsed.data.referrer ?? request.headers.get("referer") ?? null;
  const countryCode = normalizeCountryCode(
    getHeaderValue(request, ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"])
  );
  const city = getHeaderValue(request, ["x-vercel-ip-city", "cf-ipcity", "x-city"]) ?? null;

  try {
    await insertWebsiteAnalyticsEvent(admin as any, {
      businessId: resolvedBusinessId,
      siteId: siteId ?? null,
      pagePath: normalizePagePath(pagePath).slice(0, 300),
      pageTitle: pageTitle?.slice(0, 140) ?? null,
      eventType,
      channel,
      ctaType: ctaType ?? (eventType === "cta_click" ? "other" : null),
      leadType: leadType ?? null,
      leadId: leadId ?? null,
      sessionId,
      userAgent,
      referrer,
      countryCode,
      city
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to insert event";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
