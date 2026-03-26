import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Legacy billing webhook endpoint is disabled." }, { status: 410 });
}
