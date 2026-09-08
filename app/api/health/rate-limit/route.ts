import { NextResponse } from "next/server";
import {
  ensureRateLimitReady,
  getRateLimitMode,
  isSharedRateLimitConfigured
} from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P0 COST-1 health/config signal: reports whether distributed (cross-instance) rate limiting is
// active. `productionSafe:false` means the app is running memory-only in production and must not be
// treated as protected at public scale.
export async function GET() {
  await ensureRateLimitReady();
  const mode = getRateLimitMode();
  const configured = isSharedRateLimitConfigured();
  return NextResponse.json(
    {
      ...mode,
      // Names only — never the URL, host or credential.
      configured,
      // "configured but memory" means a backend was given and is not answering,
      // which is an outage; "not configured" is a deployment gap.
      reason: mode.mode === "shared" ? "shared" : configured ? "configured_unreachable" : "not_configured"
    },
    {
      status: mode.productionSafe ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
