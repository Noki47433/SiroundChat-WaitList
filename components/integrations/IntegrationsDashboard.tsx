"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type ChannelRow = {
  id: string;
  channel_type: "website" | "whatsapp" | "instagram";
  provider: string;
  status: "connected" | "disabled" | "needs_reauth";
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  display_phone_number: string | null;
  auto_reply_enabled: boolean;
};

type IntegrationsResponse = {
  channels: ChannelRow[];
  websiteChatConnected: boolean;
};

const statusBadge = (status: "connected" | "disabled" | "needs_reauth") => {
  if (status === "connected") return { label: "Connected", variant: "success" as const };
  if (status === "needs_reauth") return { label: "Needs attention", variant: "warning" as const };
  return { label: "Not connected", variant: "default" as const };
};

export function IntegrationsDashboard() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [data, setData] = useState<IntegrationsResponse>({ channels: [], websiteChatConnected: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/channels", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load integrations");
      }
      setData(payload as IntegrationsResponse);
    } catch (error) {
      push({
        title: "Load failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whatsappChannel = useMemo(
    () => data.channels.find((channel) => channel.channel_type === "whatsapp") ?? null,
    [data.channels]
  );

  const toggleAutoReply = async () => {
    if (!whatsappChannel) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/integrations/channels/${whatsappChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_reply_enabled: !whatsappChannel.auto_reply_enabled })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update auto-reply");
      }
      await loadData();
    } catch (error) {
      push({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Integrations</p>
        <h2 className="dashboard-heading mt-2 text-3xl font-semibold text-white">Messaging channels</h2>
        <p className="mt-2 text-sm text-white/60">
          Connect the channels your restaurant already uses and keep the AI assistant aligned across them.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[220px] rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="dashboard-surface flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="dashboard-heading text-xl font-semibold text-white">WhatsApp</p>
                  <p className="mt-2 text-sm text-white/60">
                    Let SiroundChat answer customer messages, collect reservation details, and save conversations in
                    your dashboard.
                  </p>
                </div>
                <Badge variant={statusBadge(whatsappChannel?.status ?? "disabled").variant}>
                  {statusBadge(whatsappChannel?.status ?? "disabled").label}
                </Badge>
              </div>

              {whatsappChannel ? (
                <div className="mt-5 space-y-2 text-sm text-white/70">
                  <p>Display number: {whatsappChannel.display_phone_number || "—"}</p>
                  <p>Phone number ID: {whatsappChannel.whatsapp_phone_number_id || "—"}</p>
                  <p>Auto-reply: {whatsappChannel.auto_reply_enabled ? "Enabled" : "Disabled"}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/60">
                  This workspace does not have a connected WhatsApp Business number yet.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {whatsappChannel ? (
                <>
                  <Link href="/dashboard/inbox" className={buttonVariants({ variant: "secondary" })}>
                    Open inbox
                  </Link>
                  <Button variant="outline" onClick={() => void toggleAutoReply()} disabled={saving}>
                    {whatsappChannel.auto_reply_enabled ? "Disable auto-reply" : "Enable auto-reply"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setSetupOpen(true)}>Request setup</Button>
              )}
            </div>
          </Card>

          <Card className="dashboard-surface flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="dashboard-heading text-xl font-semibold text-white">Instagram</p>
                  <p className="mt-2 text-sm text-white/60">
                    Instagram DM automation will use the same SiroundChat inbox and AI assistant.
                  </p>
                </div>
                <Badge variant="default">Coming soon</Badge>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </Card>

          <Card className="dashboard-surface flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="dashboard-heading text-xl font-semibold text-white">Website Chat</p>
                  <p className="mt-2 text-sm text-white/60">
                    Your website widget continues to use the same SiroundChat knowledge and reservation assistant.
                  </p>
                </div>
                <Badge variant={data.websiteChatConnected ? "success" : "default"}>
                  {data.websiteChatConnected ? "Active" : "Not connected"}
                </Badge>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                {data.websiteChatConnected
                  ? "Website chat is live and ready to capture conversations."
                  : "No website widget key was found for this business yet."}
              </div>
            </div>
            <Link href="/dashboard/bot-settings" className={buttonVariants({ variant: "secondary" })}>
              Open bot settings
            </Link>
          </Card>
        </div>
      )}

      <Modal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title="Request WhatsApp setup"
        footer={
          <Button variant="secondary" onClick={() => setSetupOpen(false)}>
            Close
          </Button>
        }
      >
        <p>
          WhatsApp setup is currently handled manually. Contact SiroundChat support and we’ll connect your WhatsApp
          Business number.
        </p>
      </Modal>
    </div>
  );
}
