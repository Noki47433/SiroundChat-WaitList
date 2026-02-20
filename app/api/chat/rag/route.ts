import { SYSTEM_PROMPT, UNKNOWN_REPLY } from "@/lib/ai/system-prompt";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { retrieveRelevantChunks } from "@/lib/ai/retrieve";
import { log } from "@/lib/utils/log";

const CHAT_MODEL = "gpt-4o-mini";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = body?.businessId as string;
  const messages = (body?.messages as Message[]) ?? [];

  if (!businessId || !messages.length) {
    return NextResponse.json({ error: "businessId and messages required" }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return NextResponse.json({ error: "Last message must be user" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const { chunks } = await retrieveRelevantChunks({ businessId, query: last.content, limit: 5 });
    const context = chunks
      .map((c, idx) => `Snippet ${idx + 1} (doc ${c.documentId}):\n${c.content}`)
      .join("\n\n");

const { data: biz, error: bizErr } = await (supabase as any)
  .from("businesses")
  .select("business_name")
  .eq("id", businessId)
  .maybeSingle();

if (bizErr) {
  console.warn("[RAG] failed to load business name", bizErr.message);
}

const businessName = (biz?.business_name as string | undefined) ?? "this business";

    const systemPrompt = SYSTEM_PROMPT(businessName);

    const promptMessages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: context ? `Context:\n${context}` : "No context available." },
      ...messages
    ];

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: promptMessages
    });

    const reply = completion.choices[0]?.message?.content ?? "I could not generate a reply.";

    return NextResponse.json({ reply, sources: chunks });
  } catch (error) {
    log("error", "Chat RAG handler failed", { error });
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}

// IMPORTANT: Do not leak raw IDs in UI; sanitize on the client if necessary.
