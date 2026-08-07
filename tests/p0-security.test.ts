import assert from "node:assert/strict";

// Ensure a key exists before secret-box is exercised.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "p0-test-encryption-key-please-override";

import { encryptSecret, decryptSecret, isEncryptedSecret } from "@/lib/crypto/secret-box";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { GET as embedGet } from "@/app/api/embed/[siteId]/route";

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push({ name, run });

// ---- W2: secret-box ----
test("W2 encryptSecret round-trips and produces versioned ciphertext", () => {
  const secret = "wa_token_abc123!@#";
  const enc = encryptSecret(secret);
  assert.ok(isEncryptedSecret(enc), "ciphertext should carry the v1 prefix");
  assert.notEqual(enc, secret, "must not store plaintext");
  assert.equal(decryptSecret(enc), secret, "decrypt must return the original");
});

test("W2 decryptSecret passes legacy plaintext through unchanged", () => {
  assert.equal(decryptSecret("legacy-plaintext-token"), "legacy-plaintext-token");
  assert.equal(decryptSecret(null), null);
});

test("W2 encryption is non-deterministic (random IV per call)", () => {
  const a = encryptSecret("same");
  const b = encryptSecret("same");
  assert.notEqual(a, b, "two encryptions of the same value must differ");
  assert.equal(decryptSecret(a), "same");
  assert.equal(decryptSecret(b), "same");
});

// ---- COST-1: rate limiter ----
test("COST-1 checkRateLimit allows up to the limit then blocks", async () => {
  const key = `test-bucket-${Math.floor(performance.now())}-${tests.length}`;
  const limit = 3;
  const r1 = await checkRateLimit({ key, limit, windowInSeconds: 60 });
  const r2 = await checkRateLimit({ key, limit, windowInSeconds: 60 });
  const r3 = await checkRateLimit({ key, limit, windowInSeconds: 60 });
  const r4 = await checkRateLimit({ key, limit, windowInSeconds: 60 });
  assert.equal(r1.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r4.allowed, false, "the (limit+1)th call must be blocked");
  assert.equal(r1.remaining, 2);
  assert.ok(r4.resetAt > Date.now(), "resetAt should be in the future for Retry-After");
});

// ---- SEC-3: embed route no longer reflects attacker input ----
test("SEC-3 embed route rejects a non-UUID / XSS payload with an inert 404", async () => {
  const payload = 'x");alert(document.domain);//';
  const res = await embedGet(new Request("http://localhost/api/embed/x"), {
    params: { siteId: payload }
  });
  assert.equal(res.status, 404);
  const body = await res.text();
  assert.ok(!body.includes("alert("), "response must not reflect the payload");
  assert.ok(!body.includes("<script"), "response must contain no script tag");
});

test("SEC-3 embed route redirects a valid UUID without inline script", async () => {
  const uuid = "11111111-2222-4333-8444-555555555555";
  const res = await embedGet(new Request("http://localhost/api/embed/x"), {
    params: { siteId: uuid }
  });
  assert.equal(res.status, 307);
  const location = res.headers.get("location") ?? "";
  assert.ok(location.endsWith(`/embed/${uuid}`), `expected redirect to /embed/${uuid}, got ${location}`);
});

let passed = 0;
(async () => {
  for (const item of tests) {
    try {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      console.error(`FAIL ${item.name}`);
      throw error;
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed.`);
})();
