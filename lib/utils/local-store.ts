import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { WidgetTheme } from "@/lib/types/core";

type LocalWidgetConfig = {
  siteId: string;
  greeting: string;
  businessName?: string;
  theme: WidgetTheme;
  launcherPosition?: "left" | "right";
  launcherVariant?: "icon" | "iconWithLabel";
  businessType?: "restaurant" | "hotel" | "cafe" | "barber" | "real_estate" | "clinic" | "gym" | "taxi" | "ecommerce" | "custom"; // Business type for preview matching
  faqs?: { id: string; question: string; answer: string }[]; // FAQ list stored for embed preview
  language?: "auto" | "en" | "sq";
  showLogo?: boolean;
  logoUrl?: string | null;
  iconId?: string | null;
  updatedAt: string;
};

type LocalEmbedding = {
  id: string;
  businessId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type LocalMessage = {
  id: string;
  sender: "ai" | "user" | "agent";
  message_text: string;
  created_at: string;
};

type LocalConversation = {
  id: string;
  businessId: string;
  siteId: string;
  messages: LocalMessage[];
};

type LocalDB = {
  widgets: Record<string, LocalWidgetConfig>;
  embeddings: LocalEmbedding[];
  conversations: Record<string, LocalConversation>;
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "local-db.json");

const defaultDB: LocalDB = {
  widgets: {},
  embeddings: [],
  conversations: {}
};

async function loadDB(): Promise<LocalDB> {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return { ...defaultDB, ...JSON.parse(raw) };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      await fs.writeFile(DB_PATH, JSON.stringify(defaultDB, null, 2), "utf8");
      return { ...defaultDB };
    }
    throw error;
  }
}

async function saveDB(db: LocalDB) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function saveWidgetConfig(config: Omit<LocalWidgetConfig, "updatedAt">) {
  const db = await loadDB();
  db.widgets[config.siteId] = {
    ...config,
    updatedAt: new Date().toISOString()
  };
  await saveDB(db);
}

export async function getWidgetConfig(siteId: string): Promise<LocalWidgetConfig | null> {
  const db = await loadDB();
  return db.widgets[siteId] ?? null;
}

type EmbeddingInput = {
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

export async function addEmbeddingsLocal(businessId: string, rows: EmbeddingInput[]) {
  if (!businessId || !rows.length) return 0;
  const db = await loadDB();
  const now = new Date().toISOString();
  const prepared: LocalEmbedding[] = rows.map((row) => ({
    id: randomUUID(),
    businessId,
    content: row.content,
    embedding: row.embedding,
    metadata: row.metadata ?? null,
    createdAt: now
  }));
  db.embeddings.push(...prepared);
  await saveDB(db);
  return prepared.length;
}

const cosineSimilarity = (a: number[], b: number[]) => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export async function searchEmbeddingsLocal(businessId: string, queryEmbedding: number[], limit = 5) {
  if (!businessId || !queryEmbedding.length) return [];
  const db = await loadDB();
  const rows = db.embeddings.filter((row) => row.businessId === businessId);
  if (!rows.length) return [];

  return rows
    .map((row) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      score: cosineSimilarity(queryEmbedding, row.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function createLocalConversation(businessId: string, siteId: string) {
  const db = await loadDB();
  const id = randomUUID();
  db.conversations[id] = {
    id,
    businessId,
    siteId,
    messages: []
  };
  await saveDB(db);
  return id;
}

export async function appendLocalMessage(conversationId: string, sender: "ai" | "user" | "agent", message: string) {
  const db = await loadDB();
  const conversation = db.conversations[conversationId];
  if (!conversation) {
    return null;
  }
  const entry: LocalMessage = {
    id: randomUUID(),
    sender,
    message_text: message,
    created_at: new Date().toISOString()
  };
  conversation.messages.push(entry);
  await saveDB(db);
  return entry;
}

export async function getLocalMessages(conversationId: string) {
  const db = await loadDB();
  const conversation = db.conversations[conversationId];
  return conversation?.messages ?? [];
}
