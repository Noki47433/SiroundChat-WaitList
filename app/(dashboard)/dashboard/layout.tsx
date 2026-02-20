import type { ReactNode } from "react";
import { Sidebar } from "@/app/(dashboard)/dashboard/_components/Sidebar";
import { Topbar } from "@/app/(dashboard)/dashboard/_components/Topbar";
import { BusinessUpdateBanner } from "@/app/(dashboard)/dashboard/_components/BusinessUpdateBanner";
import { ToastProvider } from "@/components/ui/toast";
import { getOrgSummary, getUserSummary } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUser("/dashboard");

  const [org, user] = await Promise.all([getOrgSummary(), getUserSummary()]);
  const supabase = getSupabaseServerClient();
  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  let resolvedBusinessId = org?.id ?? null;
  if (!resolvedBusinessId && authUser?.id) {
    const { data: fallbackBusiness } = await (supabase as any)
      .from("businesses")
      .select("id")
      .or(`owner_id.eq.${authUser.id},owner_user_id.eq.${authUser.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedBusinessId = fallbackBusiness?.id ?? null;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="flex min-h-screen">
          <Sidebar orgName={org?.name ?? "SiroundChat"} />
          <div className="flex min-h-screen flex-1 flex-col">
            <Topbar
              orgName={org?.name ?? "SiroundChat"}
              userName={user?.name ?? "Team Member"}
              businessId={resolvedBusinessId ?? undefined}
            />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
              <div className="space-y-4">
                <BusinessUpdateBanner businessId={resolvedBusinessId ?? undefined} />
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
