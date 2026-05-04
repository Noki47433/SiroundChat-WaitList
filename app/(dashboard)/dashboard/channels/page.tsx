import { ChannelsDashboard } from "@/components/channels/ChannelsDashboard";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function ChannelsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const requestedTab = toSingle(searchParams?.tab);
  const initialTab = requestedTab === "integrations" ? "integrations" : "inbox";
  const initialConversationId = toSingle(searchParams?.conversation);

  return <ChannelsDashboard initialTab={initialTab} initialConversationId={initialConversationId} />;
}
