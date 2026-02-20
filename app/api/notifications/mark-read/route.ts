import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const notificationId = payload?.notification_id;

  if (!notificationId || typeof notificationId !== "string") {
    return NextResponse.json({ error: "Missing notification_id" }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: notification } = await (supabase as any)
    .from("notifications")
    .select("id, business_id, businesses!inner(owner_id)")
    .eq("id", notificationId)
    .eq("businesses.owner_id", user.id)
    .maybeSingle();

  if (!notification) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await (supabase as any)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
