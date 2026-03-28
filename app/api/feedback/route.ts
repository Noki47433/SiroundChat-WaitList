import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { createFeedbackReport } from "@/lib/feedback/mutations";
import { listMyFeedbackReports } from "@/lib/feedback/queries";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resolveBusinessId = async (supabase: any, userId: string) => {
  const { data } = await (supabase as any)
    .from("businesses")
    .select("id")
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq("launch_access", true)
    .order("launch_access", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
};

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const rows = await listMyFeedbackReports({ supabase, userId: user.id, limit });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list feedback reports"
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json();
    const businessId = await resolveBusinessId(supabase, user.id);
    const created = await createFeedbackReport(payload, { supabase, userId: user.id, businessId });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create feedback report"
      },
      { status: 400 }
    );
  }
}
