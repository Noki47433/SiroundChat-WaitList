import type { Socket } from "net";
import type { RateLimitBackend, RateLimitResult } from "@/lib/utils/rate-limit";

// Load the Node built-in `net` lazily and in a way the bundler cannot statically see, so this
// module is safe to include in an Edge bundle (the Redis backend is only ever instantiated in the
// Node runtime; `loadNet()` runs only when an actual connection is opened). This avoids the Vercel
// Edge "referencing unsupported modules: net" error.
type NetModule = typeof import("net");
// `__non_webpack_require__` is webpack's escape hatch: it is NOT added to the module graph (so
// `net` never appears in the Edge bundle), and at runtime in the Node server it resolves to the
// real Node `require` (so `net` actually loads). Falls back to a plain `require` outside webpack.
declare const __non_webpack_require__: ((id: string) => unknown) | undefined;
let _net: NetModule | null = null;
function loadNet(): NetModule {
  if (!_net) {
    const req =
      typeof __non_webpack_require__ === "function"
        ? __non_webpack_require__
        : (eval("require") as (id: string) => unknown);
    _net = req("net") as NetModule;
  }
  return _net;
}

// P0 COST-1 (verification-discovered corrective work) — a shared, cross-instance rate-limit
// backend using a minimal Redis (RESP) client built on Node's built-in `net`. NO new npm
// dependency. Fixed-window counter: INCR the key, set PEXPIRE on first hit, read PTTL for reset.
// Multiple serverless instances/processes pointed at the same Redis share one counter.

type RespValue = string | number | null | Array<RespValue>;

class MiniRedis {
  private host: string;
  private port: number;
  private socket: Socket | null = null;
  private queue: Array<{ resolve: (v: RespValue) => void; reject: (e: Error) => void }> = [];
  private buf = Buffer.alloc(0);
  private connecting: Promise<void> | null = null;

  constructor(url: string) {
    // Accepts redis://host:port or host:port
    const stripped = url.replace(/^redis:\/\//, "");
    const [host, port] = stripped.split(":");
    this.host = host || "127.0.0.1";
    this.port = Number(port || 6379);
  }

  private connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      const s = loadNet().createConnection({ host: this.host, port: this.port });
      s.setNoDelay(true);
      s.on("connect", () => { this.socket = s; this.connecting = null; resolve(); });
      s.on("error", (e) => { this.connecting = null; reject(e); });
      s.on("data", (d) => this.onData(d));
      s.on("close", () => { this.socket = null; });
    });
    return this.connecting;
  }

  private onData(chunk: Buffer) {
    this.buf = Buffer.concat([this.buf, chunk]);
    // Parse as many complete replies as are buffered.
    let parsed = this.tryParse();
    while (parsed.done) {
      const waiter = this.queue.shift();
      if (waiter) {
        if (parsed.value instanceof Error) waiter.reject(parsed.value);
        else waiter.resolve(parsed.value as RespValue);
      }
      this.buf = this.buf.subarray(parsed.consumed);
      parsed = this.tryParse();
    }
  }

  // Minimal RESP parser for the reply types we use (+, -, :, $, *).
  private tryParse(): { done: boolean; value?: RespValue | Error; consumed: number } {
    const nl = this.buf.indexOf("\r\n");
    if (nl === -1) return { done: false, consumed: 0 };
    const type = String.fromCharCode(this.buf[0]);
    const line = this.buf.subarray(1, nl).toString();
    if (type === "+") return { done: true, value: line, consumed: nl + 2 };
    if (type === ":") return { done: true, value: Number(line), consumed: nl + 2 };
    if (type === "-") return { done: true, value: new Error(line), consumed: nl + 2 };
    if (type === "$") {
      const len = Number(line);
      if (len === -1) return { done: true, value: null, consumed: nl + 2 };
      const start = nl + 2;
      if (this.buf.length < start + len + 2) return { done: false, consumed: 0 };
      return { done: true, value: this.buf.subarray(start, start + len).toString(), consumed: start + len + 2 };
    }
    // Arrays are not needed for our commands; treat as unsupported.
    return { done: true, value: new Error("unsupported RESP type"), consumed: nl + 2 };
  }

  async cmd(args: Array<string | number>): Promise<RespValue> {
    await this.connect();
    const parts = args.map(String);
    let out = `*${parts.length}\r\n`;
    for (const p of parts) out += `$${Buffer.byteLength(p)}\r\n${p}\r\n`;
    return new Promise<RespValue>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.socket!.write(out);
    });
  }

  async ping(): Promise<boolean> {
    try { return (await this.cmd(["PING"])) === "PONG"; } catch { return false; }
  }
}

export class RedisRateLimitBackend implements RateLimitBackend {
  private redis: MiniRedis;
  constructor(url: string) { this.redis = new MiniRedis(url); }

  async healthy(): Promise<boolean> { return this.redis.ping(); }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const k = `rl:${key}`;
    const count = Number(await this.redis.cmd(["INCR", k]));
    if (count === 1) await this.redis.cmd(["PEXPIRE", k, windowMs]);
    const pttl = Number(await this.redis.cmd(["PTTL", k]));
    const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt, limit };
  }
}

/**
 * Build the shared backend from RATE_LIMIT_REDIS_URL (or UPSTASH_REDIS_TCP_URL). Returns null if
 * no URL is configured — callers decide whether that is acceptable (see getRateLimitMode()).
 */
export function buildRedisBackendFromEnv(): RedisRateLimitBackend | null {
  const url = process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL;
  if (!url) return null;
  return new RedisRateLimitBackend(url);
}
