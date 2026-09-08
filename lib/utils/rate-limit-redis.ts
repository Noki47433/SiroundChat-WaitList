import type { Socket } from "net";
import type { RateLimitBackend, RateLimitResult } from "@/lib/utils/rate-limit";

// Load the Node built-in `net` lazily and in a way the bundler cannot statically see, so this
// module is safe to include in an Edge bundle (the Redis backend is only ever instantiated in the
// Node runtime; `loadNet()` runs only when an actual connection is opened). This avoids the Vercel
// Edge "referencing unsupported modules: net" error.
type NetModule = typeof import("net");
type TlsModule = typeof import("tls");
// `__non_webpack_require__` is webpack's escape hatch: it is NOT added to the module graph (so
// `net` never appears in the Edge bundle), and at runtime in the Node server it resolves to the
// real Node `require` (so `net` actually loads). Falls back to a plain `require` outside webpack.
declare const __non_webpack_require__: ((id: string) => unknown) | undefined;
let _net: NetModule | null = null;
let _tls: TlsModule | null = null;
const nodeRequire = (id: string): unknown => {
  const req =
    typeof __non_webpack_require__ === "function"
      ? __non_webpack_require__
      : (eval("require") as (id: string) => unknown);
  return req(id);
};
function loadNet(): NetModule {
  if (!_net) _net = nodeRequire("net") as NetModule;
  return _net;
}
// Every managed Redis worth pointing production at speaks TLS and requires a
// password — Upstash included. Loaded the same lazy way as `net`, for the same
// reason: it must never appear in an Edge bundle.
function loadTls(): TlsModule {
  if (!_tls) _tls = nodeRequire("tls") as TlsModule;
  return _tls;
}

// P0 COST-1 (verification-discovered corrective work) — a shared, cross-instance rate-limit
// backend using a minimal Redis (RESP) client built on Node's built-in `net`. NO new npm
// dependency. Fixed-window counter: INCR the key, set PEXPIRE on first hit, read PTTL for reset.
// Multiple serverless instances/processes pointed at the same Redis share one counter.

type RespValue = string | number | null | Array<RespValue>;

class MiniRedis {
  private host: string;
  private port: number;
  private tls = false;
  private username: string | null = null;
  private password: string | null = null;
  private authed = false;
  private socket: Socket | null = null;
  private queue: Array<{ resolve: (v: RespValue) => void; reject: (e: Error) => void }> = [];
  private buf = Buffer.alloc(0);
  private connecting: Promise<void> | null = null;

  constructor(url: string) {
    // Accepts redis://, rediss://, either with or without user:password@, and a
    // bare host:port. A managed provider hands you the first two forms; the last
    // is what a local Redis looks like in a test.
    let rest = url.trim();
    this.tls = /^rediss:\/\//i.test(rest);
    rest = rest.replace(/^rediss?:\/\//i, "");
    const at = rest.lastIndexOf("@");
    if (at !== -1) {
      const credentials = rest.slice(0, at);
      rest = rest.slice(at + 1);
      const colon = credentials.indexOf(":");
      if (colon === -1) {
        this.password = decodeURIComponent(credentials);
      } else {
        this.username = decodeURIComponent(credentials.slice(0, colon)) || null;
        this.password = decodeURIComponent(credentials.slice(colon + 1)) || null;
      }
    }
    const [host, port] = rest.split("/")[0].split(":");
    this.host = host || "127.0.0.1";
    this.port = Number(port || (this.tls ? 6380 : 6379));
  }

  private connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.authed = false;
    this.connecting = new Promise((resolve, reject) => {
      const ready = () => { this.socket = s; this.connecting = null; resolve(); };
      const s = this.tls
        ? (loadTls().connect({ host: this.host, port: this.port, servername: this.host }, ready) as unknown as Socket)
        : loadNet().createConnection({ host: this.host, port: this.port }, ready);
      s.setNoDelay(true);
      s.on("error", (e) => { this.connecting = null; reject(e); });
      s.on("data", (d) => this.onData(d));
      s.on("close", () => { this.socket = null; this.authed = false; });
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

  /** AUTH once per connection, before anything else goes down the socket. */
  private async authenticate(): Promise<void> {
    if (this.authed || !this.password) { this.authed = true; return; }
    // Marked authed first: AUTH itself goes through `send`, and re-entering here
    // would deadlock behind its own reply.
    this.authed = true;
    try {
      await this.send(this.username ? ["AUTH", this.username, this.password] : ["AUTH", this.password]);
    } catch (error) {
      this.authed = false;
      throw error;
    }
  }

  private send(args: Array<string | number>): Promise<RespValue> {
    const parts = args.map(String);
    let out = `*${parts.length}\r\n`;
    for (const p of parts) out += `$${Buffer.byteLength(p)}\r\n${p}\r\n`;
    return new Promise<RespValue>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.socket!.write(out);
    });
  }

  async cmd(args: Array<string | number>): Promise<RespValue> {
    await this.connect();
    await this.authenticate();
    return this.send(args);
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
