import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/log";

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

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as {
    announcement_id?: string;
    business_id?: string | null;
  } | null;

  const announcementId = body?.announcement_id?.trim();
  if (!announcementId) {
    return NextResponse.json({ error: "announcement_id is required." }, { status: 400 });
  }

  const businessId = await resolveOwnedBusiness(supabase, user.id, body?.business_id ?? null);
  if (!businessId) {
    return NextResponse.json({ error: "No business context found." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data: announcement } = await (supabase as any)
    .from("announcements")
    .select("id, title, audience, business_id, status, starts_at, ends_at")
    .eq("id", announcementId)
    .in("status", ["published", "scheduled"])
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .maybeSingle();

  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  if (announcement.audience === "business" && announcement.business_id !== businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await (supabase as any).from("announcement_reads").insert(
    {
      announcement_id: announcement.id,
      business_id: businessId,
      user_id: user.id
    },
    {
      onConflict: "announcement_id,user_id",
      ignoreDuplicates: true
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to dismiss announcement." }, { status: 400 });
  }

  await logActivity({
    businessId,
    userId: user.id,
    actorType: "business_user",
    eventType: "announcement_dismissed",
    summary: `Dismissed announcement: ${announcement.title}`,
    meta: { announcement_id: announcement.id }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
