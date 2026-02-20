import { Card } from "@/components/ui/card";
import { getConversations } from "@/lib/api.server";
import { ConversationsTable } from "@/app/(dashboard)/dashboard/_components/ConversationsTable";

export default async function ConversationsPage() {
  const conversations = await getConversations();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Conversations</p>
        <h2 className="mt-2 text-3xl font-semibold">Every visitor, organized</h2>
        <p className="mt-2 text-sm text-white/60">Filter by status, tag leads, and export transcripts.</p>
      </div>
      <Card>
        <ConversationsTable initialConversations={conversations} />
      </Card>
    </div>
  );
}
