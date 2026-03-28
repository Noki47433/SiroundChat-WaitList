import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { insertAnalyticsEvent } from "@/lib/analytics/events";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
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

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { conversationId, message } = parsed.data;

  const { data: conversation, error: convoError } = await (supabase as any)
    .from("chat_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("business_id", tenant.businessId)
    .maybeSingle();

  if (convoError) {
    return NextResponse.json({ error: convoError.message }, { status: 500 });
  }

  if (!conversation?.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
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
      businessId: tenant.businessId,
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
