import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Legacy billing status endpoint is disabled. Use /api/billing/subscription instead." },
    { status: 410 }
  );
}
