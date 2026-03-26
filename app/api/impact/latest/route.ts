import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Period = "weekly" | "monthly";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") as Period | null;

  if (period !== "weekly" && period !== "monthly") {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

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

  const { data: summary, error: summaryError } = await (supabase as any)
    .from("business_impact_summaries")
    .select("*")
    .eq("business_id", business.id)
    .eq("period", period)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (summaryError) {
    return NextResponse.json({ error: summaryError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary: summary ?? null });
}
