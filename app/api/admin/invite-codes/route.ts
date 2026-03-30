import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;
  void request;
  void guard.userId;
  return NextResponse.json(
    { error: "Invite codes are disabled. Use onboarding approvals instead." },
    { status: 410 }
  );
}
