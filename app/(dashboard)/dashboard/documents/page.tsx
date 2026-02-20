import { Card } from "@/components/ui/card";
import { getDocuments } from "@/lib/api.server";
import { DocumentsPanel } from "@/app/(dashboard)/dashboard/_components/DocumentsPanel";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export default async function DocumentsPage() {
  const access = await getEntitlementAccess("chatbot_knowledge_base");

  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Documents</p>
          <h2 className="mt-2 text-3xl font-semibold">Keep your bot informed</h2>
          <p className="mt-2 text-sm text-white/60">Upload knowledge files and retrain anytime.</p>
        </div>
        <UpgradeOverlay
          entitlementKey="chatbot_knowledge_base"
          title="Upgrade plan to unlock Documents"
          description="Knowledge file uploads are available on plans that include chatbot knowledge base."
        >
          <Card>
            <div className="space-y-4">
              <div className="h-4 w-56 rounded bg-white/10" />
              <div className="h-3 w-80 rounded bg-white/10" />
              <div className="space-y-2">
                <div className="h-12 rounded-xl border border-white/10 bg-white/5" />
                <div className="h-12 rounded-xl border border-white/10 bg-white/5" />
                <div className="h-12 rounded-xl border border-white/10 bg-white/5" />
              </div>
            </div>
          </Card>
        </UpgradeOverlay>
      </div>
    );
  }

  const documents = await getDocuments();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Documents</p>
        <h2 className="mt-2 text-3xl font-semibold">Keep your bot informed</h2>
        <p className="mt-2 text-sm text-white/60">Upload knowledge files and retrain anytime.</p>
      </div>
      <Card>
        <DocumentsPanel initialDocuments={documents} />
      </Card>
    </div>
  );
}
