import CrmDashboardClient from "./CrmDashboard.client";

export const dynamic = "force-dynamic";

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">CRM</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Customer Profiles</h2>
        <p className="mt-2 text-sm text-white/60">
          Track customer history, timeline events, reservations, feedback, and merge duplicates.
        </p>
      </div>
      <CrmDashboardClient />
    </div>
  );
}
