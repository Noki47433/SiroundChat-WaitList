import { NextResponse } from "next/server";
import { z } from "zod";

import { embedText } from "@/lib/ai/embeddings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { ensureBusinessRow, getTenantFromSession } from "@/lib/tenant";
import { addEmbeddingsLocal } from "@/lib/utils/local-store";
import { isAuthDisabled } from "@/lib/config/auth";
import {
  buildUpgradeRequiredResponse,
  canAccessBillingWorkspace,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";

const IngestSchema = z
  .object({
    content: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    title: z.string().optional().nullable(),
    documentId: z.string().uuid().optional().nullable(),
    siteId: z.string().optional(),
    source: z.string().optional()
  })
  .refine((data) => data.content || data.text, { message: "content required" });

export async function POST(req: Request) {
  try {
    const authDisabled = isAuthDisabled();
    const supabase = getSupabaseRouteClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!authDisabled && !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = IngestSchema.parse(await req.json());

    let businessId = "";
    if (user) {
      const tenant = await getTenantFromSession(user.id);
      businessId = tenant.businessId;
      if (!businessId) {
        const ensured = await ensureBusinessRow({ userId: user.id });
        businessId = ensured.businessId;
      }
    } else if (authDisabled) {
      businessId = parsed.siteId ?? "";
    }

    if (!businessId) return NextResponse.json({ error: "Business not found for user" }, { status: 404 });

    if (user) {
      const canAccess = await canAccessBillingWorkspace(user.id, businessId);
      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const billingAccess = await getBusinessEntitlementAccess(businessId, "chatbot_knowledge_base");
      if (!billingAccess.allowed) {
        return buildUpgradeRequiredResponse("chatbot_knowledge_base", billingAccess);
      }
    }

    const CHUNK_LENGTH = 800;
    const text = (parsed.content ?? parsed.text ?? "").trim();

    const chunks = Array.from({ length: Math.ceil(text.length / CHUNK_LENGTH) }).map((_, i) => ({
      content: text.slice(i * CHUNK_LENGTH, i * CHUNK_LENGTH + CHUNK_LENGTH),
      chunk_index: i
    }));

    const chunkRows = chunks.map((chunk) => ({
      business_id: businessId,
      document_id: parsed.documentId ?? null,
      chunk_index: chunk.chunk_index,
      content: chunk.content
    }));

    if (authDisabled && !user) {
      const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.content)));
      const inserted = await addEmbeddingsLocal(
        businessId,
        chunks.map((chunk, index) => ({
          content: chunk.content,
          embedding: embeddings[index],
          metadata: {
            source: parsed.source ?? parsed.title ?? "demo",
            documentId: parsed.documentId ?? null
          }
        }))
      );

      return NextResponse.json({ success: true, inserted });
    }

    const admin = getSupabaseAdminClient();
    const { data: insertedChunks, error: insertError } = await (admin as any)
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, content");

    if (insertError || !insertedChunks) {
      throw insertError ?? new Error("Failed to insert chunks");
    }

    const inserted = insertedChunks as { id: string; content: string }[];
    const embeddings = await Promise.all(inserted.map((row) => embedText(row.content)));
    const embeddingRows = inserted.map((row, index) => ({
      chunk_id: row.id,
      business_id: businessId,
      embedding: embeddings[index]
    }));

    const { error: embeddingError } = await (admin as any)
      .from("document_chunk_embeddings")
      .insert(embeddingRows);

    if (embeddingError) {
      throw embeddingError;
    }

    return NextResponse.json({ success: true, inserted: inserted.length });
  } catch (err) {
    console.error("[KNOWLEDGE_INGEST_ERROR]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to ingest" },
      { status: 500 }
    );
  }
}
