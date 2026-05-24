import { ReservationsOpsDashboard } from "@/components/reservations/ReservationsOpsDashboard";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import { getTenantFromSession } from "@/lib/tenant";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveBotConfig, ACTION_TYPE_META, type ActionType } from "@/lib/config/industry-presets";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

async function getBusinessActionType(): Promise<ActionType> {
  try {
    const tenant = await getTenantFromSession();
    const supabase = getSupabaseServerClient();
    const { data } = await (supabase as any)
      .from("businesses")
      .select("onboarding_data")
      .eq("id", tenant.businessId)
      .maybeSingle();
    const botConfig = resolveBotConfig(data?.onboarding_data?.botConfig);
    return botConfig.actionType;
  } catch {
    return "restaurant_reservation";
  }
}

export default async function ReservationsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [access, actionType] = await Promise.all([
    getEntitlementAccess("reservation_management"),
    getBusinessActionType(),
  ]);

  const meta = ACTION_TYPE_META[actionType] ?? ACTION_TYPE_META.restaurant_reservation;
  const initialReservationId = toSingle(searchParams?.reservationId);

  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{meta.navLabel}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{meta.pageTitle}</h2>
          <p className="mt-2 text-sm text-white/60">{meta.pageSubtitle}</p>
        </div>
        <UpgradeOverlay
          entitlementKey="reservation_management"
          title={`Unlock ${meta.navLabel.toLowerCase()}`}
          description={`${meta.navLabel} management is available on plans built for website or chatbot-driven customer experiences.`}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-56 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-56 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
            <div className="h-56 rounded-[1.6rem] border border-white/10 bg-white/[0.03]" />
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  return <ReservationsOpsDashboard initialReservationId={initialReservationId} actionType={actionType} />;
}
