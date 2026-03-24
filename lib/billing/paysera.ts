import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import {
  BILLING_CURRENCY,
  SETUP_AMOUNT_CENTS,
  type BillingPlanId
} from "@/lib/billing/plans";

const PAYSERA_CHECKOUT_URL = "https://www.paysera.com/pay/";

type SerializableValue = string | number | boolean | null | undefined;

type CallbackInput = {
  data: string;
  ss1?: string | null;
  sign?: string | null;
};

type CheckoutRequestInput = {
  orderId: string;
  callbackUrl: string;
  acceptUrl: string;
  cancelUrl: string;
  planId: BillingPlanId;
};

type RenewalRequestInput = {
  orderId: string;
  amountCents: number;
  currency: string;
  callbackUrl: string;
  acceptUrl: string;
  cancelUrl: string;
  issuedToken: string;
  planId: BillingPlanId;
};

const toBuffer = (value: string) => Buffer.from(value, "utf8");

const toBase64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  return Buffer.from(`${base64}${padding}`, "base64").toString("utf8");
};

const buildQueryString = (fields: Record<string, SerializableValue>) => {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, rawValue]) => {
    if (rawValue === null || rawValue === undefined) return;
    params.set(key, String(rawValue));
  });
  return params.toString();
};

const requiredEnv = () => {
  const projectId = process.env.PAYSERA_PROJECT_ID;
  const signPassword = process.env.PAYSERA_SIGN_PASSWORD;

  if (!projectId || !signPassword) {
    throw new Error("Missing Paysera env vars. Set PAYSERA_PROJECT_ID and PAYSERA_SIGN_PASSWORD.");
  }

  return { projectId, signPassword };
};

export const hasPayseraCheckoutConfig = () =>
  Boolean(process.env.PAYSERA_PROJECT_ID && process.env.PAYSERA_SIGN_PASSWORD);

export const shouldUsePayseraDemoMode = () =>
  process.env.NODE_ENV !== "production" && !hasPayseraCheckoutConfig();

const createMd5 = (value: string) => createHash("md5").update(value, "utf8").digest("hex");

const safeEqualHex = (left: string, right: string) => {
  const leftBuffer = toBuffer(left);
  const rightBuffer = toBuffer(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const encodePayseraData = (fields: Record<string, SerializableValue>) => {
  const query = buildQueryString(fields);
  return toBase64Url(query);
};

export const decodePayseraData = (data: string) => {
  const decoded = fromBase64Url(data);
  return Object.fromEntries(new URLSearchParams(decoded));
};

export const signPayseraData = (data: string, signPassword: string) => createMd5(`${data}${signPassword}`);

export const verifyPayseraCallbackSignature = ({ data, ss1, sign }: CallbackInput) => {
  const { signPassword } = requiredEnv();
  const actual = signPayseraData(data, signPassword);
  const provided = (ss1 ?? sign ?? "").trim().toLowerCase();
  if (!provided) return false;
  return safeEqualHex(actual, provided);
};

const signedCheckoutPayload = (fields: Record<string, SerializableValue>) => {
  const { signPassword } = requiredEnv();
  const data = encodePayseraData(fields);
  const sign = signPayseraData(data, signPassword);
  return { data, sign };
};

export const buildSetupCheckoutRedirectUrl = ({
  orderId,
  callbackUrl,
  acceptUrl,
  cancelUrl,
  planId
}: CheckoutRequestInput) => {
  const { projectId } = requiredEnv();
  const { data, sign } = signedCheckoutPayload({
    projectid: projectId,
    orderid: orderId,
    amount: SETUP_AMOUNT_CENTS,
    currency: BILLING_CURRENCY,
    accepturl: acceptUrl,
    cancelurl: cancelUrl,
    callbackurl: callbackUrl,
    token_strategy: "required",
    method_key: "card",
    billing_plan_id: planId,
    version: "1.6"
  });

  const redirectUrl = new URL(PAYSERA_CHECKOUT_URL);
  redirectUrl.searchParams.set("data", data);
  redirectUrl.searchParams.set("sign", sign);
  return redirectUrl.toString();
};

export const createRecurringPayseraPayment = async ({
  orderId,
  amountCents,
  currency,
  callbackUrl,
  acceptUrl,
  cancelUrl,
  issuedToken,
  planId
}: RenewalRequestInput) => {
  const { projectId } = requiredEnv();
  const { data, sign } = signedCheckoutPayload({
    projectid: projectId,
    orderid: orderId,
    amount: amountCents,
    currency,
    callbackurl: callbackUrl,
    accepturl: acceptUrl,
    cancelurl: cancelUrl,
    token_strategy: "required",
    method_key: "card",
    recurring: "1",
    issued_token: issuedToken,
    billing_plan_id: planId,
    version: "1.6"
  });

  const response = await fetch(PAYSERA_CHECKOUT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ data, sign }).toString(),
    cache: "no-store"
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Paysera recurring request failed (${response.status})`);
  }

  return {
    ok: true,
    status: response.status,
    body: bodyText
  };
};
