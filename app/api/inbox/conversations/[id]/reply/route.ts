import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { sendWhatsAppTextMessage } from "@/lib/meta/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  body: z.string().min(1).max(2000)
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await (context.supabase as any)
    .from("conversations")
    .select("id,business_id,channel_type,external_customer_id,metadata")
    .eq("id", params.id)
    .eq("business_id", context.businessId)
    .eq("channel_type", "whatsapp")
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  if (!conversation?.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const metadata = isRecord(conversation.metadata) ? conversation.metadata : {};
  const phoneNumberId =
    typeof metadata.whatsapp_phone_number_id === "string" ? metadata.whatsapp_phone_number_id.trim() : "";

  if (!phoneNumberId) {
    return NextResponse.json({ error: "WhatsApp channel is missing a phone number id" }, { status: 400 });
  }

  if (!conversation.external_customer_id) {
    return NextResponse.json({ error: "Conversation is missing a WhatsApp recipient id" }, { status: 400 });
  }

  let outboundMessageId: string | null = null;
  try {
    outboundMessageId = await sendWhatsAppTextMessage({
      phoneNumberId,
      recipientWaId: conversation.external_customer_id,
      text: parsed.data.body.trim()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send WhatsApp reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { error: messageInsertError } = await (context.supabase as any).from("messages").insert({
    conversation_id: conversation.id,
    business_id: context.businessId,
    sender: "human",
    direction: "outbound",
    content: parsed.data.body.trim(),
    body: parsed.data.body.trim(),
    provider_message_id: outboundMessageId,
    raw_payload: {
      manual_reply: true
    }
  });

  if (messageInsertError) {
    return NextResponse.json({ error: messageInsertError.message }, { status: 500 });
  }

  const { error: conversationUpdateError } = await (context.supabase as any)
    .from("conversations")
    .update({
      status: "human",
      last_message_preview: parsed.data.body.trim(),
      last_message_at: nowIso
    })
    .eq("id", conversation.id)
    .eq("business_id", context.businessId);

  if (conversationUpdateError) {
    return NextResponse.json({ error: conversationUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    providerMessageId: outboundMessageId
  });
}
