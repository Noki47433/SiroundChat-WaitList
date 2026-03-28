import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { createManualInviteCode } from "@/lib/server/invite-access";
import { ManualInviteCodeSchema } from "@/lib/validation/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const payload = await request.json().catch(() => null);
  const parsed = ManualInviteCodeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null;
  if (parsed.data.expiresAt && Number.isNaN(Date.parse(parsed.data.expiresAt))) {
    return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
  }

  try {
    const invite = await createManualInviteCode({
      assignedEmail: parsed.data.assignedEmail || null,
      assignedBusinessName: parsed.data.assignedBusinessName || null,
      maxUses: parsed.data.maxUses,
      expiresAt,
      createdByUserId: guard.userId
    });

    return NextResponse.json(
      {
        ok: true,
        invite: {
          id: invite.id,
          code: invite.code,
          assigned_email: invite.assigned_email,
          assigned_business_name: invite.assigned_business_name,
          max_uses: invite.max_uses,
          uses_count: invite.uses_count,
          is_active: invite.is_active,
          expires_at: invite.expires_at,
          created_at: invite.created_at
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN_MANUAL_INVITE_CREATE_ERROR]", error);
    return NextResponse.json({ error: "Unable to create invite code." }, { status: 500 });
  }
}
