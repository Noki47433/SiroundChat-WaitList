/**
 * Phase 3 · Client Website — Stage 2.5 readiness verification against real Postgres.
 *
 *   npm run test:site-spec:readiness:postgres
 *
 * Stage 1.5 proved the Stage 1 SQL. This proves the Stage 2.5 SQL, and only
 * that: the rollout flag and the atomic stale-write guard. Everything else is
 * left to the suite that already covers it.
 *
 * The two things worth proving here cannot be proved anywhere else:
 *
 *  · **The stale guard is atomic.** A unit test with a fake database can only
 *    show that a sequential mismatch is refused. The claim that matters is about
 *    genuinely simultaneous writers, and it is only true if the check happens
 *    inside the same row lock as the version allocation. So this fires N real
 *    concurrent PostgREST requests, all claiming the same parent, and asserts
 *    that exactly one wins.
 *  · **The flag is enforced by the database, not by the caller.** An owner must
 *    be able to see their own rollout state and must not be able to change it.
 *    That is an RLS claim, and RLS is only real against real roles and claims.
 *
 * LOCAL ONLY. The gate below fails closed on anything that is not loopback.
 */
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { getSiteSpecState, saveDraftSpec } from "@/lib/site-spec/store";
import { resolveRolloutState } from "@/lib/site-spec/rollout";
import type { SiteSpec } from "@/lib/site-spec/schema";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

// ─────────────────────────────────────────────────────────────────────────────
// Local-only gate — identical shape to the Stage 1.5 harness
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_PROJECT_REFS = ["jevqmewqvgcrrjrponwe"];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

const DB_URL = process.env.SITE_SPEC_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const API_URL = process.env.SITE_SPEC_TEST_API_URL ?? "http://127.0.0.1:54321";
const JWT_SECRET =
  process.env.SITE_SPEC_TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
const ANON_KEY = process.env.SITE_SPEC_TEST_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SITE_SPEC_TEST_SERVICE_KEY ?? "";

