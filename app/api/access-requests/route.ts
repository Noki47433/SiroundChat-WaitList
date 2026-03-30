import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ error: "This endpoint is no longer available." }, { status: 410 });
}
