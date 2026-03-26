import { NextResponse } from "next/server";
import {
  decodePayseraData,
  verifyPayseraCallbackSignature
} from "@/lib/billing/paysera";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";

const getField = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const parseMinorUnitAmount = (value: unknown) => {
  const raw = getField(value);
  if (!raw) return null;

  const normalized = raw.replace(",", ".").trim();
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
};

const extractAmountCents = (payload: Record<string, unknown>) => {
  const directMinorCandidates = [payload.amount, payload.payamount];
  for (const candidate of directMinorCandidates) {
    const parsed = parseMinorUnitAmount(candidate);
    if (parsed !== null) return parsed;
  }

  const majorUnitCandidates = [payload.request_amount, payload.pay_amount];
  for (const candidate of majorUnitCandidates) {
    const parsed = parseMinorUnitAmount(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const extractCurrency = (payload: Record<string, unknown>) =>
  (
    getField(payload.currency) ??
    getField(payload.request_currency) ??
    getField(payload.paycurrency) ??
    getField(payload.pay_currency)
  )?.toUpperCase() ?? null;

const buildTrustedPayload = (decoded: Record<string, unknown>, transport: "get" | "post") => ({
  provider: "paysera",
  transport,
  received_at: new Date().toISOString(),
  decoded
});

const readFormEntries = async (request: Request) => {
  try {
    const formData = await request.formData();
    return new URLSearchParams(
      Array.from(formData.entries()).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value] as const] : []
      )
    );
  } catch {
    return null;
  }
};

const extractEnvelope = async (request: Request) => {
  const url = new URL(request.url);
  const queryParams = new URLSearchParams(url.searchParams);

  if (request.method === "POST") {
    const formEntries = await readFormEntries(request);
    if (formEntries) {
      formEntries.forEach((value, key) => {
        queryParams.set(key, value);
      });
    }
  }

  const data = getField(queryParams.get("data"));
  const ss1 = getField(queryParams.get("ss1"));
  const sign = getField(queryParams.get("sign"));

  return {
    data,
    ss1,
    sign,
    transport: request.method === "POST" ? "post" : "get"
  } as const;
};

const handleCallback = async (request: Request) => {
  if (!process.env.PAYSERA_SIGN_PASSWORD) {
    return new NextResponse("Unavailable", { status: 500 });
  }

  const envelope = await extractEnvelope(request);
  if (!envelope.data || (!envelope.ss1 && !envelope.sign)) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (!verifyPayseraCallbackSignature({ data: envelope.data, ss1: envelope.ss1, sign: envelope.sign })) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = decodePayseraData(envelope.data);
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const admin = getSupabaseServerAdminClient() as any;
  const trustedPayload = buildTrustedPayload(decoded, envelope.transport);
  const payseraOrderId = getField(decoded.orderid);
  const providerStatus = getField(decoded.status);
  const amountCents = extractAmountCents(decoded);
  const currency = extractCurrency(decoded);
  const providerProjectId = getField(decoded.projectid);
  const providerTestMode = getField(decoded.test) === "1";

  const { data, error } = await admin.rpc("billing_finalize_paysera_callback", {
    p_paysera_orderid: payseraOrderId,
    p_provider_status: providerStatus,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_provider_project_id: providerProjectId,
    p_provider_test_mode: providerTestMode,
    p_raw_payload: trustedPayload
  });

  if (error) {
    console.error("[BILLING_PAYSERA_CALLBACK_FINALIZE_ERROR]", {
      orderId: payseraOrderId,
      status: providerStatus,
      error
    });
    return new NextResponse("Retry", { status: 500 });
  }

  if (data && typeof data === "object") {
    return new NextResponse("OK");
  }

  return new NextResponse("Retry", { status: 500 });
};

export async function GET(request: Request) {
  return handleCallback(request);
}

export async function POST(request: Request) {
  return handleCallback(request);
}
