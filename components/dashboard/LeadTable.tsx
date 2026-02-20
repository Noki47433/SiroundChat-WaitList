import type { Lead } from "@/lib/types/core";

interface LeadTableProps {
  leads: Lead[];
}

export function LeadTable({ leads }: LeadTableProps) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-white/5">
      <table className="min-w-full text-left text-sm text-white/80">
        <thead className="text-xs uppercase tracking-wide text-white/60">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Captured</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-t border-white/5">
              <td className="px-4 py-3">{lead.name}</td>
              <td className="px-4 py-3">{lead.email ?? "—"}</td>
              <td className="px-4 py-3">{lead.phone ?? "—"}</td>
              <td className="px-4 py-3 capitalize">{lead.source}</td>
              <td className="px-4 py-3 text-white/60">{new Date(lead.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 ? <p className="p-6 text-center text-sm text-white/60">No leads yet.</p> : null}
    </div>
  );
}
