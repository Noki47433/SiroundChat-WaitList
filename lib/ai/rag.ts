import { embedText } from "@/lib/ai/embeddings";
import { semanticSearch } from "@/lib/ai/vector-search";

export async function buildRagContext(message: string, businessId: string) {
  const vector = await embedText(message);
  const results = await semanticSearch(vector, businessId);
  if (!results.length) return "";

  return results
    .map((result, index) => {
      const source = typeof result.metadata === "object" && result.metadata && "source" in result.metadata ? (result.metadata as any).source : null;
      const prefix = source ? `Source #${index + 1} (${String(source)})` : `Source #${index + 1}`;
      return `${prefix}:\n${result.content}`;
    })
    .join("\n\n");
}
