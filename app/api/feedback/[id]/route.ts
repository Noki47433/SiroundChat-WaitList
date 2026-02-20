import { NextResponse } from "next/server";
import { getMyFeedbackReport } from "@/lib/feedback/queries";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: { id: string };
  }
) {
  try {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await getMyFeedbackReport(params.id, { supabase, userId: user.id });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ row }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load feedback report"
      },
      { status: 400 }
    );
  }
}
