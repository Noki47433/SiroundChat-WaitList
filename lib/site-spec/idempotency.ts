/**
 * Claiming a mutating request exactly once.
 *
 * The problem is narrow and real: a flaky connection, an impatient second click,
 * or a platform-level retry delivers the same POST twice. Without a claim, the
 * second delivery spends another model call and appends another version — and
 * for generation there is no stale-parent check to catch it, because a first
 * draft has no parent to compare against.
 *
 * The claim reuses the rate limiter rather than adding a store, because a window
 * of exactly one hit per key *is* a single-use claim. That is not a trick: it
 * inherits the limiter's memory→shared backend upgrade path, so the claim
 * becomes cross-instance the moment a Redis URL is configured, with no code
 * change here. Until then it is per-instance — the same documented residual risk
 * the limiter already carries, and the stale-version guard is the second lock
 * behind it for every edit.
 *
 * Deliberately NOT a response cache. A duplicate does not get the original
 * result replayed; it gets told it was a duplicate, and the client reloads the
 * real state. Replaying a stored response would mean holding generated site
 * content in a cache, and being wrong about it would be worse than a reload.
 */
import { checkRateLimit } from "@/lib/utils/rate-limit";

/** How long a key stays claimed. Long enough to outlive any sane retry window. */
export const CLAIM_WINDOW_SECONDS = 15 * 60;

/**
 * Returns true when this caller owns the request.
 *
 * A caller that supplies no key is never blocked: an absent key means "I am not
 * asking for deduplication", which is the correct behaviour for scripts and for
 * any client that has not been updated.
 *
 * The key is namespaced by business as well as by scope. The request id comes
 * from the client, so without that namespace one tenant could — by guessing or
 * by replaying an id — burn a claim belonging to another and make their next
 * genuine request look like a duplicate. Namespacing makes the claim space
 * per-tenant, so the worst a caller can do is interfere with themselves.
 */
export const claimRequestOnce = async (
  scope: string,
  businessId: string,
  requestId: string | null | undefined
): Promise<boolean> => {
  if (!requestId) return true;
  const result = await checkRateLimit({
    key: `site-spec:claim:${scope}:${businessId}:${requestId}`,
    limit: 1,
    windowInSeconds: CLAIM_WINDOW_SECONDS
  });
  return result.allowed;
};
