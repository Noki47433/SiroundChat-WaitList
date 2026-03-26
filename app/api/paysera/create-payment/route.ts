import { NextResponse } from "next/server";
import { encodePayseraData, signPayseraData } from "@/lib/billing/paysera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYSERA_CHECKOUT_URL = "https://www.paysera.com/pay/";
const ACCEPT_URL = "https://siroundchat.com/dashboard/billing/success";
const CANCEL_URL = "https://siroundchat.com/dashboard/billing/cancel";
const CALLBACK_URL = "https://siroundchat.com/api/paysera/callback";

const PLAN_AMOUNTS = {
  chatbot: 1900,
  pro: 2900
} as const;

type PlanId = keyof typeof PLAN_AMOUNTS;

const isPlanId = (value: string | null): value is PlanId =>
  value === "chatbot" || value === "pro";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");

  if (!isPlanId(plan)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const projectId = process.env.PAYSERA_PROJECT_ID;
  const signPassword = process.env.PAYSERA_SIGN_PASSWORD;

  if (!projectId || !signPassword) {
    console.error("[PAYSERA_CREATE_PAYMENT_CONFIG_MISSING]");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const orderId = `homepage_${plan}_${Date.now()}`;
  const data = encodePayseraData({
    projectid: projectId,
    orderid: orderId,
    amount: PLAN_AMOUNTS[plan],
    currency: "EUR",
    accepturl: ACCEPT_URL,
    cancelurl: CANCEL_URL,
    callbackurl: CALLBACK_URL,
    test: 1,
    version: "1.6"
  });
  const sign = signPayseraData(data, signPassword);

  const redirectUrl = new URL(PAYSERA_CHECKOUT_URL);
  redirectUrl.searchParams.set("data", data);
  redirectUrl.searchParams.set("sign", sign);

  return NextResponse.redirect(redirectUrl);
}
