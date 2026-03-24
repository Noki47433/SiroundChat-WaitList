import SalesDashboardClient from "./SalesDashboard.client";

export const dynamic = "force-dynamic";

export default function ChatbotSalesPage() {
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
