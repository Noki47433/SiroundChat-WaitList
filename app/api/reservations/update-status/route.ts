import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

const BodySchema = z.object({
  reservationId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled"])
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { reservationId, status } = parsed.data;
  const { data: updated, error: updateError } = await (supabase as any)
    .from("reservations")
    .update({ status })
    .eq("id", reservationId)
    .eq("business_id", tenant.businessId)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update reservation" }, { status: 500 });
  }

  if (status === "confirmed") {
    await (supabase as any).from("analytics_events").insert({
      business_id: tenant.businessId,
      type: "reservation_completed",
      metadata: { reservation_id: reservationId },
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
