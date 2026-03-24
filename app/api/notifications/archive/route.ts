import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const notificationId = payload?.notification_id;

  if (!notificationId || typeof notificationId !== "string") {
    return NextResponse.json({ error: "Missing notification_id" }, { status: 400 });
  }

  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const admin = getSupabaseAdminClient() as any;

  const { data: notification } = await admin
    .from("notifications")
    .select("id, business_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (!notification || notification.business_id !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
