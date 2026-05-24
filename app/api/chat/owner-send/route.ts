import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import {
  buildUnknownLegacyConversationChannelResponse,
  ensureLegacyConversationBusinessAccess,
  loadLegacyConversationContext
} from "@/lib/server/legacy-chat-management";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAnalyticsEvent } from "@/lib/analytics/events";
import { isHumanTakeoverEnabled } from "@/lib/chat/takeover";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
  if (!isHumanTakeoverEnabled()) {
    return NextResponse.json({ error: "Human takeover is disabled in V1" }, { status: 410 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { conversationId, message } = parsed.data;
  const conversation = await loadLegacyConversationContext(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const conversationAccessResponse = await ensureLegacyConversationBusinessAccess(user.id, conversation.businessId);
  if (conversationAccessResponse) {
    return conversationAccessResponse;
  }

  if (conversation.channel === "unknown") {
    return buildUnknownLegacyConversationChannelResponse();
  }

  const requiredEntitlements =
    conversation.channel === "website"
      ? (["chatbot"] as const)
      : conversation.channel === "whatsapp"
        ? (["whatsapp", "social_replies"] as const)
        : (["instagram", "social_replies"] as const);

  for (const entitlement of requiredEntitlements) {
    const billingAccess = await getBusinessEntitlementAccess(conversation.businessId, entitlement);
    if (!billingAccess.allowed) {
      return buildUpgradeRequiredResponse(entitlement, billingAccess);
    }
  }

  const { data: inserted, error: insertError } = await (supabase as any)
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender: "owner",
      message_text: message
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to send message" }, { status: 500 });
  }

  try {
    const admin = getSupabaseAdminClient();
    await insertAnalyticsEvent(admin as any, {
      businessId: conversation.businessId,
      siteId: null,
      type: "owner_message_sent",
      metadata: { conversation_id: conversationId, message_id: inserted.id }
    });
  } catch {
    // Ignore analytics failures for owner messages.
  }

  return NextResponse.json({
    id: inserted.id,
    created_at: inserted.created_at
  });
}
