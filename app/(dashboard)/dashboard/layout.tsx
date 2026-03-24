import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Sidebar } from "@/app/(dashboard)/dashboard/_components/Sidebar";
import { Topbar } from "@/app/(dashboard)/dashboard/_components/Topbar";
import { BusinessUpdateBanner } from "@/app/(dashboard)/dashboard/_components/BusinessUpdateBanner";
import { DashboardOnboardingCoach } from "@/app/(dashboard)/dashboard/_components/DashboardOnboardingCoach";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/tenant";

const dashboardBodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--dash-body-font"
});

const dashboardHeadingFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--dash-heading-font"
});

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const auth = await requireUser("/dashboard");
  const authUser = auth.user;
  const userMetadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const rawOrgName =
    (typeof userMetadata.business_name === "string" && userMetadata.business_name.trim()) ||
    (typeof userMetadata.businessName === "string" && userMetadata.businessName.trim()) ||
    "SiroundChat";
  const fallbackOrgName = rawOrgName || "SiroundChat";
  const userName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()) ||
    (authUser?.email ? authUser.email.split("@")[0] : "Team Member");

  const supabase = getSupabaseServerClient();
  let resolvedBusinessId: string | undefined;
  let resolvedOrgName = fallbackOrgName;

  if (authUser?.id) {
    const { data: businessRow, error: businessError } = await (supabase as any)
      .from("businesses")
      .select("id, business_name")
      .or(`owner_id.eq.${authUser.id},owner_user_id.eq.${authUser.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (businessError) {
      console.error("[DASHBOARD_BUSINESS_LOOKUP_ERROR]", businessError);
    }

    if (businessRow?.id) {
      resolvedBusinessId = businessRow.id;
      resolvedOrgName = businessRow.business_name?.trim() || fallbackOrgName;
    } else {
      try {
        const ensured = await ensureBusinessRow({
          userId: authUser.id,
          businessName: fallbackOrgName
        });
        resolvedBusinessId = ensured.businessId || undefined;
      } catch (error) {
        console.error("[DASHBOARD_ENSURE_BUSINESS_ERROR]", error);
      }
    }
  }

  return (
    <ToastProvider>
      <div
        className={`${dashboardBodyFont.variable} ${dashboardHeadingFont.variable} dashboard-theme min-h-dvh text-white`}
      >
        <div className="flex min-h-dvh">
          <Sidebar orgName={resolvedOrgName} />
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <Topbar
              orgName={resolvedOrgName}
              userName={userName || "Team Member"}
              businessId={resolvedBusinessId}
            />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
              <div className="space-y-4">
                <DashboardOnboardingCoach userId={authUser?.id} businessId={resolvedBusinessId} />
                <BusinessUpdateBanner businessId={resolvedBusinessId} />
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
