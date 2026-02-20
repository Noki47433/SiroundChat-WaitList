import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { processDocument } from "@/lib/ai/document-processing";
import { log } from "@/lib/utils/log";
import { isAuthDisabled } from "@/lib/config/auth";

const BUCKET = "business-docs";

export const runtime = "nodejs";

const normalizeUuid = (value: string | null) => (value ?? "").trim().replace(/[<>]/g, "");
const isFile = (value: FormDataEntryValue): value is File => typeof File !== "undefined" && value instanceof File;

export async function POST(request: Request) {
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
  const businessId = normalizeUuid(typeof formData.get("businessId") === "string" ? (formData.get("businessId") as string) : "");
  const files = formData.getAll("files").filter(isFile);

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  if (user) {
    // Verify business ownership (single-owner). For team access, extend to membership table.
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found or not owned" }, { status: 403 });
    }
  }

  const createdDocs = [] as any[];

  for (const file of files) {
    const documentId = randomUUID();
    const storagePath = `${businessId}/${documentId}/${file.name}`;

    const { error: insertError, data: inserted } = await (admin as any)
      .from("documents")
      .insert({
        id: documentId,
        business_id: businessId,
        user_id: user?.id ?? null,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        status: "uploaded"
      })
      .select()
      .single();

    if (insertError || !inserted) {
      log("error", "Document insert failed", { insertError });
      return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

    if (uploadRes.error) {
      log("error", "Storage upload failed", { uploadError: uploadRes.error.message });
      await admin.from("documents").delete().eq("id", documentId);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    console.log("[DOC] queued", { documentId });
    void processDocument(documentId).catch((error) => {
      log("error", "Document processing failed in upload", {
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    createdDocs.push(inserted);
  }

  return NextResponse.json({ documents: createdDocs });
}

// IMPORTANT: Storage bucket "business-docs" must be private; reads happen server-side.
