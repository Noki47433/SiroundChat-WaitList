import AutomationsDashboardClient from "./AutomationsDashboard.client";

export const dynamic = "force-dynamic";

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Automations</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Follow-ups & Smart Offers</h2>
        <p className="mt-2 text-sm text-white/60">
          Configure reminders, behavior-driven offers, and abandoned booking recovery.
        </p>
      </div>
      <AutomationsDashboardClient />
    </div>
  );
}
