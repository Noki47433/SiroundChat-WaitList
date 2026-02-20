import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureBusinessRow } from "@/lib/utils/tenant";
import { isAuthDisabled } from "@/lib/config/auth";

export const runtime = "nodejs";

const BUCKET = "business-logos";

const normalizeId = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const isFile = (value: FormDataEntryValue | null): value is File =>
  typeof File !== "undefined" && value instanceof File;

const resolveExtension = (file: File) => {
  const name = file.name ?? "";
  if (name.includes(".")) {
    const ext = name.split(".").pop();
    if (ext) return ext.toLowerCase();
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/webp") return "webp";
  return "png";
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

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseRouteClient();
    const admin = getSupabaseAdminClient();

    const authDisabled = isAuthDisabled();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!authDisabled && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // ---- file ----
    const fileEntry = formData.get("file");
    if (!isFile(fileEntry)) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }
    const file = fileEntry;

    // ---- businessId resolution ----
    const providedBusinessId = normalizeId(formData.get("businessId"));
    let businessId = "";

    if (authDisabled) {
      if (!providedBusinessId) {
        return NextResponse.json({ error: "businessId required" }, { status: 400 });
      }
      businessId = providedBusinessId;
    } else {
      // user exists here because authDisabled=false
      const tenant = await ensureBusinessRow({ userId: user!.id });
      businessId = tenant.businessId;

      if (providedBusinessId && providedBusinessId !== businessId) {
        return NextResponse.json({ error: "Business not found or not owned" }, { status: 403 });
      }
    }

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    // ---- upload ----
    const extension = resolveExtension(file);
    const storagePath = `logos/${businessId}/logo.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

    if (uploadRes.error) {
      console.error("[LOGO_UPLOAD_ERROR]", uploadRes.error);
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to resolve logo URL" }, { status: 500 });
    }

    // ---- persist url (cast to any so it compiles even if your Supabase client types are busted) ----
    const { error: updateError } = await (admin as any)
      .from("businesses")
      .update({ logo_url: publicUrl })
      .eq("id", businessId);

    if (updateError) {
      console.error("[LOGO_DB_UPDATE_ERROR]", updateError);
      return NextResponse.json({ error: "Failed to save logo" }, { status: 500 });
    }

    return NextResponse.json({ logoUrl: withCacheBust(publicUrl, Date.now()) });
  } catch (error) {
    console.error("[LOGO_UPLOAD_ROUTE_ERROR]", error);
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }
}