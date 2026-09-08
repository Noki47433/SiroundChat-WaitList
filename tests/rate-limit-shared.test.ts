/**
 * Stage 3E — one budget, not one budget per instance.
 *   RATE_LIMIT_REDIS_URL=redis://:pw@127.0.0.1:6399 npx tsx tests/rate-limit-shared.test.ts
 *
 * "Rate limited" has meant something weaker than it sounded. The limiter counted
 * in the memory of whichever serverless instance happened to answer, so a limit
 * of twenty was twenty *per instance* — and nobody controls how many instances
 * there are. Under exactly the traffic a limit exists to survive, the platform
 * adds instances, and the limit loosens precisely when it is needed.
 *
 * A single-process test cannot tell those two worlds apart: with one instance,
 * per-instance and global are the same number. So this test refuses to be a
 * single process. It forks two children that share nothing but the Redis URL,
 * has them spend against one key at the same time, and insists the total allowed
 * across both is the limit — not twice it.
 *
 * Without a shared backend the same test must FAIL, and there is a check below
 * that proves it does, so a green run cannot be an accident of configuration.
 */
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

import { checkRateLimit, isSharedRateLimitActive } from "@/lib/utils/rate-limit";

const REDIS = process.env.RATE_LIMIT_REDIS_URL ?? "";
const SELF = fileURLToPath(import.meta.url);

// ── child mode ──────────────────────────────────────────────────────────────
// Spend `attempts` against `key` and report how many were allowed.
if (process.env.RL_CHILD === "1") {
  const key = process.env.RL_KEY!;
  const limit = Number(process.env.RL_LIMIT);
  const attempts = Number(process.env.RL_ATTEMPTS);
  void (async () => {
    let allowed = 0;
    for (let i = 0; i < attempts; i += 1) {
      const result = await checkRateLimit({ key, limit, windowInSeconds: 60 });
      if (result.allowed) allowed += 1;
    }
    process.send?.({ allowed, shared: await isSharedRateLimitActive() });
    process.exit(0);
  })();
} else {
  let passed = 0;
  let failed = 0;

  const ok = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log("PASS " + name);
      passed += 1;
    } catch (error) {
      console.error("FAIL " + name + "\n     " + (error as Error).message);
      failed += 1;
    }
  };

  const spend = (key: string, limit: number, attempts: number, redisUrl: string) =>
    new Promise<{ allowed: number; shared: boolean }>((resolve, reject) => {
      const child = fork(SELF, [], {
        execArgv: ["--import", "tsx"],
        env: {
          ...process.env,
          RL_CHILD: "1",
          RL_KEY: key,
          RL_LIMIT: String(limit),
          RL_ATTEMPTS: String(attempts),
          RATE_LIMIT_REDIS_URL: redisUrl
        },
        stdio: ["ignore", "inherit", "inherit", "ipc"]
      });
      let result: { allowed: number; shared: boolean } | null = null;
      child.on("message", (message) => {
        result = message as { allowed: number; shared: boolean };
      });
      child.on("exit", (code) => {
        if (result) resolve(result);
        else reject(new Error(`child exited ${code} without reporting`));
      });
      child.on("error", reject);
    });

  void (async () => {
    if (!REDIS) {
      console.error(
        "SKIP — no RATE_LIMIT_REDIS_URL. This suite exists to prove cross-process\n" +
          "       enforcement and cannot prove it without a shared backend."
      );
      process.exit(1);
    }

    await ok("the shared backend actually connects (TLS/AUTH as configured)", async () => {
      assert.equal(
        await isSharedRateLimitActive(),
        true,
        "the limiter did not adopt the shared backend — check the URL, password and TLS scheme"
      );
    });

    await ok("two independent processes share one budget", async () => {
      const key = `stage3e:shared:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const limit = 10;
      // Twenty attempts across two processes against a limit of ten. Per-instance
      // counting allows twenty; one shared counter allows ten.
      const [a, b] = await Promise.all([spend(key, limit, 10, REDIS), spend(key, limit, 10, REDIS)]);
      assert.equal(a.shared, true, "child A did not use the shared backend");
      assert.equal(b.shared, true, "child B did not use the shared backend");
      assert.equal(
        a.allowed + b.allowed,
        limit,
        `expected ${limit} allowed across both processes, got ${a.allowed} + ${b.allowed}`
      );
    });

    await ok("the same test fails without a shared backend — so green means something", async () => {
      const key = `stage3e:memory:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const limit = 10;
      // Same shape, no Redis: each process keeps its own counter and the total
      // comes to twice the limit. This is the world the canary was living in.
      const [a, b] = await Promise.all([spend(key, limit, 10, ""), spend(key, limit, 10, "")]);
      assert.equal(a.shared, false);
      assert.equal(b.shared, false);
      assert.equal(
        a.allowed + b.allowed,
        limit * 2,
        "memory-only counting should have allowed twice the limit; if it did not, this test is not proving what it claims"
      );
    });

    await ok("a request over the limit reports how long to wait", async () => {
      const key = `stage3e:retry:${Date.now()}`;
      for (let i = 0; i < 3; i += 1) await checkRateLimit({ key, limit: 2, windowInSeconds: 60 });
      const result = await checkRateLimit({ key, limit: 2, windowInSeconds: 60 });
      assert.equal(result.allowed, false);
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      assert.ok(retryAfter > 0 && retryAfter <= 60, `Retry-After should be within the window, got ${retryAfter}`);
    });

    console.log(`\n${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}
