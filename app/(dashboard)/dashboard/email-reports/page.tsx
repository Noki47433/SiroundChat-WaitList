import { getEmailReportSettings } from "@/lib/api.server";
import { EmailReportsPanel } from "@/app/(dashboard)/dashboard/_components/EmailReportsPanel";

export default async function EmailReportsPage() {
  const settings = await getEmailReportSettings();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Email Reports</p>
        <h2 className="mt-2 text-3xl font-semibold">Automate monthly summaries</h2>
        <p className="mt-2 text-sm text-white/60">Control recipients and preview the email content.</p>
      </div>
      <EmailReportsPanel initial={settings} />
    </div>
  );
}
