import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  reservationId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "canceled", "cancelled", "seated", "completed", "no_show"])
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

  if (!(await userHasLaunchAccess(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  const billingAccess = await getBusinessEntitlementAccess(tenant.businessId, "reservation_management");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("reservation_management", billingAccess);
  }

  const { reservationId } = parsed.data;
  const status = parsed.data.status === "cancelled" ? "canceled" : parsed.data.status;
  const updatePayload: Record<string, unknown> = { status };
  if (status === "canceled") {
    updatePayload.canceled_at = new Date().toISOString();
    updatePayload.canceled_by = "staff";
  }
  if (status === "seated") {
    updatePayload.seated_at = new Date().toISOString();
  }
  if (status === "completed") {
    updatePayload.completed_at = new Date().toISOString();
  }
  if (status === "no_show") {
    updatePayload.no_show_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("reservations")
    .update(updatePayload)
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
