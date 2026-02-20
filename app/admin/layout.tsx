import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guards";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin("/admin");

  return (
    <ToastProvider>
      <div className="admin-theme min-h-screen bg-[var(--adm-bg)] text-[var(--adm-text)]">
        <div className="admin-grid-bg min-h-screen">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-h-screen flex-1 flex-col">
              <Topbar fullName={profile?.full_name} />
              <main className="flex-1 p-4 sm:p-5 lg:p-6">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
