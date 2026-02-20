import { NextResponse } from "next/server";
import { FeedbackSchema } from "@/lib/validation/chat";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/log";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = FeedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient() as any;
  const { conversationId, messageId, rating, tags, comment } = parsed.data;

  const { data: conversation, error: convoError } = await admin
    .from("chat_conversations")
    .select("id, site_id, business_id")
    .eq("id", conversationId)
    .single();

  if (convoError || !conversation?.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { error: insertError } = await admin
    .from("conversation_feedback")
    .insert({
      conversation_id: conversationId,
      site_id: conversation.site_id ?? null,
      message_id: messageId,
      rating,
      tags: tags ?? null,
      comment: comment ?? null
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ success: true, duplicate: true });
    }
    log("error", "Failed to persist conversation feedback", { error: insertError });
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  await admin
    .from("chat_conversations")
    .update({ should_prompt_feedback: false, feedback_prompted_at: new Date().toISOString() })
    .eq("id", conversationId);

  const numericRating = rating === "up" ? 5 : 2;

  try {
    const { data: customerEvent } = await admin
      .from("customer_events")
      .select("customer_id")
      .eq("business_id", conversation.business_id)
      .eq("type", "message_received")
      .contains("payload", { conversation_id: conversationId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = customerEvent?.customer_id as string | null;

    if (customerId) {
      await admin.from("customer_events").insert({
        business_id: conversation.business_id,
        customer_id: customerId,
        type: "feedback_received",
        payload: {
          conversation_id: conversationId,
          rating: numericRating,
          tags: tags ?? [],
          comment: comment ?? null
        }
      });
    }

    if (numericRating >= 4) {
      const { data: businessRow } = await admin
        .from("businesses")
        .select("google_review_url")
        .eq("id", conversation.business_id)
        .maybeSingle();

      if (businessRow?.google_review_url) {
        await admin.from("outbox_messages").insert({
          business_id: conversation.business_id,
          customer_id: customerId ?? null,
          channel: "web_chat",
          template_key: "review_push",
          payload: {
            conversation_id: conversationId,
            message: `Thanks for the great feedback. Could you leave us a review here: ${businessRow.google_review_url}`
          },
          send_at: new Date().toISOString(),
          status: "pending"
        });
      }
    } else if (numericRating <= 3) {
      if (customerId) {
        await admin.from("customer_events").insert({
          business_id: conversation.business_id,
          customer_id: customerId,
          type: "complaint",
          payload: {
            conversation_id: conversationId,
            rating: numericRating,
            comment: comment ?? null
          }
        });
      }

      await createNotificationIfNotExists(
        conversation.business_id,
        {
          title: "Negative feedback received",
          body: "A customer submitted low feedback. Review and follow up privately.",
          severity: "warning",
          category: "quality",
          cta_label: "Open feedback",
          cta_url: "/dashboard/feedback",
          data: {
            conversation_id: conversationId,
            rating: numericRating
          }
        },
        "negative_feedback",
        `${conversationId}:${messageId}`
      );
    }
  } catch (error) {
    log("error", "Failed to process post-feedback automations", { error, conversationId });
  }

  return NextResponse.json({ success: true });
}
