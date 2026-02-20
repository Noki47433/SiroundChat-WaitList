import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("business_id");
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);

  if (!businessId) {
    return NextResponse.json({ error: "Missing business_id" }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: notifications } = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : DEFAULT_LIMIT);

  const { count: unreadCount } = await (supabase as any)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null)
    .is("archived_at", null);

  const { data: badges } = await (supabase as any)
    .from("business_badges")
    .select("earned_at, badge_definitions (key, name, icon, rarity)")
    .eq("business_id", businessId)
    .order("earned_at", { ascending: false })
    .limit(3);

  const admin = getSupabaseAdminClient();
  const { data: existingSettings } = await (supabase as any)
    .from("business_notification_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  let settings = existingSettings ?? null;
  if (!settings) {
    const { data: created } = await (admin as any)
      .from("business_notification_settings")
      .insert({ business_id: businessId })
      .select("*")
      .single();
    settings = created ?? null;
  }
  if (!settings) {
    settings = {
      deliver_in_app: true,
      deliver_push: true,
      min_severity_to_toast: "success",
      currency: "EUR",
      avg_order_value: null,
      close_rate: null
    };
  }

  const latestBadges =
    (badges ?? [])
      .map((row: any) => ({
        key: row.badge_definitions?.key ?? "",
        name: row.badge_definitions?.name ?? "",
        icon: row.badge_definitions?.icon ?? "",
        rarity: row.badge_definitions?.rarity ?? "common",
        earned_at: row.earned_at
      }))
      .filter((row: any) => row.key) ?? [];

  return NextResponse.json({
    notifications: notifications ?? [],
    unread_count: unreadCount ?? 0,
    latest_badges: latestBadges,
    settings
  });
}
