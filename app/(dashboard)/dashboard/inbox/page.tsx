import { InboxDashboard } from "@/components/inbox/InboxDashboard";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function InboxPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialConversationId = toSingle(searchParams?.conversation);

  return <InboxDashboard initialConversationId={initialConversationId} />;
}
