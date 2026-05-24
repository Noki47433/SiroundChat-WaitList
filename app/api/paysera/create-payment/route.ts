import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "This legacy Paysera route has been disabled. Use /api/billing/start-trial from the authenticated billing flow."
    },
    { status: 410 }
  );
}
