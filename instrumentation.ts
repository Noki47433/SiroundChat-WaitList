// P0 COST-1 (staging-gate corrective work): activate the shared, cross-instance rate-limit backend
// at server startup when configured. Runs once per server process (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const url = process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL;
  if (!url) {
    // Intentionally left on the in-memory backend. getRateLimitMode() will report productionSafe:false
    // in production so the app never silently claims distributed protection it does not have.
    if (process.env.NODE_ENV === "production") {
      console.warn("[rate-limit] no RATE_LIMIT_REDIS_URL configured — running memory-only (NOT production-safe for public scale)");
    }
    return;
  }
  try {
    const { buildRedisBackendFromEnv } = await import("@/lib/utils/rate-limit-redis");
    const { setRateLimitBackend } = await import("@/lib/utils/rate-limit");
    const backend = buildRedisBackendFromEnv();
    if (backend && (await backend.healthy())) {
      setRateLimitBackend(backend);
      console.log("[rate-limit] shared Redis backend activated (cross-instance enforcement ON)");
    } else {
      console.error("[rate-limit] Redis backend configured but unhealthy — staying on memory-only");
    }
  } catch (e) {
    console.error("[rate-limit] failed to activate shared backend", e);
  }
}
