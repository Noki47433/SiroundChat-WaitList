"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DASHBOARD_NAV } from "./Sidebar";

const routeTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/conversations": "Conversations",
  "/dashboard/feedback": "Feedback",
  "/dashboard/leads": "Leads",
  "/dashboard/reservations": "Reservations",
  "/dashboard/documents": "Documents",
  "/dashboard/knowledge": "Knowledge",
  "/dashboard/bot-settings": "Bot Settings",
  "/dashboard/chatbot/sales": "Chatbot Sales",
  "/dashboard/automations": "Automations",
  "/dashboard/crm": "CRM",
  "/dashboard/channels": "Channels",
  "/dashboard/builder": "Website Builder",
  "/dashboard/analytics": "Analytics",
  "/dashboard/badges": "Badges",
  "/dashboard/billing": "Billing",
  "/dashboard/email-reports": "Email Reports",
  "/dashboard/account": "Account"
};

const resolveRouteTitle = (pathname: string | null) => {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/dashboard/builder")) return "Website Builder";
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
  const { push } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      push({ title: "Logout failed", message: error.message, variant: "error" });
      return;
    }
    push({ title: "Logged out", message: "Redirecting to login.", variant: "success" });
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((value) => !value)}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 lg:hidden"
          >
            Menu
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Current section</p>
            <h1 className="text-2xl font-semibold">{resolveRouteTitle(pathname)}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">Org: {orgName}</Badge>
          <NotificationBell businessId={businessId} />
          <div className="relative">
            <Button variant="secondary" onClick={() => setMenuOpen((value) => !value)}>
              {userName}
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-neutral-950 p-2 shadow-2xl">
                <Link
                  href="/dashboard/account"
                  className="block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Account
                </Link>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 lg:hidden">
          {DASHBOARD_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <Modal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Log out of SiroundChat?"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleLogout}>
              Log out
            </Button>
          </>
        }
      >
        Your session will end for this device. You can log back in anytime.
      </Modal>
    </header>
  );
}
