import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Legacy billing plan mutation is disabled. Use the billing checkout flow instead." },
    { status: 410 }
  );
}
