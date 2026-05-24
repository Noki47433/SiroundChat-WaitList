import SalesDashboardClient from "./SalesDashboard.client";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export const dynamic = "force-dynamic";

export default async function ChatbotSalesPage() {
  const access = await getEntitlementAccess("chatbot");

  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Chatbot / Update Info</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Teach the chatbot what matters</h2>
          <p className="mt-2 text-sm text-white/60">
            Promotions, closures, menu notes, and customer-facing rules live on the chatbot plans.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="chatbot"
          title="Unlock chatbot configuration and update flows"
          description="AI chatbot control, grounded replies, and customer support automation are available on AI Chatbot Only, Website + AI, and Full Omni-Channel."
        >
          <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
            <div className="h-72 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-72 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Chatbot / Update Info</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Update Info</h2>
        <p className="mt-2 text-sm text-white/60">
          Add business updates, review extracted rules, and approve what the chatbot should use live.
        </p>
      </div>
      <SalesDashboardClient />
    </div>
  );
}
