import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import {
  buildUnknownLegacyConversationChannelResponse,
  ensureLegacyConversationBusinessAccess,
  inferLegacyConversationChannels,
  loadLegacyConversationContext
} from "@/lib/server/legacy-chat-management";
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

  const businessAccessResponse = await ensureLegacyConversationBusinessAccess(user.id, tenant.businessId);
  if (businessAccessResponse) {
    return businessAccessResponse;
  }

  if (conversationId) {
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

    const requiredEntitlement = conversation.channel === "website" ? "chatbot" : "unified_inbox";
    const billingAccess = await getBusinessEntitlementAccess(conversation.businessId, requiredEntitlement);
    if (!billingAccess.allowed) {
      return buildUpgradeRequiredResponse(requiredEntitlement, billingAccess);
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
  const [chatbotAccess, inboxAccess] = await Promise.all([
    getBusinessEntitlementAccess(tenant.businessId, "chatbot"),
    getBusinessEntitlementAccess(tenant.businessId, "unified_inbox")
  ]);

  const { data: conversations } = await db
    .from("chat_conversations")
    .select("id, user_name, created_at, site_id, business_id")
    .eq("business_id", tenant.businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const conversationRows = (conversations ?? []) as Array<
    Database["public"]["Tables"]["chat_conversations"]["Row"] & { site_id?: string | null; business_id?: string | null }
  >;
  const channelMap = await inferLegacyConversationChannels(
    conversationRows
      .filter(
        (row): row is Database["public"]["Tables"]["chat_conversations"]["Row"] & {
          site_id: string | null;
          business_id: string;
        } => typeof row.id === "string" && typeof row.business_id === "string"
      )
      .map((row) => ({
        id: row.id,
        business_id: row.business_id,
        site_id: row.site_id ?? null
      }))
  );

  const accessibleConversations = conversationRows.filter((conversation) => {
    const channel = channelMap.get(conversation.id) ?? "unknown";
    if (channel === "website") return chatbotAccess.allowed;
    if (channel === "whatsapp" || channel === "instagram") return inboxAccess.allowed;
    return false;
  });

  if (!accessibleConversations.length && conversationRows.length > 0) {
    const hasWebsiteConversations = conversationRows.some((conversation) => (channelMap.get(conversation.id) ?? "unknown") === "website");
    const hasSocialConversations = conversationRows.some((conversation) => {
      const channel = channelMap.get(conversation.id) ?? "unknown";
      return channel === "whatsapp" || channel === "instagram";
    });

    if (hasWebsiteConversations && !chatbotAccess.allowed) {
      return buildUpgradeRequiredResponse("chatbot", chatbotAccess);
    }

    if (hasSocialConversations && !inboxAccess.allowed) {
      return buildUpgradeRequiredResponse("unified_inbox", inboxAccess);
    }

    return buildUnknownLegacyConversationChannelResponse();
  }

  return NextResponse.json({
    conversations: accessibleConversations.map((conversation) => ({
      id: conversation.id,
      name: conversation.user_name ?? "Visitor",
      created_at: conversation.created_at,
      preview: "Tap to open"
    }))
  });
}
