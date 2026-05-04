import { ReservationsOpsDashboard } from "@/components/reservations/ReservationsOpsDashboard";

export const dynamic = "force-dynamic";

const toSingle = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function ReservationsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialReservationId = toSingle(searchParams?.reservationId);

  return <ReservationsOpsDashboard initialReservationId={initialReservationId} />;
}
