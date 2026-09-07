/**
 * Phase 2 · Stage 4 · S11 — Secure manage-booking token.
 *
 * A high-entropy, single-booking token for no-account customer management.
 * Only the SHA-256 hash is ever stored (`booking.manage_token_hash`); the raw
 * token is returned once to be delivered in the manage link and never persisted
 * or logged. The token IS the authorization for exactly one booking.
 */
import { createHash, randomBytes } from "crypto";

export type ManageToken = { token: string; hash: string };

/** 256 bits of entropy, URL-safe. */
export function generateManageToken(): ManageToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashManageToken(token) };
}

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape guard before we bother hashing / hitting the DB. */
export function looksLikeManageToken(value: string): boolean {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}
