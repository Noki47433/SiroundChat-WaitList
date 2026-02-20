import OpenAI from "openai";
import { log } from "@/lib/utils/log";

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function embedText(text: string) {
  if (!openai) {
    log("warn", "OPENAI_API_KEY missing, returning zero vector");
    return Array(1536).fill(0);
  }

  try {
    const res = await openai.embeddings.create({
      input: text,
      model: "text-embedding-3-small"
    });
    return res.data[0]?.embedding ?? Array(1536).fill(0);
  } catch (error) {
    log("error", "Embedding generation failed", { error });
    return Array(1536).fill(0);
  }
}
