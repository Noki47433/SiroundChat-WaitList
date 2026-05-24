import { ChannelsDashboard } from "@/components/channels/ChannelsDashboard";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default async function ChannelsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const access = await getEntitlementAccess("unified_inbox");
  const requestedTab = toSingle(searchParams?.tab);
  const initialTab = requestedTab === "integrations" ? "integrations" : "inbox";
  const initialConversationId = toSingle(searchParams?.conversation);

  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Channels</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Social Inbox</h2>
          <p className="mt-2 text-sm text-white/60">
            Manage WhatsApp and Instagram from one premium inbox when this workspace has social access.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="unified_inbox"
          title="Unlock the unified social inbox"
          description="WhatsApp, Instagram, inbox operations, and social replies are available on Social Inbox and Full Omni-Channel."
        >
          <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
            <div className="h-64 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-64 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  return <ChannelsDashboard initialTab={initialTab} initialConversationId={initialConversationId} />;
}
