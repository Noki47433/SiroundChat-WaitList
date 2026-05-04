import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function InboxPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  params.set("tab", "inbox");

  const initialConversationId = toSingle(searchParams?.conversation)?.trim();
  if (initialConversationId) {
    params.set("conversation", initialConversationId);
  }

  redirect(`/dashboard/channels?${params.toString()}`);
}
