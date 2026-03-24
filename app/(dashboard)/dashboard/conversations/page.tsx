import { Card } from "@/components/ui/card";
import { getConversations } from "@/lib/api.server";
import { ConversationsTable } from "@/app/(dashboard)/dashboard/_components/ConversationsTable";

const ALLOWED_FILTERS = new Set(["all", "open", "closed", "lead"]);

const toSingleParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default async function ConversationsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const conversations = await getConversations();
  const rawFilter = toSingleParam(searchParams?.filter) ?? "all";
  const filter = ALLOWED_FILTERS.has(rawFilter) ? rawFilter : "all";
  const initialSearch = (toSingleParam(searchParams?.q) ?? "").trim();
  const autoFocusSearch = (toSingleParam(searchParams?.focus) ?? "").toLowerCase() === "search";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Conversations</p>
        <h2 className="mt-2 text-3xl font-semibold">Every visitor, organized</h2>
        <p className="mt-2 text-sm text-white/60">Filter by status, tag leads, and export transcripts.</p>
      </div>
      <Card>
        <ConversationsTable
          initialConversations={conversations}
          initialFilter={filter}
          initialSearch={initialSearch}
          autoFocusSearch={autoFocusSearch}
        />
      </Card>
    </div>
  );
}
