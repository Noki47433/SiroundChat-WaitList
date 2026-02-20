import OpenAI from "openai";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/log";

const EMBEDDING_MODEL = "text-embedding-3-small";

type RetrievedChunk = {
  content: string;
  documentId: string;
  score: number;
};

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function retrieveRelevantChunks(params: {
  businessId: string;
  query: string;
  limit?: number;
}): Promise<{ chunks: RetrievedChunk[] }> {
  const { businessId, query, limit = 5 } = params;
  if (!businessId || !query.trim()) return { chunks: [] };

  const openai = getOpenAIClient();
  if (!openai) {
    log("warn", "OPENAI_API_KEY missing, skipping retrieveRelevantChunks");
    return { chunks: [] };
  }

  try {
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query
    });
    const queryEmbedding = embeddingRes.data[0].embedding as number[];

    const supabase = getSupabaseAdminClient();
    const fetchMatches = async () => {
      const primary = await (supabase as any).rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_business_id: businessId,
        match_count: limit
      });

      if (!primary.error) return primary;

      const fallback = await (supabase as any).rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        business: businessId,
        match_count: limit
      });

      if (!fallback.error) return fallback;
      return primary;
    };

    const { data, error } = await fetchMatches();

    if (error || !data) {
      log("error", "Chunk retrieval failed", { error });
      return { chunks: [] };
    }

    const chunks = (data as any[]).map((row) => ({
      content: row.content as string,
      documentId: (row.document_id as string) || (row.chunk_id as string) || "",
      score: row.similarity as number
    }));

    return { chunks };
  } catch (error) {
    log("error", "retrieveRelevantChunks exception", { error });
    return { chunks: [] };
  }
}
