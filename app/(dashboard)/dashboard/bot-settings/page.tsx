import { Card } from "@/components/ui/card";
import { getBotSettings } from "@/lib/api.server";
import { BotSettingsPanel } from "@/app/(dashboard)/dashboard/_components/BotSettingsPanel";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export default async function BotSettingsPage() {
  const access = await getEntitlementAccess("chatbot");
  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Bot Settings</p>
          <h2 className="mt-2 text-3xl font-semibold">Shape your brand voice</h2>
          <p className="mt-2 text-sm text-white/60">Adjust how the bot greets and responds.</p>
        </div>
        <UpgradeOverlay
          entitlementKey="chatbot"
          title="Upgrade plan to unlock Bot Settings"
          description="Chatbot customization is available on plans that include chatbot access."
        >
          <Card>
            <div className="space-y-4">
              <div className="h-4 w-52 rounded bg-white/10" />
              <div className="h-3 w-72 rounded bg-white/10" />
              <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />
            </div>
          </Card>
        </UpgradeOverlay>
      </div>
    );
  }

  const { settings, examples } = await getBotSettings();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Bot Settings</p>
        <h2 className="mt-2 text-3xl font-semibold">Shape your brand voice</h2>
        <p className="mt-2 text-sm text-white/60">Adjust how the bot greets and responds.</p>
      </div>
      <Card>
        <BotSettingsPanel settings={settings} examples={examples} />
      </Card>
    </div>
  );
}
