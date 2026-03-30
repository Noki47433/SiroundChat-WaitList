import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { approveBusinessAccess } from "@/lib/server/business-approvals";

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
    | { action?: "approve" }
    | null;

  if (payload?.action !== "approve") {
    return NextResponse.json({ error: "Approve action is required." }, { status: 400 });
  }

  try {
    await approveBusinessAccess(params.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[ADMIN_BUSINESS_APPROVAL_ERROR]", { businessId: params.id, error });
    return NextResponse.json({ error: "Unable to approve business." }, { status: 500 });
  }
}
