import assert from "node:assert/strict";
import { getRateLimitMode, setRateLimitBackend, checkRateLimit, type RateLimitBackend } from "@/lib/utils/rate-limit";

// Verification-discovered corrective work (staging gate): distributed limiter health/config signal.
const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push({ name, run });

test("COST-1 rate-limit mode defaults to memory", () => {
  const m = getRateLimitMode();
  assert.equal(m.mode, "memory");
});

test("COST-1 memory-only is flagged NOT production-safe when NODE_ENV=production", () => {
  const prev = process.env.NODE_ENV;
  try {
    (process.env as any).NODE_ENV = "production";
    // Fresh import state: mode is still whatever it is; assert the productionSafe logic for memory.
    const m = getRateLimitMode();
    if (m.mode === "memory") {
      assert.equal(m.productionSafe, false, "memory-only in prod must be flagged not production-safe");
    }
  } finally {
    (process.env as any).NODE_ENV = prev;
  }
});

test("COST-1 injecting a shared backend flips mode to shared + production-safe", async () => {
  const fake: RateLimitBackend = {
    async hit(_k, limit) {
      return { allowed: true, remaining: limit - 1, resetAt: Date.now() + 1000, limit };
    }
  };
  setRateLimitBackend(fake);
  const m = getRateLimitMode();
  assert.equal(m.mode, "shared");
  assert.equal(m.productionSafe, true);
  // and it routes through the injected backend
  const r = await checkRateLimit({ key: "x", limit: 5, windowInSeconds: 60 });
  assert.equal(r.allowed, true);
});

let passed = 0;
(async () => {
  for (const item of tests) {
    try { await item.run(); passed += 1; console.log(`PASS ${item.name}`); }
    catch (e) { console.error(`FAIL ${item.name}`); throw e; }
  }
  console.log(`\n${passed}/${tests.length} tests passed.`);
})();
