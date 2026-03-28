import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import {
  approveAccessRequest,
  rejectAccessRequest
} from "@/lib/server/invite-access";

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

  const payload = (await request.json().catch(() => null)) as
    | { action?: "approve" | "reject" }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required." }, { status: 400 });
  }

  try {
    if (payload.action === "approve") {
      const result = await approveAccessRequest(params.id, guard.userId);
      return NextResponse.json(
        {
          ok: true,
          invite: {
            id: result.invite.id,
            code: result.invite.code,
            expires_at: result.invite.expires_at,
            assigned_email: result.invite.assigned_email,
            assigned_business_name: result.invite.assigned_business_name
          }
        },
        { status: 200 }
      );
    }

    await rejectAccessRequest(params.id, guard.userId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[ADMIN_ACCESS_REQUEST_ACTION_ERROR]", { requestId: params.id, error });
    return NextResponse.json({ error: "Unable to update access request." }, { status: 500 });
  }
}
