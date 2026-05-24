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
import { isHumanTakeoverEnabled } from "@/lib/chat/takeover";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  enabled: z.boolean()
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

  const { conversationId, enabled } = parsed.data;
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
      ? (["chatbot", "human_takeover"] as const)
      : (["unified_inbox", "human_takeover"] as const);

  for (const entitlement of requiredEntitlements) {
    const billingAccess = await getBusinessEntitlementAccess(conversation.businessId, entitlement);
    if (!billingAccess.allowed) {
      return buildUpgradeRequiredResponse(entitlement, billingAccess);
    }
  }

  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    takeover_enabled: enabled,
    takeover_by: enabled ? user.id : null,
    takeover_ended_at: enabled ? null : now
  };

  if (enabled) {
    updatePayload.takeover_at = now;
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("chat_conversations")
    .update(updatePayload)
    .eq("id", conversationId)
    .eq("business_id", conversation.businessId)
    .select("id, takeover_enabled, takeover_by, takeover_at, takeover_ended_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update takeover state" }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    takeover_enabled: updated.takeover_enabled,
    takeover_by: updated.takeover_by,
    takeover_at: updated.takeover_at,
    takeover_ended_at: updated.takeover_ended_at
  });
}
