import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Legacy billing checkout session endpoint is disabled. Use /api/billing/start-trial instead." },
    { status: 410 }
  );
}
