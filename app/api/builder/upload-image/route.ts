import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { BUILDER_ASSETS_BUCKET } from "@/lib/builder/storage";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";

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

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const kind: AssetKind = kindRaw;

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

  // ---- Upload ----
  const extension = resolveExtension(file);
  const fileName = `${kind}-${Date.now()}.${extension}`;
  const storagePath = `sites/${siteId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const admin = getSupabaseAdminClient();

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

  // ---- Save asset row ----
  const { error: assetError } = await (admin as any).from("builder_site_assets").insert({
    site_id: siteId,
    business_id: site.business_id,
    kind,
    url: publicUrl
  });

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

  return NextResponse.json({ url: publicUrl });
}
