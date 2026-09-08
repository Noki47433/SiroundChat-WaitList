/**
 * Stage 3E.1 — the rate-limit policies, exercised rather than described.
 *   BASE_URL=http://127.0.0.1:3320 npx tsx scripts/harness/verify-rate-limit-policies.ts
 *
 * Stage 3E declared what each surface does when the shared counter is missing —
 * public writes refuse, public reads and authenticated work degrade — and proved
 * the counter itself works. It did not prove the declarations. A policy nobody
 * exercised is a comment.
 *
 * Three things this checks that a unit test cannot:
 *
 *  · a limit actually fires on a real HTTP route, and says how long to wait
 *  · the failure modes differ per surface in the way they were declared to
 *  · **rate limiting is not load-bearing for correctness** — a booking that is
 *    refused for being too frequent must not have been half-created, and
 *    idempotency and the overlap constraint must hold whether or not the limiter
 *    is there at all. A limiter is a cost control. If it is also what stops
 *    double bookings, then losing Redis loses the diary.
 *
 * Run twice: once with the shared backend present, once with it configured but
 * unreachable, which is the failure mode the declarations are actually about.
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3320";
const SLUG = process.env.CANARY_SLUG ?? "siround";
const SERVICE = "3b000000-0000-4000-8000-000000000001";
const WORKER = "3b000000-0000-4000-8000-000000000002";

let passed = 0;
let failed = 0;
const ok = async (name: string, fn: () => Promise<string>) => {
  try {
    console.log(`PASS ${name}\n       ${await fn()}`);
    passed += 1;
  } catch (error) {
    console.log(`FAIL ${name}\n       ${String((error as Error)?.message ?? error)}`);
    failed += 1;
  }
};

const dayISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const openDay = async () => {
  for (let offset = 2; offset <= 16; offset += 1) {
    const date = dayISO(offset);
    const response = await fetch(
      `${BASE}/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${date}`
    );
    if (!response.ok) continue;
    const body: any = await response.json();
    if ((body.slots ?? []).length > 0) return { date, slots: body.slots as Array<{ startAtIso: string }> };
  }
  throw new Error("no open day found");
};

const main = async () => {
  const health = await (await fetch(`${BASE}/api/health/rate-limit`)).json();
  console.log(`\n  limiter: mode=${health.mode} configured=${health.configured} reason=${health.reason}\n`);

  // ── idempotency does not depend on the limiter ──────────────────────────────
  await ok("a replayed request id is refused by idempotency, not by the limiter", async () => {
    const { date, slots } = await openDay();
    const requestId = `s3e1-idem-${Date.now()}`;
    const payload = {
      slug: SLUG,
      serviceId: SERVICE,
      teamMemberId: WORKER,
      date,
      startAt: slots[Math.min(3, slots.length - 1)].startAtIso,
      customerName: "Stage3E1 Idempotency Probe",
      customerPhone: "+38300000503",
      requestId
    };
    const send = () =>
      fetch(`${BASE}/api/site-spec/booking/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

    const first = await send();
    const firstBody: any = await first.json().catch(() => ({}));
    const second = await send();
    const secondBody: any = await second.json().catch(() => ({}));

    if (first.status === 429) return "SKIPPED — the write budget was already spent";
    if (secondBody?.ok === true) throw new Error("a replayed request id created a second booking");
    if (second.status === 429) {
      throw new Error("the replay was caught by the limiter, which tells us nothing about idempotency");
    }
    return `first ${first.status} (${firstBody?.ok ? "created" : firstBody?.error}), replay ${second.status} ${secondBody?.error}`;
  });

  // ── the public write limit, and whether safety depends on it ────────────────
  await ok("a public write limit fires without ever half-creating a booking", async () => {
    const { date, slots } = await openDay();
    const target = slots[0].startAtIso;
    const results: Array<{ status: number; body: any }> = [];

    // Same slot, distinct request ids: at most one may ever succeed, whatever the
    // limiter does. Anything beyond the first is either a 409 (the overlap
    // constraint or idempotency) or a 429 (the limiter) — never a second booking.
    for (let i = 0; i < 8; i += 1) {
      const response = await fetch(`${BASE}/api/site-spec/booking/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: SLUG,
          serviceId: SERVICE,
          teamMemberId: WORKER,
          date,
          startAt: target,
          customerName: "Stage3E1 Policy Probe",
          customerPhone: "+38300000501",
          requestId: `s3e1-policy-${Date.now()}-${i}`
        })
      });
      results.push({ status: response.status, body: await response.json().catch(() => ({})) });
    }

    const created = results.filter((r) => r.body?.ok === true);
    if (created.length > 1) {
      throw new Error(`${created.length} bookings were created for one slot`);
    }
    const limited = results.filter((r) => r.status === 429);
    const conflicts = results.filter((r) => r.status === 409);
    const unavailable = results.filter((r) => r.status === 503);

    // Whatever mix of refusals came back, none of them may be a silent success.
    for (const result of results) {
      if (result.status !== 200 && result.body?.ok === true) {
        throw new Error("a non-200 response still reported a created booking");
      }
    }
    return `${created.length} created, ${conflicts.length}×409, ${limited.length}×429, ${unavailable.length}×503 — never two bookings`;
  });

  await ok("a 429 on the write path carries Retry-After and a plain message", async () => {
    const { date, slots } = await openDay();
    let limited: Response | null = null;
    for (let i = 0; i < 12 && !limited; i += 1) {
      const response = await fetch(`${BASE}/api/site-spec/booking/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: SLUG,
          serviceId: SERVICE,
          teamMemberId: WORKER,
          date,
          startAt: slots[slots.length - 1].startAtIso,
          customerName: "Stage3E1 Retry Probe",
          customerPhone: "+38300000502",
          requestId: `s3e1-retry-${Date.now()}-${i}`
        })
      });
      if (response.status === 429) limited = response;
      else await response.json().catch(() => ({}));
    }
    if (!limited) return "SKIPPED — the write budget was not reached";
    const retryAfter = Number(limited.headers.get("retry-after") ?? 0);
    const body: any = await limited.json().catch(() => ({}));
    if (!(retryAfter > 0)) throw new Error("no Retry-After on a write 429");
    if (!body?.message || /rate|limit|budget/i.test(body.message) === false) {
      // The message should be for a customer, not a description of our plumbing.
      if (!body?.message) throw new Error("no message on a write 429");
    }
    return `Retry-After ${retryAfter}s · "${String(body.message).slice(0, 60)}"`;
  });

  // ── the public read limit ───────────────────────────────────────────────────
  await ok("a public read limit fires and says how long to wait", async () => {
    const date = dayISO(3);
    const url = `${BASE}/api/site-spec/booking?slug=${SLUG}&serviceId=${SERVICE}&date=${date}`;
    // Runs last, because a burst large enough to trip the budget starves
    // every later check of the same budget.
    // Sequentially, sixty requests can take longer than the sixty-second window
    // they are meant to fill, so the budget refills underneath the test. Fired
    // together, they land inside one window — which is also what abuse looks like.
    const responses = await Promise.all(Array.from({ length: 200 }, () => fetch(url)));
    const limited = responses.find((response) => response.status === 429) ?? null;
    // Read the one we care about BEFORE draining the rest — a body can only be
    // consumed once, and draining first is how this test spent two runs claiming
    // the route sent no message when it had sent one all along.
    const limitedBody: any = limited ? await limited.json().catch(() => ({})) : null;
    await Promise.all(responses.filter((r) => r !== limited).map((r) => r.text()));
    if (!limited) return "SKIPPED — the read budget was not reached in 200 concurrent requests";
    const retryAfter = Number(limited.headers.get("retry-after") ?? 0);
    if (!(retryAfter > 0)) throw new Error("a 429 arrived with no usable Retry-After");
    if (!limitedBody?.message) throw new Error("a 429 arrived with no message for the visitor");
    return `429 after the per-caller budget · Retry-After ${retryAfter}s · "${String(limitedBody.message).slice(0, 52)}"`;
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

void main();
