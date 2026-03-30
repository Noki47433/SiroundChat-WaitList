import { NextResponse } from "next/server";
import { LeadSchema } from "@/lib/validation/chat";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAnalyticsEvent } from "@/lib/analytics/events";
import { awardBadgeIfNew, createNotificationIfNotExists } from "@/lib/notifications/engine";
import { log } from "@/lib/utils/log";
import { logActivity } from "@/lib/activity/log";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = LeadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient() as any;
  const { conversationId, name, email, phone } = parsed.data;

  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("id, business_id")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      business_id: conversation.business_id,
      conversation_id: conversation.id,
      name,
      email: email ?? null,
      phone: phone ?? null,
      source: "widget",
      lead_type: "chat",
      payload: {
        source: "chatbot",
        conversation_id: conversation.id
      }
    })
    .select("id")
    .single();

  if (error || !lead) {
    log("error", "Failed to persist lead", { error });
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  await admin
    .from("chat_conversations")
    .update({ is_lead: true, user_name: name, user_email: email ?? null })
    .eq("id", conversationId);

  try {
    await insertAnalyticsEvent(admin as any, {
      businessId: conversation.business_id,
      siteId: null,
      type: "lead_created",
      metadata: { conversation_id: conversation.id, lead_id: lead.id }
    });
  } catch (eventError) {
    log("error", "Failed to log lead_created event", { error: eventError });
  }

  try {
    const detailParts = [
      name ? `Name: ${name}` : null,
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null
    ].filter(Boolean);

    await createNotificationIfNotExists(
      conversation.business_id,
      {
        title: "✅ New lead captured",
        body: detailParts.length ? detailParts.join(" • ") : "A new lead was captured from your chat.",
        severity: "success",
        category: "revenue",
        cta_label: "View lead",
        cta_url: "/dashboard/leads",
        data: {}
      },
      "lead",
      lead.id
    );

    await awardBadgeIfNew(conversation.business_id, "first_lead", { lead_id: lead.id });

    const { count: leadsLast30Days } = await (admin as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", conversation.business_id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (leadsLast30Days && leadsLast30Days >= 10) {
      await awardBadgeIfNew(conversation.business_id, "ten_leads_month", { lead_id: lead.id });
    }
  } catch (notifyError) {
    log("error", "Failed to create lead notification", { error: notifyError });
  }

  await logActivity({
    businessId: conversation.business_id,
    actorType: "system",
    eventType: "lead_created",
    summary: `Lead captured: ${name}`,
    meta: { lead_id: lead.id, conversation_id: conversation.id }
  });

  return NextResponse.json({ success: true });
}
