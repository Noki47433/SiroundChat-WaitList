import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { adminBulkUpdateFeedbackReports } from "@/lib/feedback/mutations";
import { adminListFeedbackReports } from "@/lib/feedback/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      queue: searchParams.get("queue") ?? undefined,
      triage_status: searchParams.get("triage_status") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      importance: searchParams.get("importance") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assigned_to: searchParams.get("assigned_to") ?? undefined,
      overdue: searchParams.get("overdue") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      sort: searchParams.get("sort") ?? undefined
    };
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("pageSize") ?? 25);

    const result = await adminListFeedbackReports(filters, { page, pageSize }, { supabase: guard.supabase, adminUserId: guard.userId });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list feedback reports"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const payload = (await request.json()) as {
      ids?: string[];
      patch?: Record<string, unknown>;
    };

    const result = await adminBulkUpdateFeedbackReports(payload.ids ?? [], payload.patch ?? {}, {
      supabase: guard.supabase,
      adminUserId: guard.userId
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to bulk update feedback reports"
      },
      { status: 400 }
    );
  }
}
