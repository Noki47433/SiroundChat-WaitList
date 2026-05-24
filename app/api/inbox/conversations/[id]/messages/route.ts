import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { context, response } = await requireBusinessUser({ entitlement: "unified_inbox" });
  if (response) return response;

  const conversationId = params.id;

  const { data: conversation, error: conversationError } = await (context.supabase as any)
    .from("conversations")
    .select(
      "id,business_id,channel_type,customer_display_name,external_customer_id,status,intent,reservation_draft,metadata,linked_reservation_id,last_message_preview,last_message_at,created_at"
    )
    .eq("id", conversationId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  if (!conversation?.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await (context.supabase as any)
    .from("messages")
    .select("id,direction,body,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  let linkedReservation = null;
  if (conversation.linked_reservation_id) {
    const { data: reservation } = await (context.supabase as any)
      .from("reservations")
      .select(
        "id,status,start_at,end_at,party_size,customer_name,customer_phone,customer_email,notes,special_request,source,source_conversation_id,created_at"
      )
      .eq("id", conversation.linked_reservation_id)
      .eq("business_id", context.businessId)
      .maybeSingle();

    linkedReservation = reservation ?? null;
  }

  return NextResponse.json({
    conversation,
    messages: (messages ?? []).map((message: any) => ({
      id: message.id,
      direction: message.direction ?? "outbound",
      body:
        (typeof message.body === "string" && message.body.trim() ? message.body : message.content) ??
        "",
      created_at: message.created_at
    })),
    linkedReservation
  });
}
