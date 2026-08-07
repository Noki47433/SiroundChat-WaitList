import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// P0 W2 — authenticated encryption for secrets stored at rest (e.g. channel access tokens).
//
// Uses AES-256-GCM with a key derived from ENCRYPTION_KEY. Stored format is versioned and
// self-describing so decrypt can transparently pass through LEGACY PLAINTEXT values written
// before this change (backward-compatible; no production data rewrite required):
//
//   v1.gcm.<ivBase64>.<authTagBase64>.<ciphertextBase64>
//
// encryptSecret() throws if ENCRYPTION_KEY is absent — callers MUST treat that as "do not
// store the secret" rather than falling back to plaintext.

const PREFIX = "v1.gcm.";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    throw new Error("ENCRYPTION_KEY is not configured; refusing to handle secrets.");
  }
  const trimmed = raw.trim();
  // Accept a 32-byte key as hex or base64; otherwise derive a stable 32-byte key via SHA-256.
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through to derivation
  }
  return createHash("sha256").update(trimmed).digest();
}

export function isEncryptionAvailable(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.trim());
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/**
 * Decrypts a value produced by encryptSecret(). If the value is NOT in the v1 format it is
 * treated as legacy plaintext and returned unchanged (backward compatibility). Returns null
 * for null/undefined input.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!isEncryptedSecret(stored)) return stored; // legacy plaintext passthrough
  const rest = stored.slice(PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed encrypted secret");
  }
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return pt.toString("utf8");
}