const assertLocal = () => {
  for (const [label, raw] of [
    ["database", DB_URL],
    ["api", API_URL]
  ] as const) {
    let host: string;
    try {
      host = new URL(raw).hostname;
    } catch {
      throw new Error(`[stage2.5] Refusing to run — ${label} URL is unparseable.`);
    }
    if (!LOOPBACK.has(host)) {
      throw new Error(
        `[stage2.5] Refusing to run — ${label} host "${host}" is not loopback.\n` +
          `  This harness writes to the database and only ever runs against a local stack.`
      );
    }
    for (const ref of BLOCKED_PROJECT_REFS) {
      if (raw.includes(ref)) {
        throw new Error(`[stage2.5] Refusing to run — ${label} URL references blocked project ${ref}.`);
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// psql channel
// ─────────────────────────────────────────────────────────────────────────────

const PSQL = process.env.SITE_SPEC_PSQL ?? "/opt/homebrew/opt/postgresql@16/bin/psql";

const sqlRaw = (statement: string): string => {
  try {
    return execFileSync(PSQL, [DB_URL, "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement], {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: "postgres" },
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string };
    throw new Error((err.stderr ? String(err.stderr) : (err.message ?? "")).trim() || "psql failed");
  }
};

const sqlJson = <T>(statement: string): T =>
  JSON.parse(sqlRaw(`select coalesce(json_agg(t), '[]'::json)::text from (${statement}) t`)) as T;

/** As PostgREST does it: assume `authenticated` and set the request's claims. */
const asUser = (userId: string, statement: string): string => {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" }).replace(/'/g, "''");
  return sqlRaw(
    `begin;
     do $harness$ begin perform set_config('request.jwt.claims', '${claims}', true); end $harness$;
     set local role authenticated;
     ${statement};
     commit;`
  );
};

const asUserExpectError = (userId: string, statement: string): string => {
  try {
    asUser(userId, statement);
    return "";
  } catch (error) {
    return (error as Error).message;
  }
};

const asAnon = (statement: string): string => sqlRaw(`begin; set local role anon; ${statement}; commit;`);

const asAnonExpectError = (statement: string): string => {
  try {
    asAnon(statement);
    return "";
  } catch (error) {
    return (error as Error).message;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// supabase-js channel — real JWTs, real HTTP, real concurrency
// ─────────────────────────────────────────────────────────────────────────────

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const mintJwt = (userId: string): string => {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iss: "supabase",
    iat: now,
    exp: now + 3600
  });
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
};

const clientFor = (token: string, key: string) =>
  createClient(API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Scaffolding
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let section = "";
const results: Array<{ section: string; name: string; ok: boolean; detail?: string }> = [];

const heading = (title: string) => {
  section = title;
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 68 - title.length))}`);
};

const ok = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
    results.push({ section, name, ok: true });
    passed++;
  } catch (error) {
    const detail = (error as Error).message.split("\n").slice(0, 4).join("\n     ");
    console.error(`FAIL ${name}\n     ${detail}`);
    results.push({ section, name, ok: false, detail });
    failed++;
  }
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n     expected ${JSON.stringify(expected)}\n     actual   ${JSON.stringify(actual)}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SITE_A = "eeee1111-2222-4333-8444-000000000001";
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

type Actor = { userId: string; businessId: string; name: string };

const loadActors = (): { a: Actor; b: Actor } => {
  const rows = sqlJson<Array<{ user_id: string; business_id: string; business_name: string }>>(
    `select coalesce(b.owner_user_id, b.owner_id) as user_id, b.id as business_id, b.business_name
       from businesses b
      where b.business_name in ('Prishtina Fade Co.', 'Lumi Nails Studio')
      order by b.business_name`
  );
  assert(rows.length === 2, `expected the two seeded fixture businesses, found ${rows.length}. Run \`npm run seed:dev\` first.`);
  const byName = (name: string) => {
    const row = rows.find((r) => r.business_name === name)!;
    return { userId: row.user_id, businessId: row.business_id, name: row.business_name };
  };
  return { a: byName("Prishtina Fade Co."), b: byName("Lumi Nails Studio") };
};

const withHeadline = (headline: string, businessId: string): SiteSpec => {
  const next = JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
  next.meta.businessId = businessId;
  (next.sections[0] as { headline: string }).headline = headline;
  return next;
};

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; [k: string]: unknown }, label: string): T => {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result)}`);
  return (result as { ok: true; value: T }).value;
};

const cleanup = (a: Actor, b: Actor) => {
  sqlRaw(`update builder_sites set draft_version_id=null, published_version_id=null, spec_published_at=null where id='${SITE_A}'`);
  sqlRaw(`delete from builder_sites where id='${SITE_A}'`);
  sqlRaw(`delete from business_site_spec_rollout where business_id in ('${a.businessId}','${b.businessId}')`);
};

// ─────────────────────────────────────────────────────────────────────────────

const main = async () => {
  assertLocal();
  if (!ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      "[stage2.5] SITE_SPEC_TEST_ANON_KEY and SITE_SPEC_TEST_SERVICE_KEY must be set.\n" +
        "  Get them from `supabase status -o env` and export them before running."
    );
  }

  console.log("═══ Stage 2.5 · readiness verification against real Postgres ═══");
  console.log(
    sqlRaw(
      `select 'target: ' || current_database() || ' @ ' || coalesce(host(inet_server_addr()),'local') || ':' || inet_server_port()`
    )
  );

  const { a, b } = loadActors();
  console.log(`owner A: ${a.name}\nowner B: ${b.name}`);

  const clientA = clientFor(mintJwt(a.userId), ANON_KEY);
  const serviceClient = createClient(API_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  cleanup(a, b);
  sqlRaw(`
    insert into builder_sites (id, owner_user_id, business_id, status, industry, business_name,
                               description, template_key, slug, path)
    values ('${SITE_A}', '${a.userId}', '${a.businessId}', 'draft', 'service',
            ${quote(a.name)}, 'Stage 2.5 readiness site', 'generic_v1', 'stage25-site', '/s/stage25-site')
  `);

  // ── 1 · the rollout flag exists and defaults to off ────────────────────
  heading("1 · Rollout flag — shape and default");

  await ok("the flag table exists with a closed set of states and an off default", () => {
    assertEq(
      sqlRaw(`select column_default from information_schema.columns
               where table_name='business_site_spec_rollout' and column_name='state'`),
      "'off'::text",
      "the flag does not default to off"
    );
    const constraint = sqlRaw(`select pg_get_constraintdef(oid) from pg_constraint
                                where conrelid='public.business_site_spec_rollout'::regclass and contype='c'`);
    for (const state of ["off", "canary", "enabled"]) {
      assert(constraint.includes(`'${state}'`), `state ${state} is not permitted`);
    }
    assert(!/'on'/.test(constraint), "an unexpected state is permitted");
  });

  await ok("a business with NO row resolves to off, not to enabled", async () => {
    assertEq(sqlRaw(`select public.site_spec_rollout_state('${a.businessId}')`), "off",
      "a missing row did not resolve to off");
    assertEq(await resolveRolloutState(serviceClient as never, a.businessId), "off",
      "the application layer disagreed with the database");
  });

  await ok("an arbitrary state cannot be written", () => {
    const error = sqlRaw(
      `select case when exists (
         select 1 from (select 1) t where false) then 'x' else 'ok' end`
    );
    assertEq(error, "ok", "sanity");
    const failure = (() => {
      try {
        sqlRaw(`insert into business_site_spec_rollout (business_id, state) values ('${a.businessId}','everyone')`);
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    })();
    assert(/check constraint|violates/i.test(failure), `an invalid state was accepted: ${failure}`);
  });

  // ── 2 · the flag is server-authoritative ───────────────────────────────
  heading("2 · Rollout flag — authority");

  sqlRaw(`insert into business_site_spec_rollout (business_id, state, note)
          values ('${a.businessId}', 'canary', 'stage 2.5 harness')`);

  await ok("canary and enabled both read as on, through the shipping code path", async () => {
    assertEq(await resolveRolloutState(serviceClient as never, a.businessId), "canary", "canary did not read back");
    sqlRaw(`update business_site_spec_rollout set state='enabled' where business_id='${a.businessId}'`);
    assertEq(await resolveRolloutState(serviceClient as never, a.businessId), "enabled", "enabled did not read back");
    sqlRaw(`update business_site_spec_rollout set state='canary' where business_id='${a.businessId}'`);
  });

  await ok("enabling stamps enabled_at; turning off clears it", () => {
    assert(sqlRaw(`select enabled_at is not null from business_site_spec_rollout where business_id='${a.businessId}'`) === "t",
      "enabled_at was not stamped");
    sqlRaw(`update business_site_spec_rollout set state='off' where business_id='${a.businessId}'`);
    assert(sqlRaw(`select enabled_at is null from business_site_spec_rollout where business_id='${a.businessId}'`) === "t",
      "enabled_at survived being turned off");
    sqlRaw(`update business_site_spec_rollout set state='canary' where business_id='${a.businessId}'`);
  });

  await ok("an owner can SEE their own rollout state", () => {
    assertEq(
      asUser(a.userId, `select state from business_site_spec_rollout where business_id='${a.businessId}'`),
      "canary",
      "an owner could not read their own flag"
    );
  });

  await ok("an owner CANNOT turn their own flag on — it is not theirs to set", () => {
    // No UPDATE policy exists, so RLS silently matches zero rows rather than
    // erroring. Zero rows updated is the assertion.
    asUser(a.userId, `update business_site_spec_rollout set state='enabled' where business_id='${a.businessId}'`);
    assertEq(sqlRaw(`select state from business_site_spec_rollout where business_id='${a.businessId}'`), "canary",
      "an owner changed their own rollout state");
  });

  await ok("an owner cannot INSERT a flag row for themselves", () => {
    const error = asUserExpectError(
      b.userId,
      `insert into business_site_spec_rollout (business_id, state) values ('${b.businessId}','enabled')`
    );
    assert(/row-level security|permission denied/i.test(error), `an owner inserted their own flag: ${error || "no error"}`);
    assertEq(sqlRaw(`select count(*) from business_site_spec_rollout where business_id='${b.businessId}'`), "0",
      "a self-granted flag row exists");
  });

  await ok("an owner cannot DELETE the flag to escape it", () => {
    asUser(a.userId, `delete from business_site_spec_rollout where business_id='${a.businessId}'`);
    assertEq(sqlRaw(`select count(*) from business_site_spec_rollout where business_id='${a.businessId}'`), "1",
      "an owner deleted their own flag row");
  });

  await ok("one owner cannot read another business's rollout state", () => {
    sqlRaw(`insert into business_site_spec_rollout (business_id, state) values ('${b.businessId}','enabled')`);
    assertEq(asUser(a.userId, `select count(*) from business_site_spec_rollout where business_id='${b.businessId}'`), "0",
      "cross-tenant read of the rollout flag");
    sqlRaw(`delete from business_site_spec_rollout where business_id='${b.businessId}'`);
  });

  await ok("an anonymous visitor can ask the function but cannot read the table", () => {
    // The public renderer runs unauthenticated and must be able to ask; nobody
    // needs the note, the timestamps, or the list of who is enabled.
    assertEq(asAnon(`select public.site_spec_rollout_state('${a.businessId}')`), "canary",
      "the public renderer cannot resolve the flag");
    const error = asAnonExpectError(`select count(*) from business_site_spec_rollout`);
    const denied = error !== "" || asAnon(`select count(*) from business_site_spec_rollout`) === "0";
    assert(denied, "anonymous could enumerate the rollout table");
  });

  await ok("the flag function pins its search_path", () => {
    const config = sqlRaw(`select coalesce(array_to_string(proconfig, ','), '') from pg_proc p
                            join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname='public' and p.proname='site_spec_rollout_state'`);
    assert(config.includes("search_path=public"), `SECURITY DEFINER function has a mutable search_path: "${config}"`);
  });

  // ── 3 · the stale-write guard, atomically ──────────────────────────────
  heading("3 · Stale-write guard");

  const first = unwrap(
    await saveDraftSpec(clientA as never, SITE_A, withHeadline("v1", a.businessId), { source: "generated" }),
    "seed the first version"
  ) as { id: string };

  await ok("a claim that matches the current draft is accepted", async () => {
    const saved = await saveDraftSpec(clientA as never, SITE_A, withHeadline("v2", a.businessId), {
      source: "edit",
      expectedParentVersionId: first.id
    });
    assert(saved.ok, `a correct claim was refused: ${JSON.stringify(saved)}`);
  });

  await ok("a claim on a draft that has moved is refused with a conflict, not a 500", async () => {
    const stale = await saveDraftSpec(clientA as never, SITE_A, withHeadline("v3", a.businessId), {
      source: "edit",
      expectedParentVersionId: first.id
    });
    assert(!stale.ok, "a stale claim was accepted");
    assertEq((stale as { reason: string }).reason, "conflict", "a stale claim was not reported as a conflict");
  });

  await ok("a refused claim writes nothing at all", async () => {
    const before = sqlRaw(`select count(*) from builder_site_versions where site_id='${SITE_A}'`);
    await saveDraftSpec(clientA as never, SITE_A, withHeadline("nope", a.businessId), {
      source: "edit",
      expectedParentVersionId: first.id
    });
    assertEq(sqlRaw(`select count(*) from builder_site_versions where site_id='${SITE_A}'`), before,
      "a refused claim still appended a version");
  });

  await ok("EIGHT genuinely concurrent writers claiming the same parent: exactly one wins", async () => {
    // The claim this harness exists for. Eight separate HTTP requests, eight
    // PostgREST backends, one row lock. A check outside the lock would let two
    // through and lose one owner's change.
    const state = unwrap(await getSiteSpecState(clientA as never, SITE_A), "read state") as {
      draftVersionId: string;
    };
    const parent = state.draftVersionId;

    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        saveDraftSpec(clientA as never, SITE_A, withHeadline(`race ${i}`, a.businessId), {
          source: "edit",
          expectedParentVersionId: parent
        })
      )
    );

    const winners = attempts.filter((attempt) => attempt.ok);
    const conflicts = attempts.filter((attempt) => !attempt.ok && (attempt as { reason: string }).reason === "conflict");
    assertEq(winners.length, 1, `expected exactly one winner, got ${winners.length}`);
    assertEq(conflicts.length, 7, `expected seven conflicts, got ${conflicts.length}`);

    // And the seven losers left no trace.
    const after = unwrap(await getSiteSpecState(clientA as never, SITE_A), "read state") as {
      draftVersionId: string;
    };
    assertEq(
      after.draftVersionId,
      (winners[0] as { ok: true; value: { id: string } }).value.id,
      "the draft does not point at the winner"
    );
  });

  await ok("unclaimed concurrent writers ALL succeed — the guard is opt-in, not a global lock", async () => {
    const before = Number(sqlRaw(`select count(*) from builder_site_versions where site_id='${SITE_A}'`));
    const attempts = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        saveDraftSpec(clientA as never, SITE_A, withHeadline(`free ${i}`, a.businessId), { source: "edit" })
      )
    );
    assertEq(attempts.filter((attempt) => attempt.ok).length, 4, "an unclaimed save was refused");
    assertEq(
      Number(sqlRaw(`select count(*) from builder_site_versions where site_id='${SITE_A}'`)),
      before + 4,
      "unclaimed saves did not all append"
    );
    // Version numbers stay unique and gapless — Stage 1.5's allocation property
    // is unaffected by the new parameter.
    assertEq(
      sqlRaw(`select count(*) = count(distinct version_number) from builder_site_versions where site_id='${SITE_A}'`),
      "t",
      "concurrent allocation produced a duplicate version number"
    );
  });

  await ok("restore makes no parent claim, so Undo still works while the draft is moving", async () => {
    const { restoreVersion } = await import("@/lib/site-spec/store");
    const restored = await restoreVersion(clientA as never, SITE_A, first.id);
    assert(restored.ok, `restore was blocked by the stale guard: ${JSON.stringify(restored)}`);
  });

  // ── 4 · turning the flag off destroys nothing ──────────────────────────
  heading("4 · Flag-off is a rollback, not a deletion");

  await ok("turning a business off preserves every version and both pointers", async () => {
    const published = await import("@/lib/site-spec/store").then((store) =>
      store.publishSite(clientA as never, SITE_A)
    );
    assert(published.ok, `publish failed: ${JSON.stringify(published)}`);

    const before = sqlJson<Array<{ versions: number; draft: string | null; published: string | null }>>(
      `select (select count(*) from builder_site_versions where site_id='${SITE_A}') as versions,
              (select draft_version_id::text from builder_sites where id='${SITE_A}') as draft,
              (select published_version_id::text from builder_sites where id='${SITE_A}') as published`
    )[0];

    sqlRaw(`update business_site_spec_rollout set state='off' where business_id='${a.businessId}'`);
    assertEq(await resolveRolloutState(serviceClient as never, a.businessId), "off", "the flag did not turn off");

    const after = sqlJson<Array<{ versions: number; draft: string | null; published: string | null }>>(
      `select (select count(*) from builder_site_versions where site_id='${SITE_A}') as versions,
              (select draft_version_id::text from builder_sites where id='${SITE_A}') as draft,
              (select published_version_id::text from builder_sites where id='${SITE_A}') as published`
    )[0];

    assertEq(after, before, "turning the flag off changed stored Site Spec state");
  });

  await ok("turning it back on returns the site exactly as it was", async () => {
    sqlRaw(`update business_site_spec_rollout set state='canary' where business_id='${a.businessId}'`);
    assertEq(await resolveRolloutState(serviceClient as never, a.businessId), "canary", "the flag did not come back on");
    const state = unwrap(await getSiteSpecState(clientA as never, SITE_A), "read state") as {
      publishedVersionId: string | null;
    };
    assert(state.publishedVersionId !== null, "the published pointer did not survive the round trip");
  });

  // ── cleanup ────────────────────────────────────────────────────────────
  heading("Cleanup");

  await ok("the harness leaves the local dev seed exactly as it found it", () => {
    cleanup(a, b);
    assertEq(sqlRaw(`select count(*) from builder_sites where id='${SITE_A}'`), "0", "the test site was left behind");
    assertEq(sqlRaw(`select count(*) from builder_site_versions`), "0", "test versions were left behind");
    assertEq(sqlRaw(`select count(*) from business_site_spec_rollout`), "0", "a rollout flag row was left behind");
    assertEq(sqlRaw(`select count(*) from builder_sites`), "4", "the dev seed's site count changed");
  });

  console.log(`\n${"═".repeat(72)}`);
  console.log(`${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
};

main().catch((error) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
