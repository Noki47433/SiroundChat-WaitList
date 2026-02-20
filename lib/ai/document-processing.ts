import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/ai/chunk";
import { log } from "@/lib/utils/log";

/**
 * IMPORTANT
 * - This file requires Node.js runtime (Buffer, pdf-parse, mammoth).
 * - Any Next.js route that calls processDocument() MUST be Node runtime.
 *   If you ever move the caller to Edge, it will break.
 */

const BUCKET = "business-docs";
const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims ✅ matches vector(1536)
const MAX_CHARS = 1200;
const OVERLAP = 150;

// Insert batching (prevents huge payload failures)
const CHUNK_INSERT_BATCH = 200;
const EMBED_BATCH = 32;
const EMBED_INSERT_BATCH = 200;

// If a chunk is smaller than this, it's almost always garbage ("ill.", ".", etc.)
const MIN_CHUNK_CHARS = 40;

// Create client once
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

type DocumentRow = {
  id: string;
  business_id: string;
  user_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
};

type ChunkRow = {
  document_id: string;
  business_id: string;
  chunk_index: number;
  content: string;
};

type InsertedChunkRow = {
  id: string;
  chunk_index: number;
  content: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizePdfText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Fast parse: cheapest, sometimes misses table rows / later pages depending on PDF structure.
 */
async function extractPdfFast(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer, { max: 0 } as any);
  return normalizePdfText(result.text || "");
}

/**
 * Layout parse: uses pdf.js page renderer and groups text items into lines.
 * This preserves tables MUCH better.
 */
async function extractPdfLayout(buffer: Buffer): Promise<string> {
  const options: any = {
    max: 0,
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });

      const items = (textContent.items || []).map((item: any) => {
        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        return {
          str: (item.str ?? "").toString(),
          x: transform[4] ?? 0,
          y: transform[5] ?? 0
        };
      });

      items.sort((a: any, b: any) => {
        const yA = Math.round(a.y);
        const yB = Math.round(b.y);
        if (yA !== yB) return yB - yA;
        return a.x - b.x;
      });

      const lines: string[] = [];
      let currentY: number | null = null;
      let currentLine: string[] = [];

      const flushLine = () => {
        const line = currentLine.join(" ").replace(/[ \t]{2,}/g, " ").trim();
        if (line) lines.push(line);
        currentLine = [];
      };

      for (const item of items) {
        const y = Math.round(item.y);
        if (currentY === null) currentY = y;

        if (Math.abs(y - currentY) >= 2) {
          flushLine();
          currentY = y;
        }

        const text = (item.str || "").trim();
        if (text) currentLine.push(text);
      }

      flushLine();
      return lines.join("\n") + "\n\n";
    }
  };

  const result = await pdfParse(buffer, options);
  return normalizePdfText(result.text || "");
}

function scoreExtractedText(text: string): number {
  const lower = text.toLowerCase();
  const newlineCount = (text.match(/\n/g) || []).length;
  const digitCount = (text.match(/\d/g) || []).length;

  let score = 0;
  if (lower.includes("whatsapp")) score += 50;
  if (lower.includes("phone")) score += 50;
  if (lower.includes("email")) score += 50;
  if (lower.includes("+383")) score += 50;
  if (lower.includes("@")) score += 20;
  score += newlineCount * 0.5;
  score += digitCount * 0.2;
  score += text.length * 0.001;
  return score;
}

async function extractPdfBest(buffer: Buffer): Promise<string> {
  const fast = await extractPdfFast(buffer);
  const layout = await extractPdfLayout(buffer);

  const scoreFast = scoreExtractedText(fast);
  const scoreLayout = scoreExtractedText(layout);

  const chosen = scoreLayout >= scoreFast ? "layout" : "fast";
  console.log("[DOC] pdf scores", { fast: scoreFast, layout: scoreLayout, chosen });
  console.log("[DOC] pdf signals", {
    fastHasWhatsApp: fast.toLowerCase().includes("whatsapp"),
    layoutHasWhatsApp: layout.toLowerCase().includes("whatsapp"),
    fastLen: fast.length,
    layoutLen: layout.length
  });

  return chosen === "layout" ? layout : fast;
}

async function updateDocumentStatus(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  id: string,
  status: "uploaded" | "processing" | "ready" | "error",
  errorMessage?: string | null
) {
  const { error } = await (supabase as any)
    .from("documents")
    .update({
      status,
      error_message: errorMessage ?? null,
      updated_at: nowIso()
    })
    .eq("id", id);

  if (error) {
    console.error("[DOC] status update failed", { id, status, error: error.message });
  }
}

async function downloadFile(supabase: ReturnType<typeof getSupabaseAdminClient>, storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message ?? "unknown"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractText(buffer: Buffer, mime: string, fileName: string) {
  const lowerMime = (mime || "").toLowerCase();
  const lowerName = (fileName || "").toLowerCase();

  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) {
    return extractPdfBest(buffer);
  }

  if (lowerMime.includes("word") || lowerMime.includes("docx") || lowerName.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return (value || "").trim();
  }

  return buffer.toString("utf8").trim();
}

async function embedBatch(texts: string[]) {
  if (!texts.length) return [] as number[][];

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts
  });

  return res.data.map((row) => row.embedding as number[]);
}

