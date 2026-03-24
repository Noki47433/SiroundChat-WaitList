"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";

interface DashboardTopbarProps {
  businessName?: string;
  plan?: string;
  onLogout?: () => void;
}

const routeTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/chat": "Chat Inbox",
  "/dashboard/leads": "Leads",
  "/dashboard/sites": "Sites",
  "/dashboard/analytics": "Analytics",
  "/billing": "Billing",
  "/dashboard/settings": "Settings"
};

export function DashboardTopbar({ businessName, plan, onLogout }: DashboardTopbarProps) {
  const pathname = usePathname();
  return (
    <header className="flex flex-1 flex-col gap-4 border-b border-white/5 bg-neutral-900/50 px-5 py-4 lg:px-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">Current section</p>
          <h1 className="text-2xl font-semibold text-white">{routeTitles[pathname ?? ""] ?? "Dashboard"}</h1>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          {plan ? <Badge variant="success">Plan: {plan}</Badge> : null}
          <Button variant="secondary">Upgrade</Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-medium text-white">{businessName ?? "Your business"}</p>
          <p className="text-sm text-white/60">We handle the hard parts for Kosovo & Albania businesses.</p>
        </div>
        <Dropdown
          trigger={
            <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white/90">
              Account
              <span aria-hidden>?</span>
            </div>
          }
        >
          <button
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
            onClick={() => onLogout?.()}
          >
            Logout
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
