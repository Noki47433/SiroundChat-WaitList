import Link from "next/link";
import { Card } from "@/components/ui/card";

export type RecentItem = {
  id: string;
  type: "conversation" | "lead" | "reservation";
  title: string;
  status: string;
  timestamp: string;
  href: string;
};

const statusTone = (status: string) => {
  if (status.toLowerCase().includes("lead")) return "bg-emerald-400/15 text-emerald-200";
  if (status.toLowerCase().includes("pending")) return "bg-amber-400/15 text-amber-200";
  if (status.toLowerCase().includes("confirmed")) return "bg-emerald-400/15 text-emerald-200";
  if (status.toLowerCase().includes("cancel")) return "bg-rose-400/15 text-rose-200";
  return "bg-white/10 text-white/60";
};

export function RecentTable({ items }: { items: RecentItem[] }) {
  return (
    <Card className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Recent activity</p>
          <p className="text-xs text-white/60">Latest conversations, leads, and reservations</p>
        </div>
        <Link href="/dashboard/conversations" className="text-xs text-white/60 hover:text-white">
          View all
        </Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[2fr,1fr,1fr] gap-3 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
          <span>Item</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-white/10">
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className="grid grid-cols-[2fr,1fr,1fr] items-center gap-3 px-4 py-3 text-sm">
                <Link href={item.href} className="text-white/80 hover:text-white">
                  {item.title}
                </Link>
                <span className={`w-fit rounded-full px-2 py-1 text-[11px] ${statusTone(item.status)}`}>
                  {item.status}
                </span>
                <span className="text-xs text-white/50">{item.timestamp}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-xs text-white/50">No recent activity yet.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
