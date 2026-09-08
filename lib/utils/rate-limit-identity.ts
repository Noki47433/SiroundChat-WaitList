import "server-only";
import { createHash } from "node:crypto";

/**
 * Who a rate-limit budget belongs to.
 *
 * Keying only by tenant means one determined visitor can spend a whole business's
 * budget and lock out its real customers — the abuser succeeds by denying service
 * rather than by consuming it. Keying only by caller means a botnet gets a fresh
 * budget per address and the tenant's costs are unbounded. Public routes need
 * both, checked in that order: the tenant budget is the cost ceiling, the caller
 * budget is the fairness floor.
 *
 * The caller is identified by a salted hash, never by the address itself. It is
 * stable for the life of the salt, which is all a counter needs, and it is not a
 * record of who visited a website — nothing here is logged or stored.
 */
const SALT = process.env.RATE_LIMIT_IDENTITY_SALT ?? process.env.SUPABASE_JWT_SECRET ?? "site-spec";

export const callerId = (request: Request): string => {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const address =
    forwarded.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  return createHash("sha256").update(`${SALT}:${address}`).digest("hex").slice(0, 16);
};
