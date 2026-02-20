"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/feedback", label: "Feedback" },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/reservations", label: "Reservations" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/bot-settings", label: "Bot Settings" },
  { href: "/dashboard/chatbot/sales", label: "Chatbot Sales" },
  { href: "/dashboard/automations", label: "Automations" },
  { href: "/dashboard/crm", label: "CRM" },
  { href: "/dashboard/channels", label: "Channels" },
  { href: "/dashboard/builder", label: "Website Builder" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/analytics/website", label: "Website Analytics" },
  { href: "/dashboard/badges", label: "Badges" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/email-reports", label: "Email Reports" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/account", label: "Account" }
];

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-screen w-64 flex-col border-r border-white/10 bg-neutral-950/80 px-6 py-8 lg:flex">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Workspace</p>
        <p className="mt-2 text-lg font-semibold text-white">{orgName}</p>
        <p className="text-xs text-white/50">SiroundChat Dashboard</p>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {DASHBOARD_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {item.icon ? <item.icon className="h-4 w-4" /> : null}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        Keep your bot on-brand and ready for every visitor.
      </div>
    </aside>
  );
}
