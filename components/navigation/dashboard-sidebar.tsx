"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/icons/LogoMark";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/sites", label: "Sites" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/analytics/website", label: "Website Analytics" },
  { href: "/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" }
];

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-screen w-64 flex-col border-r border-white/5 bg-neutral-950/80 px-5 py-8 lg:flex">
      <Link href="/dashboard" className="mb-10 flex items-center gap-3 text-white">
        <LogoMark className="h-10 w-10" />
        <div>
          <p className="text-lg font-semibold">SiroundChat</p>
          <p className="text-xs text-white/60">AI Websites + Chat</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-medium transition",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
