import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { BUILDER_ASSETS_BUCKET } from "@/lib/builder/storage";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import {
  applyBuilderImageSlotToUrl,
  inferBuilderImageSlot,
  isBuilderImageSlot,
  isMissingBuilderAssetSlotColumnError,
  normalizeBuilderImageSlot,
  resolveAssetKindFromSlot
} from "@/lib/builder/site-assets";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const KIND_KEYS = ["logo", "hero", "gallery", "other"] as const;
type AssetKind = (typeof KIND_KEYS)[number];

function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && (KIND_KEYS as readonly string[]).includes(value);
}

function isFile(value: unknown): value is File {
  if (typeof value !== "object" || value === null) return false;

  const v = value as {
    arrayBuffer?: unknown;
    type?: unknown;
    size?: unknown;
  };

  return (
    typeof v.arrayBuffer === "function" &&
    typeof v.type === "string" &&
    typeof v.size === "number"
  );
}

const resolveExtension = (file: File) => {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "png";
};

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId")?.trim() ?? "";
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const site = await getOwnedBuilderSite<{ id: string; business_id: string }>(
    siteId,
    userData.user.id,
    "id,business_id"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  let { data, error } = await (supabase as any)
    .from("builder_site_assets")
    .select("id,kind,target_slot,url,created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (isMissingBuilderAssetSlotColumnError(error)) {
    const fallback = await (supabase as any)
      .from("builder_site_assets")
      .select("id,kind,url,created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });
    data = (fallback.data ?? []).map(
      (asset: { id: string; kind?: string | null; url?: string | null; created_at?: string | null }) => ({
        ...asset,
        target_slot: inferBuilderImageSlot({
          kind: asset.kind,
          url: asset.url
        })
      })
    );
    error = fallback.error;
  }

  if (error) {
    console.error("[BUILDER_ASSET_LIST_ERROR]", error);
    return NextResponse.json({ error: "Failed to load assets" }, { status: 500 });
  }

  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();

  // ---- siteId ----
  const siteIdRaw = formData.get("siteId");
  const siteId = typeof siteIdRaw === "string" ? siteIdRaw : "";
  if (!siteId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ---- kind ----
  const kindRaw = formData.get("kind");
  if (!isAssetKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  let kind: AssetKind = kindRaw;
  const slotRaw = formData.get("slot");
  const targetSlot = normalizeBuilderImageSlot(
    typeof slotRaw === "string" ? slotRaw : null,
    kind === "hero" ? "hero" : kind === "gallery" ? "gallery" : "auto"
  );
  if (kind !== "logo") {
    kind = resolveAssetKindFromSlot(targetSlot);
  }

  // ---- file ----
  const fileRaw = formData.get("file");
  if (!isFile(fileRaw)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const file: File = fileRaw as File;

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  // ---- Confirm site exists & user can access it (RLS via route client) ----
  const site = await getOwnedBuilderSite<{ id: string; business_id: string }>(
    siteId,
    userData.user.id,
    "id,business_id"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  // ---- Upload ----
  const extension = resolveExtension(file);
  const fileName = `${kind}-${Date.now()}.${extension}`;
  const storagePath = `sites/${siteId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    console.error("[BUILDER_UPLOAD_IMAGE_CONFIG_MISSING]", { siteId, userId: userData.user.id });
    return NextResponse.json({ error: "Image uploads are unavailable right now." }, { status: 500 });
  }

  const uploadRes = await admin.storage.from(BUILDER_ASSETS_BUCKET).upload(storagePath, Buffer.from(arrayBuffer), {
    contentType: file.type || "application/octet-stream",
    upsert: true
  });

  if (uploadRes.error) {
    console.error("[BUILDER_UPLOAD_IMAGE_ERROR]", uploadRes.error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from(BUILDER_ASSETS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData?.publicUrl;

  if (!publicUrl) {
    return NextResponse.json({ error: "Failed to resolve image URL" }, { status: 500 });
  }
  const persistedUrl = kind === "logo" ? publicUrl : applyBuilderImageSlotToUrl(publicUrl, targetSlot);

  // ---- Save asset row ----
  let { error: assetError } = await (admin as any).from("builder_site_assets").insert({
    site_id: siteId,
    business_id: site.business_id,
    kind,
    target_slot: targetSlot,
    url: persistedUrl
  });

  if (isMissingBuilderAssetSlotColumnError(assetError)) {
    const fallbackInsert = await (admin as any).from("builder_site_assets").insert({
      site_id: siteId,
      business_id: site.business_id,
      kind,
      url: persistedUrl
    });
    assetError = fallbackInsert.error;
  }

  if (assetError) {
    console.error("[BUILDER_ASSET_INSERT_ERROR]", assetError);
    return NextResponse.json({ error: "Failed to save asset" }, { status: 500 });
  }

  // ---- If logo, persist on builder_sites ----
  if (kind === "logo") {
    const { error: logoError } = await (admin as any)
      .from("builder_sites")
      .update({ logo_url: publicUrl })
      .eq("id", siteId);

    if (logoError) {
      console.error("[BUILDER_LOGO_UPDATE_ERROR]", logoError);
      return NextResponse.json({ error: "Failed to save logo" }, { status: 500 });
    }
  }

  return NextResponse.json({ url: persistedUrl, kind, targetSlot });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId.trim() : "";
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const targetSlot = typeof body?.targetSlot === "string" ? body.targetSlot.trim() : "";

  if (!siteId || !assetId || !isBuilderImageSlot(targetSlot)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const site = await getOwnedBuilderSite<{ id: string; business_id: string }>(
    siteId,
    userData.user.id,
    "id,business_id"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    return NextResponse.json({ error: "Image updates are unavailable right now." }, { status: 500 });
  }

  const nextKind = resolveAssetKindFromSlot(targetSlot);

  const { data: assetRows, error: assetRowsError } = await (admin as any)
    .from("builder_site_assets")
    .select("id,kind,url")
    .eq("site_id", siteId);

  if (assetRowsError) {
    console.error("[BUILDER_ASSET_SLOT_LOAD_ERROR]", assetRowsError);
    return NextResponse.json({ error: "Failed to update image slot" }, { status: 500 });
  }

  const currentAsset = (assetRows ?? []).find(
    (asset: { id?: string | null }) => asset.id === assetId
  ) as { id: string; kind?: string | null; url?: string | null } | undefined;

  if (!currentAsset?.id) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (targetSlot === "hero") {
    let { error: resetError } = await (admin as any)
      .from("builder_site_assets")
      .update({ target_slot: "auto", kind: "gallery" })
      .eq("site_id", siteId)
      .eq("target_slot", "hero")
      .neq("id", assetId);

    if (isMissingBuilderAssetSlotColumnError(resetError)) {
      resetError = null;
      for (const asset of assetRows ?? []) {
        const typedAsset = asset as { id?: string | null; kind?: string | null; url?: string | null };
        if (!typedAsset.id || typedAsset.id === assetId) continue;
        const inferredSlot = inferBuilderImageSlot({
          kind: typedAsset.kind,
          url: typedAsset.url
        });
        if (inferredSlot !== "hero") continue;
        const fallbackReset = await (admin as any)
          .from("builder_site_assets")
          .update({
            kind: "gallery",
            url: applyBuilderImageSlotToUrl(typedAsset.url ?? "", "auto")
          })
          .eq("id", typedAsset.id)
          .eq("site_id", siteId);
        if (fallbackReset.error) {
          resetError = fallbackReset.error;
          break;
        }
      }
    }

    if (resetError) {
      console.error("[BUILDER_ASSET_SLOT_RESET_ERROR]", resetError);
      return NextResponse.json({ error: "Failed to update image slot" }, { status: 500 });
    }
  }

  let { data, error } = await (admin as any)
    .from("builder_site_assets")
    .update({
      target_slot: targetSlot,
      kind: nextKind,
      url: applyBuilderImageSlotToUrl(currentAsset.url ?? "", targetSlot)
    })
    .eq("id", assetId)
    .eq("site_id", siteId)
    .select("id,kind,target_slot,url,created_at")
    .maybeSingle();

  if (isMissingBuilderAssetSlotColumnError(error)) {
    const fallbackUpdate = await (admin as any)
      .from("builder_site_assets")
      .update({
        kind: nextKind,
        url: applyBuilderImageSlotToUrl(currentAsset.url ?? "", targetSlot)
      })
      .eq("id", assetId)
      .eq("site_id", siteId)
      .select("id,kind,url,created_at")
      .maybeSingle();

    data = fallbackUpdate.data
      ? {
          ...fallbackUpdate.data,
          target_slot: inferBuilderImageSlot({
            kind: nextKind,
            url: (fallbackUpdate.data as { url?: string | null }).url
          })
        }
      : null;
    error = fallbackUpdate.error;
  }

  if (error) {
    console.error("[BUILDER_ASSET_SLOT_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Failed to update image slot" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ asset: data });
}
