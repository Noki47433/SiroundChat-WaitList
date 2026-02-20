import { Search, Bell, MessageSquare, Settings } from "lucide-react";

type OverviewHeaderProps = {
  title: string;
  subtitle: string;
};

export function OverviewHeader({ title, subtitle }: OverviewHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Overview</p>
        <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        <p className="text-xs text-white/60">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          <Search className="h-4 w-4" />
          <span>Search anything...</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          <Bell className="h-4 w-4" />
          <MessageSquare className="h-4 w-4" />
          <Settings className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
