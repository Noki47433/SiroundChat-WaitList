import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";

type ReservationRow = {
  id: string;
  conversation_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  party_size: number | null;
  datetime: string;
  notes: string | null;
  created_at: string;
};

const formatReservationDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

export default async function ReservationsPage() {
  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reservations</p>
        <h2 className="text-3xl font-semibold">Track upcoming visits</h2>
        <p className="text-sm text-white/60">Log in to review reservation requests.</p>
      </div>
    );
  }

  const { data: reservations } = await (supabase as any)
    .from("reservations")
    .select(
      "id, conversation_id, customer_name, customer_phone, customer_email, party_size, datetime, notes, created_at"
    )
    .eq("business_id", tenant.businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (reservations ?? []) as ReservationRow[];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reservations</p>
        <h2 className="mt-2 text-3xl font-semibold">Stay on top of bookings</h2>
        <p className="mt-2 text-sm text-white/60">Review reservations submitted from your site.</p>
      </div>

      <Card>
        {rows.length ? (
          <div className="space-y-4">
            {rows.map((reservation) => (
              <div key={reservation.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{reservation.customer_name ?? "Guest"}</p>
                    <p className="text-xs text-white/60">{formatReservationDateTime(reservation.datetime)}</p>
                    <p className="mt-1 text-xs text-white/60">
                      {reservation.customer_phone ? `Phone: ${reservation.customer_phone}` : ""}
                      {reservation.customer_email ? ` Email: ${reservation.customer_email}` : ""}
                      {reservation.party_size ? ` Party: ${reservation.party_size}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-white/50">
                    <p>{new Date(reservation.created_at).toLocaleString()}</p>
                    {reservation.conversation_id ? (
                      <Link
                        href={`/dashboard/conversations/${reservation.conversation_id}`}
                        className="mt-2 inline-flex text-yellow-300"
                      >
                        View conversation
                      </Link>
                    ) : null}
                  </div>
                </div>
                {reservation.notes ? <p className="mt-2 text-xs text-white/50">Notes: {reservation.notes}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">No reservation submissions yet.</p>
        )}
      </Card>
    </div>
  );
}
