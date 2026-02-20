import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { adminSearchFeedbackReports } from "@/lib/feedback/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const excludeId = searchParams.get("excludeId") ?? undefined;
    const rows = await adminSearchFeedbackReports(q, {
      excludeId,
      supabase: guard.supabase,
      adminUserId: guard.userId
    });
    return NextResponse.json({ rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search feedback reports"
      },
      { status: 400 }
    );
  }
}
