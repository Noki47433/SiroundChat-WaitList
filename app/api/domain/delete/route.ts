import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Custom domain removal is not available until domain management is fully integrated." },
    { status: 410 }
  );
}
