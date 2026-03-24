import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const PROJECT_ID = process.env.PAYSERA_PROJECT_ID ?? "";
const SIGN_PASSWORD = process.env.PAYSERA_SIGN_PASSWORD ?? "";
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1_000_000;

function sign(data: string) {
  return crypto.createHash("md5").update(data + SIGN_PASSWORD).digest("hex");
}

function parseAmount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    return null;
  }

  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return null;
  }

  return amount;
}

export async function POST(req: Request) {
  // Generates a Paysera checkout URL on the server for payment testing.
  if (!PROJECT_ID || !SIGN_PASSWORD) {
    return NextResponse.json({ error: "Payment provider unavailable" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = parseAmount((body as { amount?: unknown } | null)?.amount);
  if (amount === null) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const orderId = `order_${Date.now()}`;

  const params = new URLSearchParams({
    projectid: PROJECT_ID,
    orderid: orderId,
    amount: amount.toString(),
    currency: "EUR",
    accepturl: "https://siroundchat.com",
    cancelurl: "https://siroundchat.com",
    callbackurl: "https://siroundchat.com/api/paysera/callback",
    test: "1"
  });

  const data = Buffer.from(params.toString(), "utf8").toString("base64");
  const signHash = sign(data);
  const redirectUrl = new URL("https://bank.paysera.com/pay/");
  redirectUrl.searchParams.set("data", data);
  redirectUrl.searchParams.set("sign", signHash);

  return NextResponse.json({ url: redirectUrl.toString() });
}
