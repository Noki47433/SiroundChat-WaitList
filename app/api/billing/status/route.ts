import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ subscribed: false, plan: null }, { status: 200 });
  }

  const { data: subscription, error } = await (supabase as any)
    .from("subscriptions")
    .select("plan_id, status")
    .eq("business_id", tenant.businessId)
    .maybeSingle();

  if (error) {
    console.error("[BILLING_STATUS_ERROR]", error);
  }

  const plan = subscription?.plan_id ?? null;
  const status = subscription?.status ?? null;
  const subscribed = !!plan && (status === "active" || status === "trialing");

  return NextResponse.json({ subscribed, plan }, { status: 200 });
}
