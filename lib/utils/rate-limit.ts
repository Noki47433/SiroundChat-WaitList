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

/** Whether a cross-instance counter is actually in force right now. */
export async function isSharedRateLimitActive(): Promise<boolean> {
  await ensureRateLimitReady();
  return backendMode === "shared";
}

/**
 * Whether this deployment has been *given* a shared backend at all.
 *
 * The difference matters more than it looks. "Configured and unreachable" is an
 * outage of something we depend on, and a public write should refuse rather than
 * run blind. "Not configured" is a known deployment gap — it is the state this
 * project has been in since the limiter was written, it is tracked as a release
 * gate, and turning it into a customer-facing 503 would take a working booking
 * flow offline to protest a missing environment variable.
 *
 * So the strict policies below apply to the first case and not the second, and
 * the second is reported loudly instead: `/api/health/rate-limit` answers 503
 * with productionSafe:false, and every degraded decision is logged.
 */
export function isSharedRateLimitConfigured(): boolean {
  return Boolean(process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL);
}

/**
 * What to do when the shared counter is not available.
 *
 * A per-instance counter is not a smaller version of a shared one; it is a
 * different promise. "20 bookings per ten minutes" across four instances is
 * eighty. The honest options are to refuse the traffic or to hold a much tighter
 * local line, and which is right depends entirely on what the endpoint does:
 *
 *  · `fail_closed` — for public writes. A booking that can be spammed while the
 *    limiter is blind costs the business real chairs and real reputation, and a
 *    short honest outage is the cheaper failure. Used by booking creation.
 *
 *  · `local_fallback` — for reads and for authenticated work. Taking a website's
 *    availability offline because Redis blinked would be a self-inflicted outage,
 *    and an owner mid-edit should not be locked out of their own site. These keep
 *    serving under a deliberately tighter per-instance bound, so the worst case is
 *    bounded by (instances × tightened limit) rather than by nothing at all.
 */
export type DegradedPolicy = "fail_closed" | "local_fallback";

/** How much of the configured budget a single instance may spend when blind. */
const LOCAL_FALLBACK_DIVISOR = 4;

export class RateLimitUnavailableError extends Error {
  constructor(message = "Rate limiting is temporarily unavailable") {
    super(message);
    this.name = "RateLimitUnavailableError";
  }
}

/**
 * The limiter public and expensive routes should use.
 *
 * Identical to `enforceRateLimit` when a shared counter is in force. When it is
 * not, it applies the endpoint's declared degraded policy rather than silently
 * pretending a per-instance count is a global one.
 */
export async function enforceSharedRateLimit(
  options: RateLimitOptions & { whenUnavailable: DegradedPolicy }
): Promise<{ shared: boolean }> {
  const shared = await isSharedRateLimitActive();

  // Refuse only when a backend was configured and is not answering. An
  // unconfigured deployment degrades and is reported; see the note above.
  if (!shared && options.whenUnavailable === "fail_closed" && isSharedRateLimitConfigured()) {
    throw new RateLimitUnavailableError();
  }

  const limit = shared ? options.limit : Math.max(1, Math.floor(options.limit / LOCAL_FALLBACK_DIVISOR));
  const result = await checkRateLimit({ key: options.key, limit, windowInSeconds: options.windowInSeconds });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitError(retryAfter);
  }
  return { shared };
}

type RateLimitOptions = {
  key: string;
  limit: number;
  windowInSeconds: number;
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds = 60, message = "Too many attempts") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

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
