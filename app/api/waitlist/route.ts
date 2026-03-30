import { NextResponse } from "next/server";

const disabledResponse = () =>
  NextResponse.json({ ok: false, error: "This endpoint is no longer available." }, { status: 410 });

export async function POST(request: Request) {
  void request;
  return disabledResponse();
}

export async function GET() {
  return disabledResponse();
}

export async function PUT() {
  return disabledResponse();
}

export async function PATCH() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}

export async function OPTIONS() {
  return disabledResponse();
}
