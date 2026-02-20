import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { adminAddInternalComment } from "@/lib/feedback/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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
    const body = (await request.json()) as { message?: string };
    const comment = await adminAddInternalComment(params.id, body.message ?? "", {
      supabase: guard.supabase,
      adminUserId: guard.userId
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add internal comment"
      },
      { status: 400 }
    );
  }
}
