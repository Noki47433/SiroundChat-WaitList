import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resolveOwnedBusiness = async (supabase: any, userId: string, requestedBusinessId: string | null) => {
  if (requestedBusinessId) {
    const { data } = await (supabase as any)
      .from("businesses")
      .select("id")
      .eq("id", requestedBusinessId)
      .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
      .maybeSingle();

    return data?.id ?? null;
  }

  const { data } = await (supabase as any)
    .from("businesses")
    .select("id")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrelaunchUserAllowed(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const businessId = await resolveOwnedBusiness(supabase, user.id, url.searchParams.get("business_id"));
  if (!businessId) {
    return NextResponse.json({ announcement: null, business_id: null }, { status: 200 });
  }

  const nowIso = new Date().toISOString();

  const [allAudience, businessAudience] = await Promise.all([
    (supabase as any)
      .from("announcements")
      .select("id, status, audience, business_id, emoji, preset, title, body, cta_label, cta_url, starts_at, ends_at, is_dismissible")
      .in("status", ["published", "scheduled"])
      .eq("audience", "all")
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("starts_at", { ascending: false })
      .limit(20),
    (supabase as any)
      .from("announcements")
      .select("id, status, audience, business_id, emoji, preset, title, body, cta_label, cta_url, starts_at, ends_at, is_dismissible")
      .in("status", ["published", "scheduled"])
      .eq("audience", "business")
      .eq("business_id", businessId)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("starts_at", { ascending: false })
      .limit(20)
  ]);

  const announcements = [...(allAudience.data ?? []), ...(businessAudience.data ?? [])]
    .sort((a: any, b: any) => +new Date(b.starts_at) - +new Date(a.starts_at))
    .slice(0, 40);

  if (!announcements.length) {
    return NextResponse.json({ announcement: null, business_id: businessId }, { status: 200 });
  }

  const announcementIds = announcements.map((item: any) => item.id);
  const { data: reads } = await (supabase as any)
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .in("announcement_id", announcementIds);

  const readSet = new Set((reads ?? []).map((row: any) => row.announcement_id));
  const active = announcements.find((item: any) => !readSet.has(item.id)) ?? null;

  return NextResponse.json(
    {
      announcement: active,
      business_id: businessId
    },
    { status: 200 }
  );
}
