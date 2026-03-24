import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const SIGN_PASSWORD = process.env.PAYSERA_SIGN_PASSWORD ?? "";

function verify(data: string, sign: string) {
  const hash = crypto.createHash("md5").update(data + SIGN_PASSWORD).digest("hex");
  const expected = Buffer.from(hash.toLowerCase(), "utf8");
  const provided = Buffer.from(sign.toLowerCase(), "utf8");

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

function getField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodePayseraData(data: string) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const decoded = Buffer.from(`${base64}${padding}`, "base64").toString("utf8");

  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall back to Paysera's query-string payload format.
  }

  return Object.fromEntries(new URLSearchParams(decoded));
}

export async function POST(req: Request) {
  // Verifies the Paysera callback on the server before any billing changes.
  if (!SIGN_PASSWORD) {
    return new NextResponse("Unavailable", { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const data = getField(formData.get("data"));
  const sign = getField(formData.get("sign")) ?? getField(formData.get("ss1"));

  if (!data || !sign) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (!verify(data, sign)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = decodePayseraData(data);
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (decoded.status === "1" || decoded.status === 1) {
    // TODO: After verified callback handling is wired to billing, activate the subscription here on the server only.
  }

  return new NextResponse("OK");
}
