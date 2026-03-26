import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const requestedBusinessId = payload?.business_id;

  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const businessId = typeof requestedBusinessId === "string" ? requestedBusinessId : context.businessId;
  if (businessId !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClientIfAvailable() as any;
  if (!admin) {
    console.error("[NOTIFICATIONS_MARK_ALL_READ_CONFIG_MISSING]", { businessId });
    return NextResponse.json({ error: "Notifications are unavailable right now." }, { status: 500 });
  }

  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .is("read_at", null)
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
