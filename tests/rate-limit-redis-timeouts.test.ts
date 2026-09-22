/**
 * Stage 3G.1 — the shared limiter's client cannot hang.
 *   npx tsx tests/rate-limit-redis-timeouts.test.ts
 *
 * Production showed four requests killed at Vercel's 300-second ceiling, one of
 * them a visitor's page, because this client waited forever in three different
 * places. Each is pinned here against a real socket:
 *
 *   · a connection that never completes (a TLS client against a plain server —
 *     the handshake simply never finishes, which is what a stalled managed Redis
 *     looks like)
 *   · a command whose reply never comes (a server that accepts and stays silent)
 *   · a socket that closes with commands still in flight
 *
 * Every budget is short on purpose: the limiter is a guard, not the work. What
 * matters is that the caller gets an ERROR, because the rate limiter has a
 * policy for an unreachable Redis and none for one that never answers.
 */
import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";

process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS = "300";
process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS = "300";

// Imported after the budgets are set above: they are read when the module loads.
type Backend = import("@/lib/utils/rate-limit-redis").RedisRateLimitBackend;
let RedisRateLimitBackend: new (url: string) => Backend;

let passed = 0;
let failed = 0;
let queue: Promise<void> = import("@/lib/utils/rate-limit-redis").then((mod) => {
  RedisRateLimitBackend = mod.RedisRateLimitBackend as unknown as new (url: string) => Backend;
});
const ok = (name: string, fn: () => Promise<void>) => {
  queue = queue.then(async () => {
    try { await fn(); console.log("PASS " + name); passed++; }
    catch (error) { console.error("FAIL " + name + "\n     " + (error as Error).message); failed++; }
  });
};

const listen = (onConnection: (socket: Socket) => void) =>
  new Promise<{ server: Server; port: number }>((resolve) => {
    const server = createServer(onConnection);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as any).port }));
  });

const within = async (budgetMs: number, work: () => Promise<unknown>) => {
  const started = Date.now();
  let threw = false;
  try { await work(); } catch { threw = true; }
  const elapsed = Date.now() - started;
  return { threw, elapsed, withinBudget: elapsed < budgetMs };
};

ok("a command whose reply never comes fails fast instead of hanging", async () => {
  const { server, port } = await listen(() => { /* accept, then say nothing at all */ });
  const backend = new RedisRateLimitBackend(`redis://127.0.0.1:${port}`);
  const result = await within(3_000, () => backend.hit("silent", 10, 60_000));
  server.close();
  assert.equal(result.threw, true, "a silent server must produce an error, not a hang");
  assert.ok(result.withinBudget, `took ${result.elapsed}ms — the command budget did not fire`);
});

ok("a connection that never completes fails fast", async () => {
  // A TLS client against a plain TCP server: the handshake never finishes and the
  // socket never errors — exactly the shape of the production stall.
  const { server, port } = await listen(() => { /* never speaks TLS */ });
  const backend = new RedisRateLimitBackend(`rediss://127.0.0.1:${port}`);
  const result = await within(3_000, () => backend.hit("stalled-handshake", 10, 60_000));
  server.close();
  assert.equal(result.threw, true, "a stalled handshake must produce an error");
  assert.ok(result.withinBudget, `took ${result.elapsed}ms — the connect budget did not fire`);
});

ok("a socket that closes mid-flight rejects the commands waiting on it", async () => {
  const { server, port } = await listen((socket: Socket) => { setTimeout(() => socket.destroy(), 50); });
  const backend = new RedisRateLimitBackend(`redis://127.0.0.1:${port}`);
  const result = await within(3_000, () => backend.hit("dropped", 10, 60_000));
  server.close();
  assert.equal(result.threw, true, "a closed socket must reject what was in flight");
  assert.ok(result.withinBudget, `took ${result.elapsed}ms`);
});

ok("healthy() reports false rather than hanging when Redis is unreachable", async () => {
  const { server, port } = await listen(() => { /* silent */ });
  const backend = new RedisRateLimitBackend(`redis://127.0.0.1:${port}`);
  const started = Date.now();
  const healthy = await backend.healthy();
  server.close();
  assert.equal(healthy, false);
  assert.ok(Date.now() - started < 3_000, "the health check hung");
});

ok("a working Redis still works: INCR, PEXPIRE and PTTL round-trip", async () => {
  // A tiny RESP server: enough to prove the client still speaks the protocol.
  let count = 0;
  const { server, port } = await listen((socket: Socket) => {
    socket.on("data", (chunk: Buffer) => {
      const command = chunk.toString().toUpperCase();
      if (command.includes("INCR")) socket.write(`:${++count}\r\n`);
      else if (command.includes("PEXPIRE")) socket.write(":1\r\n");
      else if (command.includes("PTTL")) socket.write(":60000\r\n");
      else socket.write("+OK\r\n");
    });
  });
  const backend = new RedisRateLimitBackend(`redis://127.0.0.1:${port}`);
  const first = await backend.hit("real", 2, 60_000);
  const second = await backend.hit("real", 2, 60_000);
  const third = await backend.hit("real", 2, 60_000);
  server.close();
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false, "the third hit is over a limit of two");
  assert.equal(first.limit, 2);
  assert.ok(first.resetAt > Date.now(), "resetAt should be in the future");
});

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  // Sockets deliberately left half-dead by these cases can keep the event loop
  // alive; the run is over, so end it rather than wait for them.
  process.exit(failed > 0 ? 1 : 0);
});
