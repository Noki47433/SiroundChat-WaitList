import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { DashboardConversationQuerySchema } from "@/lib/validation/chat";
import type { Database } from "@/lib/db/schema";
import { isAuthDisabled } from "@/lib/config/auth";
import { getDemoMessages, listDemoConversations } from "@/lib/demo/chat";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (isAuthDisabled()) {
    if (conversationId) {
      const messages = getDemoMessages(conversationId);
      return NextResponse.json({
        messages: messages.map((msg) => ({
          id: msg.id,
          conversationId,
          sender: msg.sender,
          text: msg.message_text,
          createdAt: msg.created_at
        }))
      });
    }
    const conversations = listDemoConversations();
    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        name: conversation.user_name ?? "Demo visitor",
        created_at: conversation.created_at,
        preview: "See how SiroundChat captures leads 24/7."
      }))
    });
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
  const db = supabase as any;
  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (conversationId) {
    const { data: conversation } = await db
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", tenant.businessId)
      .maybeSingle();

    if (!conversation?.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { data: messages } = await db
      .from("chat_messages")
      .select("id, sender, message_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at");

    const rows = (messages ?? []) as Database["public"]["Tables"]["chat_messages"]["Row"][];
    return NextResponse.json({
      messages: rows.map((msg) => ({
        id: msg.id,
        conversationId,
        sender: msg.sender,
        text: msg.message_text,
        createdAt: msg.created_at
      }))
    });
  }

  const parsed = DashboardConversationQuerySchema.safeParse({
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
    filter: url.searchParams.get("filter") ?? "all"
  });

  const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

  const { data: conversations } = await db
    .from("chat_conversations")
    .select("id, user_name, created_at")
    .eq("business_id", tenant.businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const conversationRows = (conversations ?? []) as Database["public"]["Tables"]["chat_conversations"]["Row"][];
  return NextResponse.json({
    conversations: conversationRows.map((conversation) => ({
      id: conversation.id,
      name: conversation.user_name ?? "Visitor",
      created_at: conversation.created_at,
      preview: "Tap to open"
    }))
  });
}
