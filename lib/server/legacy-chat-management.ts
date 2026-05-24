import "server-only";

import { NextResponse } from "next/server";
import { userOwnsLaunchedBusiness } from "@/lib/server/launch-access";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";

export type LegacyChatConversationChannel = "website" | "whatsapp" | "instagram" | "unknown";

export type LegacyChatConversationSeed = {
  id: string;
  business_id: string;
  site_id: string | null;
};

export type LegacyChatConversationContext = {
  id: string;
  businessId: string;
  siteId: string | null;
  channel: LegacyChatConversationChannel;
};

const resolveChannelFromSource = (value: unknown): LegacyChatConversationChannel | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "whatsapp") return "whatsapp";
  if (normalized === "instagram") return "instagram";
  if (normalized === "website" || normalized === "web" || normalized === "web_chat") {
    return "website";
  }

  return null;
};

const resolveLegacyConversationChannel = ({
  siteId,
  source
}: {
  siteId: string | null;
  source: unknown;
}): LegacyChatConversationChannel => {
  const sourceChannel = resolveChannelFromSource(source);
  if (sourceChannel) return sourceChannel;
  if (siteId) return "website";
  return "unknown";
};

export const buildUnknownLegacyConversationChannelResponse = () =>
  NextResponse.json(
    {
      error: "FORBIDDEN",
      message: "Conversation channel could not be verified. Access is blocked by default."
    },
    { status: 403 }
  );

export const ensureLegacyConversationBusinessAccess = async (userId: string, businessId: string) => {
  if (!userId || !businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const allowed = await userOwnsLaunchedBusiness(userId, businessId);
  if (!allowed) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return null;
};

export const inferLegacyConversationChannels = async (
  conversations: LegacyChatConversationSeed[]
): Promise<Map<string, LegacyChatConversationChannel>> => {
  const channelByConversationId = new Map<string, LegacyChatConversationChannel>();
  if (!conversations.length) {
    return channelByConversationId;
  }

  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    conversations.forEach((conversation) => {
      channelByConversationId.set(conversation.id, conversation.site_id ? "website" : "unknown");
    });
    return channelByConversationId;
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data } = await admin
    .from("analytics_events")
    .select("conversation_id, metadata, timestamp")
    .in("conversation_id", conversationIds)
    .eq("type", "message_received")
    .order("timestamp", { ascending: false });

  const latestSourceByConversationId = new Map<string, unknown>();
  for (const row of (data ?? []) as Array<{
    conversation_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }>) {
    const conversationId = typeof row.conversation_id === "string" ? row.conversation_id : null;
    if (!conversationId || latestSourceByConversationId.has(conversationId)) {
      continue;
    }

    latestSourceByConversationId.set(conversationId, row.metadata?.source);
  }

  conversations.forEach((conversation) => {
    channelByConversationId.set(
      conversation.id,
      resolveLegacyConversationChannel({
        siteId: conversation.site_id,
        source: latestSourceByConversationId.get(conversation.id)
      })
    );
  });

  return channelByConversationId;
};

export const loadLegacyConversationContext = async (
  conversationId: string
): Promise<LegacyChatConversationContext | null> => {
  const admin = getSupabaseServerAdminClientIfAvailable() as any;
  if (!admin) {
    return null;
  }

  const { data: conversation, error } = await admin
    .from("chat_conversations")
    .select("id,business_id,site_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conversation?.id || !conversation?.business_id) {
    return null;
  }

  const channelMap = await inferLegacyConversationChannels([
    {
      id: conversation.id as string,
      business_id: conversation.business_id as string,
      site_id: (conversation.site_id as string | null) ?? null
    }
  ]);

  return {
    id: conversation.id as string,
    businessId: conversation.business_id as string,
    siteId: (conversation.site_id as string | null) ?? null,
    channel: channelMap.get(conversation.id as string) ?? "unknown"
  };
};
