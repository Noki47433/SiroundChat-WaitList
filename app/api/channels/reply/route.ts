import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const BodySchema = z.object({
  inboxId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  to: z.string().min(1),
  body: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "social_replies" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = context.supabase as any;

  try {
    const { data: inbox, error: inboxError } = await supabase
      .from("channel_inboxes")
      .select("id,channel")
      .eq("id", parsed.data.inboxId)
      .eq("business_id", context.businessId)
      .maybeSingle();

    if (inboxError || !inbox?.id) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    const { data: outboundMessage, error: messageError } = await supabase
      .from("channel_messages")
      .insert({
        business_id: context.businessId,
        inbox_id: parsed.data.inboxId,
        customer_id: parsed.data.customerId ?? null,
        direction: "out",
        body: parsed.data.body,
        raw: {
          queued: true,
          to: parsed.data.to
        }
      })
      .select("id")
      .single();

    if (messageError || !outboundMessage?.id) {
      throw messageError ?? new Error("Failed to store outbound message");
    }

    const { data: outboxRow, error: outboxError } = await supabase
      .from("outbox_messages")
      .insert({
        business_id: context.businessId,
        customer_id: parsed.data.customerId ?? null,
        channel: inbox.channel,
        template_key: "channel_reply",
        payload: {
          inbox_id: parsed.data.inboxId,
          to: parsed.data.to,
          message: parsed.data.body,
          channel_message_id: outboundMessage.id
        },
        send_at: new Date().toISOString(),
        status: "pending"
      })
      .select("id")
      .single();

    if (outboxError || !outboxRow?.id) {
      throw outboxError ?? new Error("Failed to queue outbox message");
    }

    return NextResponse.json({
      queued: true,
      messageId: outboundMessage.id,
      outboxId: outboxRow.id
    });
  } catch (error) {
    log("error", "Failed to queue channel reply", {
      error,
      businessId: context.businessId,
      inboxId: parsed.data.inboxId
    });
    return NextResponse.json({ error: "Failed to queue reply" }, { status: 500 });
  }
}
