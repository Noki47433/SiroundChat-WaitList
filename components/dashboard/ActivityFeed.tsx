import Link from "next/link";
import { Card } from "@/components/ui/card";

export type ActivityItem = {
  id: string;
  label: string;
  time: string;
  tone: "info" | "success" | "warning" | "danger";
  href?: string | null;
};

const toneClass = (tone: ActivityItem["tone"]) => {
  switch (tone) {
    case "success":
      return "bg-emerald-400";
    case "warning":
      return "bg-amber-400";
    case "danger":
      return "bg-rose-400";
    default:
      return "bg-amber-300";
  }
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="dashboard-heading text-sm font-semibold text-white">Real-time activity</p>
          <p className="text-xs text-[#cbbd98]">What just happened</p>
        </div>
      </div>
      <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="dashboard-inset rounded-2xl p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 rounded-full ${toneClass(item.tone)}`} />
                <div className="flex-1">
                  <p className="text-sm text-white/90">{item.label}</p>
                  <p className="text-[11px] text-[#94aac2]">{item.time}</p>
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="dashboard-pill rounded-full px-2 py-1 text-[11px] text-[#b5d2ee] transition hover:text-white"
                  >
                    View
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="dashboard-inset rounded-2xl p-3 text-xs text-[#cbbd98]">
            No events yet.
          </div>
        )}
      </div>
    </Card>
  );
}
