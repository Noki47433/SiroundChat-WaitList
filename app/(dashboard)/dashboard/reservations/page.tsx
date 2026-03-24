import { ReservationsTimelinePage } from "@/components/reservations/ReservationsTimelinePage";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const tenant = await getTenantFromSession();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reservations</p>
        <h2 className="text-3xl font-semibold">Track upcoming visits</h2>
        <p className="text-sm text-white/60">Log in to review reservation requests.</p>
      </div>
    );
  }

  return <ReservationsTimelinePage restaurantId={tenant.businessId} />;
}
