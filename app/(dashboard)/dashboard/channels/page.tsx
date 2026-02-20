import ChannelsDashboardClient from "./ChannelsDashboard.client";

export const dynamic = "force-dynamic";

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Channels</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">WhatsApp + Instagram DM Sync</h2>
        <p className="mt-2 text-sm text-white/60">
          Integration-ready inbox and webhook storage for channel conversations.
        </p>
      </div>
      <ChannelsDashboardClient />
    </div>
  );
}
