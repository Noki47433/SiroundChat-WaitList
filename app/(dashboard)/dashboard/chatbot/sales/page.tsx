import SalesDashboardClient from "./SalesDashboard.client";

export const dynamic = "force-dynamic";

export default function ChatbotSalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Chatbot / Sales</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Sales Brain</h2>
        <p className="mt-2 text-sm text-white/60">
          Manage upsell rules, deterministic FAQ answers, and objection-handling scripts.
        </p>
      </div>
      <SalesDashboardClient />
    </div>
  );
}
