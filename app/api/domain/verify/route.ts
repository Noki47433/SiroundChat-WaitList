import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Automatic custom domain verification is not available until DNS verification is fully integrated." },
    { status: 410 }
  );
}
