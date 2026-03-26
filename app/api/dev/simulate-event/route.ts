import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES = ["message", "lead", "session", "escalation"] as const;
type EventType = (typeof EVENT_TYPES)[number];

const pickRandom = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATE_EVENT !== "true") {
    return NextResponse.json({ error: "Simulation endpoint disabled in production." }, { status: 403 });
  }

  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const payload = await request.json().catch(() => ({}));
  const kind = EVENT_TYPES.includes(payload?.kind) ? (payload.kind as EventType) : pickRandom([...EVENT_TYPES]);

  const supabase = guard.supabase as any;

  let businessId = typeof payload?.businessId === "string" ? payload.businessId : null;
  if (!businessId) {
    const { data: businessesRaw } = await supabase.from("businesses").select("id").limit(50);
    const businesses = (businessesRaw ?? []) as Array<{ id: string }>;
    if (!businesses.length) {
      return NextResponse.json({ error: "No businesses available to simulate events." }, { status: 400 });
    }
    businessId = pickRandom(businesses).id;
  }

  const { data: maybeConversation } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = maybeConversation?.id as string | undefined;

  if (!conversationId) {
    const { data: createdConversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        channel: pickRandom(["web", "instagram", "whatsapp"]),
        status: "open",
        visitor_id: `visitor_${Math.floor(Math.random() * 100000)}`
      })
      .select("id")
      .single();

    if (conversationError || !createdConversation?.id) {
      return NextResponse.json({ error: conversationError?.message ?? "Failed to create conversation" }, { status: 500 });
    }

    conversationId = createdConversation.id;
  }

  if (kind === "message") {
    const sender = pickRandom(["visitor", "ai", "human"] as const);
    const contentPool = {
      visitor: [
        "Hi, I need pricing details.",
        "Can someone call me back today?",
        "Do you support multi-location businesses?"
      ],
      ai: [
        "Absolutely. I can help with pricing and plan fit.",
        "I found your last request. Here is the best option.",
        "Would you like me to connect a human teammate?"
      ],
      human: [
        "Joining now, happy to help with this case.",
        "I can set up your account migration today.",
        "Thanks for waiting, here are the next steps."
      ]
    } as const;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        business_id: businessId,
        sender,
        content: pickRandom([...contentPool[sender]]),
        tokens_in: sender === "visitor" ? Math.floor(Math.random() * 120) : 0,
        tokens_out: sender !== "visitor" ? Math.floor(Math.random() * 420) : 0,
        cost_usd: sender !== "visitor" ? Number((Math.random() * 0.08).toFixed(4)) : 0
      })
      .select("id, sender, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, kind, businessId, conversationId, data });
  }

  if (kind === "lead") {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        business_id: businessId,
        conversation_id: conversationId,
        lead_type: pickRandom(["reservation", "call_request", "quote", "demo"]),
        name: pickRandom(["Arben K.", "Mira R.", "Dan B.", "Elena P."]),
        phone: pickRandom(["+38344123456", "+355692223334", "+38349222111"]),
        email: pickRandom(["lead@example.com", "owner@sample.biz", "hello@client.co"])
      })
      .select("id, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, kind, businessId, conversationId, data });
  }

  if (kind === "session") {
    const { data, error } = await supabase
      .from("website_sessions")
      .insert({
        business_id: businessId,
        session_id: `sess_${Math.floor(Math.random() * 1_000_000)}`,
        source: pickRandom(["organic", "instagram", "direct", "paid"]),
        path: pickRandom(["/", "/pricing", "/book", "/contact"]) 
      })
      .select("id, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, kind, businessId, conversationId, data });
  }

  if (kind === "escalation") {
    const { data, error } = await supabase
      .from("conversations")
      .update({ status: "escalated" })
      .eq("id", conversationId)
      .select("id, status, last_message_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, kind, businessId, conversationId, data });
  }
  return NextResponse.json({ error: "Unsupported simulation kind" }, { status: 400 });
}
