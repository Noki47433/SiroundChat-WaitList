import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Debug Paysera checkout generation is disabled for launch." }, { status: 410 });
}
