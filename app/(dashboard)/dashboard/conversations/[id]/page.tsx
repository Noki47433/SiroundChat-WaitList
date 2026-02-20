import { Card } from "@/components/ui/card";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { ConversationDetailPanel } from "@/app/(dashboard)/dashboard/_components/ConversationDetailPanel";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <Card>
        <p className="text-sm text-white/70">Please sign in to view conversations.</p>
      </Card>
    );
  }

  const { data: conversation, error: convoError } = await (supabase as any)
    .from("chat_conversations")
    .select("id, user_name, user_email, created_at, takeover_enabled")
    .eq("id", params.id)
    .eq("business_id", tenant.businessId)
    .single();

  if (convoError || !conversation) {
    return (
      <Card>
        <p className="text-sm text-white/70">Conversation not found.</p>
        <Link href="/dashboard/conversations" className="mt-3 inline-flex text-sm text-[#00A3FF]">
          Back to conversations
        </Link>
      </Card>
    );
  }

  const { data: messages } = await (supabase as any)
    .from("chat_messages")
    .select("id, sender, message_text, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <Card>
      <ConversationDetailPanel
        conversation={conversation}
        messages={(messages ?? []) as Array<{
          id: string;
          sender: string;
          message_text: string;
          created_at: string;
        }>}
      />
    </Card>
  );
}
