// Provider-neutral rate limiter (P0 COST-1 / SEC-2).
//
// The DEFAULT backend is in-memory (per-instance). On serverless this is a FAST PATH, not a
// cross-instance guarantee. A shared backend (e.g. Upstash/Redis, Postgres token-bucket) can be
// injected via setRateLimitBackend() once the credential is configured — see the P0 remediation
// report for the exact activation step. Until then, cross-instance enforcement is best-effort
// (documented residual risk); the abstraction below means callers do not change when it is added.

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  limit: number;
};

export interface RateLimitBackend {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

type Bucket = { hits: number; resetAt: number };

class MemoryRateLimitBackend implements RateLimitBackend {
  private buckets = new Map<string, Bucket>();

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { hits: 0, resetAt: now + windowMs };
    }
    bucket.hits += 1;
    this.buckets.set(key, bucket);

    // Opportunistic cleanup so the Map does not grow unbounded on long-lived instances.
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) {
        if (b.resetAt <= now) this.buckets.delete(k);
      }
    }

    return {
      allowed: bucket.hits <= limit,
      remaining: Math.max(0, limit - bucket.hits),
      resetAt: bucket.resetAt,
      limit
    };
  }
}

let backend: RateLimitBackend = new MemoryRateLimitBackend();
let backendMode: "memory" | "shared" = "memory";

/** Inject a shared backend (e.g. Redis) — activation point for cross-instance limiting. */
export function setRateLimitBackend(next: RateLimitBackend) {
  backend = next;
  backendMode = "shared";
}

// Lazy, idempotent activation of the shared backend from env. This is the RELIABLE wiring point:
// in Next's App Router, module state set from instrumentation.ts does NOT propagate to route-handler
// bundles, so each request-handling context must be able to self-initialize the shared backend.
let sharedInit: Promise<void> | null = null;
export function ensureRateLimitReady(): Promise<void> {
  if (backendMode === "shared") return Promise.resolve();
  if (sharedInit) return sharedInit;
  const url = process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL;
  if (!url) return Promise.resolve();
  sharedInit = (async () => {
    try {
      const { RedisRateLimitBackend } = await import("@/lib/utils/rate-limit-redis");
      const b = new RedisRateLimitBackend(url);
      if (await b.healthy()) setRateLimitBackend(b);
    } catch {
      /* stay on memory backend */
    }
  })();
  return sharedInit;
}

/**
 * Health/config signal (P0 COST-1). Reports whether distributed (cross-instance) enforcement is
 * active. `productionSafe` is false when running memory-only in production — surface this so the
 * app never silently claims protection it does not have. Broad public launch requires "shared".
 */
export function getRateLimitMode(): { mode: "memory" | "shared"; productionSafe: boolean } {
  const isProd = process.env.NODE_ENV === "production";
  return { mode: backendMode, productionSafe: backendMode === "shared" || !isProd };
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds = 60, message = "Too many attempts") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RateLimitOptions = {
  key: string;
  limit: number;
  windowInSeconds: number;
};

/** Non-throwing check. Returns the result so callers can emit 429 + Retry-After themselves. */
export async function checkRateLimit({ key, limit, windowInSeconds }: RateLimitOptions): Promise<RateLimitResult> {
  await ensureRateLimitReady(); // self-install the shared backend from env on first use
  return backend.hit(key, limit, windowInSeconds * 1000);
}

/**
 * Backward-compatible throwing variant (used by existing callers). Throws RateLimitError with a
 * retryAfterSeconds hint when the limit is exceeded.
 */
export async function enforceRateLimit({ key, limit, windowInSeconds }: RateLimitOptions) {
  const result = await checkRateLimit({ key, limit, windowInSeconds });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitError(retryAfter);
  }
}