async function cleanupExisting(supabase: ReturnType<typeof getSupabaseAdminClient>, documentId: string) {
  const { data: chunks, error } = await (supabase as any)
    .from("document_chunks")
    .select("id")
    .eq("document_id", documentId);

  if (error) {
    console.warn("[DOC] cleanup: failed to list chunks", { documentId, error: error.message });
    return;
  }

  const chunkIds: string[] = (chunks ?? []).map((c: any) => c.id).filter(Boolean);
  if (!chunkIds.length) return;

  // Delete embeddings first (FK)
  for (let i = 0; i < chunkIds.length; i += 500) {
    const slice = chunkIds.slice(i, i + 500);
    const { error: e1 } = await (supabase as any)
      .from("document_chunk_embeddings")
      .delete()
      .in("chunk_id", slice);
    if (e1) console.warn("[DOC] cleanup: failed deleting embeddings batch", { documentId, error: e1.message });
  }

  // Delete chunks
  const { error: e2 } = await (supabase as any).from("document_chunks").delete().eq("document_id", documentId);
  if (e2) console.warn("[DOC] cleanup: failed deleting chunks", { documentId, error: e2.message });
}

async function insertChunks(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  chunkRows: ChunkRow[]
): Promise<InsertedChunkRow[]> {
  const allInserted: InsertedChunkRow[] = [];

  for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
    const batch = chunkRows.slice(i, i + CHUNK_INSERT_BATCH);

    const { data, error } = await (supabase as any)
      .from("document_chunks")
      .insert(batch)
      .select("id, chunk_index, content");

    if (error || !data) {
      throw new Error(`Chunk insert failed: ${error?.message ?? "unknown"}`);
    }

    allInserted.push(...(data as InsertedChunkRow[]));
  }

  allInserted.sort((a, b) => a.chunk_index - b.chunk_index);
  return allInserted;
}

async function insertEmbeddings(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rows: Array<{ chunk_id: string; business_id: string; embedding: number[] }>
) {
  for (let i = 0; i < rows.length; i += EMBED_INSERT_BATCH) {
    const batch = rows.slice(i, i + EMBED_INSERT_BATCH);
    const { error } = await (supabase as any).from("document_chunk_embeddings").insert(batch as any);
    if (error) {
      throw new Error(`Embedding insert failed: ${error.message}`);
    }
  }
}

export async function processDocument(documentId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: doc, error: docError } = await (supabase as any)
    .from("documents")
    .select("id,business_id,user_id,storage_path,file_name,mime_type,size_bytes,status")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) {
    log("error", "Document lookup failed", { documentId, docError: docError.message });
    await updateDocumentStatus(supabase, documentId, "error", docError.message);
    throw new Error(`Document lookup failed: ${docError.message}`);
  }
  if (!doc) {
    log("error", "Document not found for processing", { documentId });
    await updateDocumentStatus(supabase, documentId, "error", "Document not found for processing");
    throw new Error("Document not found for processing");
  }

  const document = doc as DocumentRow;

  console.log("[DOC] start", {
    documentId,
    businessId: document.business_id,
    path: document.storage_path,
    file: document.file_name,
    mime: document.mime_type,
    size: document.size_bytes
  });

  try {
    await updateDocumentStatus(supabase, documentId, "processing", null);

    // prevent duplicates/stale retrieval on re-runs
    await cleanupExisting(supabase, documentId);

    const fileBuffer = await downloadFile(supabase, document.storage_path);
    const text = await extractText(fileBuffer, document.mime_type, document.file_name);

    console.log("[DOC] extracted length", {
      documentId,
      chars: text.length,
      preview: text.slice(0, 200)
    });

    if (!text.trim()) {
      throw new Error("Document has no extractable text");
    }

    // chunk the extracted text
    let chunks = chunkText(text, { maxChars: MAX_CHARS, overlap: OVERLAP });

    // drop garbage chunks like "ill."
    chunks = chunks
      .map((c) => (c ?? "").trim())
      .filter((c) => c.length >= MIN_CHUNK_CHARS);

    if (!chunks.length) {
      throw new Error("No usable chunks produced (all too small)");
    }

    console.log("[DOC] chunks count", {
      documentId,
      count: chunks.length,
      first: chunks[0]?.slice(0, 120)
    });

    const chunkRows: ChunkRow[] = chunks.map((content, idx) => ({
      document_id: documentId,
      business_id: document.business_id,
      chunk_index: idx,
      content
    }));

    const insertedChunks = await insertChunks(supabase, chunkRows);

    console.log("[DOC] inserted chunks", { documentId, count: insertedChunks.length });

    const embeddingRows: Array<{ chunk_id: string; business_id: string; embedding: number[] }> = [];

    for (let i = 0; i < insertedChunks.length; i += EMBED_BATCH) {
      const batch = insertedChunks.slice(i, i + EMBED_BATCH);
      const vectors = await embedBatch(batch.map((c) => c.content));

      if (vectors.length !== batch.length) {
        throw new Error(`Embedding count mismatch: got ${vectors.length}, expected ${batch.length}`);
      }

      for (let j = 0; j < batch.length; j++) {
        embeddingRows.push({
          chunk_id: batch[j].id,
          business_id: document.business_id,
          embedding: vectors[j]
        });
      }
    }

    console.log("[DOC] embeddings count", { documentId, count: embeddingRows.length });

    await insertEmbeddings(supabase, embeddingRows);

    await updateDocumentStatus(supabase, documentId, "ready", null);

    console.log("[DOC] ready", { documentId });
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    log("error", "Document processing failed", { documentId, error: msg });
    await updateDocumentStatus(supabase, documentId, "error", msg.slice(0, 500));
    throw new Error(msg);
  }
}

// IMPORTANT: Never log full document contents. Only IDs and short previews above.
