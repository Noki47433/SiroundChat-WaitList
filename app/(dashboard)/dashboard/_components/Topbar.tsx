"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { DASHBOARD_NAV } from "./Sidebar";

const routeTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/channels": "Channels",
  "/dashboard/inbox": "Inbox",
  "/dashboard/conversations": "Conversations",
  "/dashboard/leads": "Leads",
  "/dashboard/reservations": "Reservations",
  "/dashboard/bot-settings": "Bot Settings",
  "/dashboard/documents": "Documents",
  "/dashboard/feedback": "Feedback",
  "/dashboard/chatbot/sales": "Update Info",
  "/dashboard/integrations": "Integrations",
  "/dashboard/builder": "Website Builder",
  "/dashboard/onboarding": "Onboarding",
  "/dashboard/analytics": "Analytics",
  "/dashboard/analytics/website": "Website Analytics",
  "/dashboard/badges": "Badges",
  "/billing": "Billing",
  "/dashboard/settings": "Settings",
  "/dashboard/account": "Account"
};

const resolveRouteTitle = (pathname: string | null) => {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/dashboard/builder")) return "Website Builder";
  if (pathname.startsWith("/dashboard/analytics/website")) return "Website Analytics";
  if (pathname.startsWith("/dashboard/analytics")) return "Analytics";
  return routeTitles[pathname] ?? "Dashboard";
};

export function Topbar({
  orgName,
  userName,
  businessId
}: {
  orgName: string;
  userName: string;
  businessId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return;
    DASHBOARD_NAV.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  return (
    <header
      className={cn(
        "dashboard-surface sticky top-0 border-b px-4 py-4 sm:px-6 lg:px-10",
        mobileNavOpen ? "z-[140]" : "z-40"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((value) => !value)}
            className="dashboard-pill inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/75 lg:hidden"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>Menu</span>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Current section</p>
            <h1 className="dashboard-heading text-2xl font-semibold text-white">{resolveRouteTitle(pathname)}</h1>
          </div>
        </div>
      </div>

      {mounted
        ? createPortal(
            <div
              className={cn(
                "pointer-events-none fixed inset-0 z-[9999] lg:hidden",
                mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
              )}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 bg-black/65 transition-opacity",
                  mobileNavOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close mobile navigation"
              />
              <aside
                className={cn(
                  "dashboard-surface absolute inset-y-0 left-0 flex w-[min(86vw,19rem)] flex-col border-r p-4 shadow-2xl transition-transform duration-300",
                  mobileNavOpen ? "translate-x-0" : "-translate-x-full"
                )}
              >
                <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Navigation</p>
                    <p className="dashboard-heading mt-1 text-sm font-semibold text-white">SiroundChat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="dashboard-pill inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/75 hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto">
                  {DASHBOARD_NAV.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-tutorial-nav={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                          active
                            ? "dashboard-chip border-[#ffd87266] text-white"
                            : "border-transparent text-[var(--dash-muted)] hover:border-white/15 hover:bg-white/10 hover:text-white"
                        )}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#f7d56b]" /> : null}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </aside>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
