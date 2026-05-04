"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InboxDashboard } from "@/components/inbox/InboxDashboard";
import { IntegrationsDashboard } from "@/components/integrations/IntegrationsDashboard";

type ChannelsTab = "inbox" | "integrations";

export function ChannelsDashboard({
  initialTab,
  initialConversationId
}: {
  initialTab: ChannelsTab;
  initialConversationId?: string;
}) {
  const [tab, setTab] = useState<ChannelsTab>(initialTab);

  const subtitle = useMemo(() => {
    if (tab === "inbox") {
      return "Manage WhatsApp conversations, monitor bot handoffs, and reply from one place.";
    }

    return "Control channel connectivity, WhatsApp auto-reply, and future messaging surfaces.";
  }, [tab]);

  return (
    <div className="space-y-6">
      <Card className="dashboard-surface overflow-hidden p-0">
        <div className="relative px-6 py-6 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,216,114,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Channels</p>
              <h2 className="dashboard-heading mt-2 text-3xl font-semibold text-white">WhatsApp operations</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">{subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="bg-emerald-500/15 text-emerald-100">
                WhatsApp inbox
              </Badge>
              <Badge variant="info">AI reservations</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={tab} defaultValue={initialTab} onValueChange={(value) => setTab(value as ChannelsTab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto rounded-2xl border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger value="inbox" className="rounded-xl px-4 py-2">
              Inbox
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-xl px-4 py-2">
              Integrations
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="mt-6">
          <InboxDashboard initialConversationId={initialConversationId} showHeader={false} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsDashboard showHeader={false} inboxHref="/dashboard/channels?tab=inbox" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
