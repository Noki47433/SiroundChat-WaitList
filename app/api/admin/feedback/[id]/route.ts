import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { adminUpdateFeedbackReport } from "@/lib/feedback/mutations";
import { adminGetFeedbackReport } from "@/lib/feedback/queries";

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
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const detail = await adminGetFeedbackReport(params.id, {
      supabase: guard.supabase,
      adminUserId: guard.userId
    });

    if (!detail.report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(detail, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load feedback report"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: { id: string };
  }
) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const payload = await request.json();
    const row = await adminUpdateFeedbackReport(params.id, payload, {
      supabase: guard.supabase,
      adminUserId: guard.userId
    });

    return NextResponse.json({ row }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update feedback report"
      },
      { status: 400 }
    );
  }
}
