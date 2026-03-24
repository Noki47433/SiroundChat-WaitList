import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedBusinessId = url.searchParams.get("business_id");
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);

  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const businessId = requestedBusinessId ?? context.businessId;
  if (businessId !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient() as any;

  const { data: notifications } = await admin
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : DEFAULT_LIMIT);

  const { count: unreadCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null)
    .is("archived_at", null);

  const { data: badges } = await admin
    .from("business_badges")
    .select("earned_at, badge_definitions (key, name, icon, rarity)")
    .eq("business_id", businessId)
    .order("earned_at", { ascending: false })
    .limit(3);

  const { data: existingSettings } = await admin
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
