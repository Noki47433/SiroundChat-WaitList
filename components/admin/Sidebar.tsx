"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bug,
  Building2,
  CircleDollarSign,
  Coins,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Radio,
  Settings,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const primaryItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/live", label: "Live", icon: Radio },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/access-requests", label: "Access Requests", icon: KeyRound },
  { href: "/admin/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/admin/feedback", label: "Feedback", icon: Bug },
  { href: "/admin/status", label: "Status", icon: Activity },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
  { href: "/admin/activity", label: "Activity", icon: Activity }
];

const financeItems = [
  { href: "/admin/revenue", label: "Revenue", icon: CircleDollarSign },
  { href: "/admin/costs", label: "Costs", icon: Coins }
];

const secondaryItems = [
  { href: "/admin/overview", label: "Acquisition", icon: TrendingUp, muted: true },
  { href: "/admin/live", label: "Health", icon: Activity, muted: true },
  { href: "/admin/overview", label: "Settings", icon: Settings, muted: true }
];

export function Sidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  return (
    <aside className="hidden w-72 shrink-0 border-r border-[var(--adm-border)] bg-[#0b1119]/80 px-4 py-5 backdrop-blur xl:flex xl:flex-col">
      <div className="admin-glow mb-6 rounded-2xl border border-[#55FF95]/20 bg-[#111924] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[#8ef6b4]">Siround Founder</p>
        <p className="mt-2 text-xl font-semibold text-[var(--adm-text)]">Mission Control</p>
        <p className="mt-1 text-xs text-[var(--adm-muted)]">Admin-only control plane</p>
      </div>

      <div className="space-y-2">
        <p className="px-3 text-[11px] uppercase tracking-[0.22em] text-white/35">Dashboards</p>
        {primaryItems.map((item) => {
          const active = currentPath.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-[#55FF95]/15 text-[#cbffdf] shadow-[0_0_0_1px_rgba(85,255,149,0.25)]"
                  : "text-white/70 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 space-y-2">
        <p className="px-3 text-[11px] uppercase tracking-[0.22em] text-white/35">Finance</p>
        {financeItems.map((item) => {
          const active = currentPath.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-[#55FF95]/15 text-[#cbffdf] shadow-[0_0_0_1px_rgba(85,255,149,0.25)]"
                  : "text-white/70 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 space-y-2">
        <p className="px-3 text-[11px] uppercase tracking-[0.22em] text-white/35">Workspace</p>
        {secondaryItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={`${item.label}-${index}`}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                item.muted ? "text-white/45 hover:bg-white/[0.03] hover:text-white/75" : "text-white/70"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--adm-muted)]">
        <p className="font-medium text-white/80">Realtime feed</p>
        <p className="mt-1">Use `/api/dev/simulate-event` to generate live traffic while developing.</p>
      </div>
    </aside>
  );
}
