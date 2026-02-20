import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { log } from "@/lib/utils/log";
import type { Database } from "@/lib/db/schema";
import { searchEmbeddingsLocal } from "@/lib/utils/local-store";

type Json = Database["public"]["Tables"]["embeddings"]["Row"]["metadata"];

type SemanticResult = {
  id: string;
  content: string;
  score: number;
  metadata: Json; // must never be undefined (null is ok)
};

function normalizeResults(results: any[]): SemanticResult[] {
  return (results ?? []).map((r) => ({
    id: r.id,
    content: r.content,
    score: r.score ?? r.similarity ?? 0,
    metadata: (r.metadata ?? null) as any
  }));
}

export async function semanticSearch(vector: number[], businessId: string, limit = 5): Promise<SemanticResult[]> {
  if (!businessId || !vector.length) return [];

  // Local fallback must normalize metadata (no undefined)
  if (isAuthDisabled()) {
    const local = (await searchEmbeddingsLocal(businessId, vector, limit)) as unknown as any[];
    return normalizeResults(local);
  }

  const supabase = getSupabaseServerClient();
  const db = supabase as any;

  try {
    const { data, error } = await db.rpc("match_business_embeddings", {
      business: businessId,
      match_count: limit,
      query_embedding: vector
    });

    if (error || !data) {
      if (error) log("error", "Vector search failed", { error });
      return [];
    }

    return normalizeResults(data as any[]);
  } catch (error) {
    log("error", "Vector search fallback triggered", { error });
    return [];
  }
}