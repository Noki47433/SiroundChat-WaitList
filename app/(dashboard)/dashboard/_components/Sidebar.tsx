"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bot,
  CalendarCheck2,
  FileText,
  Globe,
  LayoutDashboard,
  LineChart,
  Link2,
  MessageSquare,
  MessageSquareQuote,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  Settings,
  Sparkles,
  UserCircle2,
  Users,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const CORE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/reservations", label: "Reservations", icon: CalendarCheck2 },
  { href: "/dashboard/builder", label: "Website Builder", icon: PencilRuler },
  { href: "/dashboard/bot-settings", label: "Bot Settings", icon: Bot }
];

const GROWTH_NAV: NavItem[] = [
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareQuote },
  { href: "/dashboard/chatbot/sales", label: "Update Info", icon: Sparkles },
  { href: "/dashboard/integrations", label: "Integrations", icon: Link2 },
  { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
  { href: "/dashboard/analytics/website", label: "Website Analytics", icon: Globe }
];

const TEAM_MEMBER_NAV: NavItem[] = [{ href: "/dashboard/account", label: "Account", icon: UserCircle2 }];

const ORG_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/badges", label: "Badges", icon: BadgeCheck }
];

export const DASHBOARD_NAV: NavItem[] = [...CORE_NAV, ...GROWTH_NAV, ...TEAM_MEMBER_NAV, ...ORG_NAV];

const buildSections = (orgName: string): NavSection[] => [
  { title: "Core", items: CORE_NAV },
  { title: "Growth", items: GROWTH_NAV },
  { title: "Team Member", items: TEAM_MEMBER_NAV },
  { title: `Org: ${orgName || "Your business"}`, items: ORG_NAV }
];

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  const sections = buildSections(orgName || "Your business");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("dashboard-sidebar-collapsed");
    if (stored) setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dashboard-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "dashboard-surface relative hidden shrink-0 min-h-dvh flex-col overflow-hidden border-r py-8 transition-all duration-300 lg:flex",
        collapsed ? "w-20 px-3" : "w-64 px-6"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#ffd54f29] to-transparent" />
      <div className={cn("mb-8", collapsed ? "space-y-3" : "space-y-2")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? <p className="text-xs uppercase tracking-[0.2em] text-white/45">Workspace</p> : null}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="dashboard-pill inline-flex h-8 w-8 items-center justify-center rounded-xl text-white/75 transition hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {collapsed ? (
          <div className="dashboard-chip mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white">
            SC
          </div>
        ) : (
          <>
            <p className="dashboard-heading text-lg font-semibold text-white">{orgName}</p>
            <p className="text-xs text-white/55">SiroundChat Dashboard</p>
          </>
        )}
      </div>
      <nav className={cn("flex flex-1 flex-col overflow-y-auto", collapsed ? "gap-3" : "gap-4")}>
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            {!collapsed ? (
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{section.title}</p>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tutorial-nav={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "rounded-2xl border text-sm font-medium transition",
                      collapsed ? "flex h-10 items-center justify-center px-0 py-0" : "flex items-center gap-2 px-4 py-2",
                      active
                        ? "dashboard-chip border-[#ffd87266] text-white"
                        : "border-transparent text-[var(--dash-muted)] hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    {item.icon ? <item.icon className="h-4 w-4 shrink-0 text-[#f7d56b]" /> : null}
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed ? (
        <div className="dashboard-inset rounded-2xl p-4 text-xs text-[#c8d9ec]">
          Keep your bot on-brand and ready for every visitor.
        </div>
      ) : null}
    </aside>
  );
}
