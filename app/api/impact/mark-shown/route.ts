import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const summaryId = typeof payload?.summaryId === "string" ? payload.summaryId : "";

  if (!summaryId) {
    return NextResponse.json({ error: "Missing summaryId" }, { status: 400 });
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: business, error: businessError } = await (supabase as any)
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  if (!business?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("business_impact_summaries")
    .update({ shown_at: new Date().toISOString() })
    .eq("id", summaryId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated?.id) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
