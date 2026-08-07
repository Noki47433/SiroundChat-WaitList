import { NextResponse } from "next/server";
import { getRateLimitMode, ensureRateLimitReady } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P0 COST-1 health/config signal: reports whether distributed (cross-instance) rate limiting is
// active. `productionSafe:false` means the app is running memory-only in production and must not be
// treated as protected at public scale.
export async function GET() {
  await ensureRateLimitReady();
  const mode = getRateLimitMode();
  return NextResponse.json(mode, {
    status: mode.productionSafe ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
