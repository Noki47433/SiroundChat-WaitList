import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { resolveLiveChat } from "@/lib/website-builder/live-chat";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  siteDocument: SiteDocumentSchema
});

const BUILDER_TONE_VALUES = ["friendly", "premium", "corporate", "bold", "minimal"] as const;

const isBuilderToneValue = (value: unknown): value is (typeof BUILDER_TONE_VALUES)[number] =>
  typeof value === "string" && BUILDER_TONE_VALUES.includes(value as (typeof BUILDER_TONE_VALUES)[number]);

const normalizeBuilderTone = (
  ...candidates: Array<unknown>
): (typeof BUILDER_TONE_VALUES)[number] | null => {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) continue;
    if (isBuilderToneValue(normalized)) {
      return normalized;
    }
    if (
      normalized.includes("premium") ||
      normalized.includes("lux") ||
      normalized.includes("elegant") ||
      normalized.includes("restrained")
    ) {
      return "premium";
    }
    if (
      normalized.includes("friend") ||
      normalized.includes("warm") ||
      normalized.includes("cozy") ||
      normalized.includes("family")
    ) {
      return "friendly";
    }
    if (
      normalized.includes("corporate") ||
      normalized.includes("professional") ||
      normalized.includes("credible") ||
      normalized.includes("practical")
    ) {
      return "corporate";
    }
    if (
      normalized.includes("bold") ||
      normalized.includes("urban") ||
      normalized.includes("lively") ||
      normalized.includes("sharp")
    ) {
      return "bold";
    }
    if (
      normalized.includes("minimal") ||
      normalized.includes("clean") ||
      normalized.includes("calm") ||
      normalized.includes("modern")
    ) {
      return "minimal";
    }
  }

  return null;
};

const getMissingBuilderColumnName = (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? (error as { code?: unknown }).code : "";
  const message = "message" in error ? (error as { message?: unknown }).message : "";
  if (code !== "PGRST204" || typeof message !== "string") return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
};

const updateBuilderSiteWithCompatibleColumns = async (
  admin: any,
  siteId: string,
  values: Record<string, unknown>
) => {
  const nextValues = { ...values };

  while (Object.keys(nextValues).length > 0) {
    const { error } = await admin.from("builder_sites").update(nextValues).eq("id", siteId);
    if (!error) {
      return null;
    }

    const missingColumn = getMissingBuilderColumnName(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(nextValues, missingColumn)) {
      delete nextValues[missingColumn];
      continue;
    }

    return error;
  }

  return new Error("No compatible builder_sites columns available for draft save");
};

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseRouteClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await userHasLaunchAccess(userData.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { siteId, siteDocument } = parsed.data;

    const site = await getOwnedBuilderSite<{ id: string; business_id: string; site_document: unknown; tone?: string | null }>(
      siteId,
      userData.user.id,
      "id,business_id,site_document,tone"
    );

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const admin = getSupabaseServerAdminClient() as any;
    const existingDocument = SiteDocumentSchema.safeParse(site.site_document).success
      ? SiteDocumentSchema.parse(site.site_document)
      : null;

    const mergedDocument = {
      ...(existingDocument ?? {}),
      ...siteDocument,
      apps: siteDocument.apps ?? existingDocument?.apps ?? [],
      seo: siteDocument.seo ?? existingDocument?.seo,
      customCode: siteDocument.customCode ?? existingDocument?.customCode,
      mediaLibrary: siteDocument.mediaLibrary ?? existingDocument?.mediaLibrary
    };

    const { data: business } = await admin
      .from("businesses")
      .select("widget_key")
      .eq("id", site.business_id)
      .maybeSingle();

    const liveChat = resolveLiveChat(mergedDocument, { widgetKey: business?.widget_key ?? null });
    if (liveChat.error) {
      return NextResponse.json({ error: liveChat.error }, { status: 400 });
    }

    const normalizedDocument = liveChat.document;
    const persistedTone = normalizeBuilderTone(
      site.tone,
      normalizedDocument.siteBrief?.generationBrief?.tone,
      normalizedDocument.siteBrief?.tone,
      normalizedDocument.tone
    );

    const draftUpdate = {
      template_id: normalizedDocument.templateId,
      tone: persistedTone,
      site_document: normalizedDocument,
      primary_color: normalizedDocument.theme?.primary ?? null,
      secondary_color: normalizedDocument.theme?.bg ?? null,
      font_family: normalizedDocument.theme?.fontBody ?? null,
      seo_title: normalizedDocument.seo?.title ?? null,
      seo_description: normalizedDocument.seo?.description ?? null
    };

    const error = await updateBuilderSiteWithCompatibleColumns(admin, siteId, draftUpdate);

    if (error) {
      console.error("[BUILDER_SAVE_DRAFT_ERROR]", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error && typeof (error as any).message === "string"
            ? (error as any).message
            : "Failed to save draft";
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Failed to save draft" : message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[BUILDER_SAVE_DRAFT_UNHANDLED]", error);
    const message =
      error instanceof Error ? error.message : "Failed to save draft";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Failed to save draft" : message },
      { status: 500 }
    );
  }
}
