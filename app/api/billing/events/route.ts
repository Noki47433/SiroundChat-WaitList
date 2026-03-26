import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Legacy billing events endpoint is disabled for launch." },
    { status: 410 }
  );
}
