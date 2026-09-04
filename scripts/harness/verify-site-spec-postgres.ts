/**
 * Phase 3 · Client Website — Stage 1.5 real-Postgres verification.
 *
 *   npm run test:site-spec:postgres
 *
 * Stage 1 proved the persistence layer against an in-memory semantic fake. This
 * proves the SQL itself: the migration, its constraints, its trigger, its four
 * functions, RLS under real authenticated contexts, and version allocation
 * under genuinely concurrent database sessions.
 *
 * Two channels are used deliberately:
 *
 *   · **psql** for database truth — schema, constraints, RLS as `authenticated`
 *     with real JWT claims, append-only enforcement, index usage. This exercises
 *     the database, not a TypeScript wrapper.
 *   · **supabase-js + the real `lib/site-spec/store.ts`** for the application
 *     paths, so version creation, publish, restore and the public/preview reads
 *     are proved through the code that actually ships — and so concurrency is
 *     real overlapping HTTP → PostgREST → separate backends, not a simulation.
 *
 * LOCAL ONLY. The gate below fails closed on anything that is not loopback.
 */
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  getDraftVersion,
  getPublishedVersion,
  getSiteSpecState,
  listVersions,
  loadDraftSpecBySiteId,
  loadPublishedSpecBySlug,
  publishSite,
  restoreVersion,
  saveDraftSpec,
  undoLastChange,
  unpublishSite
} from "@/lib/site-spec/store";
import type { SiteSpec } from "@/lib/site-spec/schema";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

// ─────────────────────────────────────────────────────────────────────────────
// Local-only gate — the same fail-closed shape as scripts/fixtures/lib/safety.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Hard denylist. These can never be targeted, however the env is configured. */
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
      throw new Error(`[stage1.5] Refusing to run — ${label} URL is unparseable.`);
    }
    if (!LOOPBACK.has(host)) {
      throw new Error(
        `[stage1.5] Refusing to run — ${label} host "${host}" is not loopback.\n` +
          `  This harness applies destructive writes and only ever runs against a local stack.`
      );
    }
    for (const ref of BLOCKED_PROJECT_REFS) {
      if (raw.includes(ref)) {
        throw new Error(`[stage1.5] Refusing to run — ${label} URL references blocked project ${ref}.`);
      }
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("[stage1.5] Refusing to run — NODE_ENV is 'production'.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// psql channel
// ─────────────────────────────────────────────────────────────────────────────

const PSQL = process.env.SITE_SPEC_PSQL ?? "/opt/homebrew/opt/postgresql@16/bin/psql";

/** Run SQL and return raw text. Throws with the server error on failure. */
const sqlRaw = (statement: string): string => {
  try {
    return execFileSync(PSQL, [DB_URL, "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement], {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: "postgres" },
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string };
    const detail = (err.stderr ? String(err.stderr) : err.message ?? "").trim();
    throw new Error(detail || "psql failed");
  }
};

/** Run SQL expected to fail, and return the server's error text. */
const sqlExpectError = (statement: string): string => {
  try {
    sqlRaw(statement);
    return "";
  } catch (error) {
    return (error as Error).message;
  }
};

const sqlJson = <T>(statement: string): T => {
  const out = sqlRaw(`select coalesce(json_agg(t), '[]'::json)::text from (${statement}) t`);
  return JSON.parse(out) as T;
};

const sqlOne = (statement: string): string => sqlRaw(statement);

/**
 * Run SQL as a specific authenticated user, exactly as PostgREST does: assume
 * the `authenticated` role and set the request's JWT claims for the
 * transaction, so `auth.uid()` resolves and RLS is evaluated for real.
 */
const asUser = (userId: string, statement: string): string => {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" }).replace(/'/g, "''");
  // The claims are set inside a DO block on purpose: `select set_config(...)`
  // returns a row, and psql would hand that back alongside the real result.
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

/** Anonymous, unauthenticated access — the `anon` role with no claims. */
const asAnon = (statement: string): string =>
  sqlRaw(`begin; set local role anon; ${statement}; commit;`);

// ─────────────────────────────────────────────────────────────────────────────
// supabase-js channel — real JWTs, real HTTP, real concurrency
// ─────────────────────────────────────────────────────────────────────────────

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Mint a local HS256 session token for a seeded user. */
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
// Test scaffolding
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: Array<{ section: string; name: string; ok: boolean; detail?: string }> = [];
let section = "";

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
// Fixtures in the local database
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed ids so a re-run is idempotent and cleanup is exact. */
const SITE_A = "aaaa1111-2222-4333-8444-000000000001";
const SITE_B = "bbbb1111-2222-4333-8444-000000000002";

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

const dropTestSites = () => {
  sqlRaw(`delete from builder_sites where id in ('${SITE_A}','${SITE_B}')`);
};

const createTestSite = (id: string, actor: Actor, slug: string) => {
  sqlRaw(`
    insert into builder_sites (id, owner_user_id, business_id, status, industry, business_name,
                               description, template_key, slug, path)
    values ('${id}', '${actor.userId}', '${actor.businessId}', 'draft', 'service',
            ${quote(actor.name)}, 'Stage 1.5 verification site', 'generic_v1', '${slug}', '/s/${slug}')
  `);
};

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** A spec differing from the fixture in exactly one visible way. */
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

// ─────────────────────────────────────────────────────────────────────────────

const main = async () => {
  assertLocal();

  if (!ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      "[stage1.5] SITE_SPEC_TEST_ANON_KEY and SITE_SPEC_TEST_SERVICE_KEY must be set.\n" +
        "  Get them from `supabase status -o env` and export them before running."
    );
  }

  console.log("═══ Stage 1.5 · real local Postgres verification ═══");
  console.log(sqlOne(`select 'target: ' || current_database() || ' @ ' || coalesce(host(inet_server_addr()),'local') || ':' || inet_server_port() || '  ' || substring(version() from 'PostgreSQL [0-9.]+')`));

  const { a, b } = loadActors();
  const a_businessId = a.businessId;
  console.log(`owner A: ${a.name} (${a.userId})`);
  console.log(`owner B: ${b.name} (${b.userId})`);

  const clientA = clientFor(mintJwt(a.userId), ANON_KEY);
  const clientB = clientFor(mintJwt(b.userId), ANON_KEY);
  const serviceClient = createClient(API_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  dropTestSites();
  createTestSite(SITE_A, a, "stage15-site-a");
  createTestSite(SITE_B, b, "stage15-site-b");

  // ── §2 environment proof ──────────────────────────────────────────────
  heading("§2 · Environment is local");

  await ok("the database is reached over loopback and is a container, not the linked project", () => {
    const host = new URL(DB_URL).hostname;
    assert(LOOPBACK.has(host), `db host ${host} is not loopback`);
    assert(!DB_URL.includes("supabase.co"), "db url points at a hosted project");
    for (const ref of BLOCKED_PROJECT_REFS) assert(!DB_URL.includes(ref), `db url references ${ref}`);
  });

  await ok("the authenticated JWT actually resolves to the owner inside Postgres", () => {
    const uid = asUser(a.userId, `select auth.uid()`);
    assertEq(uid, a.userId, "auth.uid() did not match the minted claim");
  });

  // ── §3 schema ─────────────────────────────────────────────────────────
  heading("§3 · Migration result and schema");

  await ok("builder_site_versions has every expected column with the right nullability", () => {
    const cols = sqlJson<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema='public' and table_name='builder_site_versions' order by ordinal_position`
    );
    assertEq(
      cols.map((c) => c.column_name),
      ["id", "site_id", "business_id", "version_number", "spec", "source", "label",
       "parent_version_id", "restored_from_version_id", "created_by", "created_at"],
      "column set differs"
    );
    const notNull = cols.filter((c) => c.is_nullable === "NO").map((c) => c.column_name);
    assertEq(notNull, ["id", "site_id", "business_id", "version_number", "spec", "source", "created_at"], "nullability differs");
  });

  await ok("builder_sites gained exactly the three pointer columns, all nullable", () => {
    const cols = sqlJson<Array<{ column_name: string; is_nullable: string }>>(
      `select column_name, is_nullable from information_schema.columns
        where table_name='builder_sites'
          and column_name in ('draft_version_id','published_version_id','spec_published_at')
        order by column_name`
    );
    assertEq(cols.map((c) => c.column_name), ["draft_version_id", "published_version_id", "spec_published_at"], "pointer columns differ");
    assert(cols.every((c) => c.is_nullable === "YES"), "pointer columns must be nullable so legacy sites are unaffected");
  });

  await ok("the four SQL functions exist with the declared security and search_path", () => {
    const fns = sqlJson<Array<{ proname: string; secdef: boolean; cfg: string | null }>>(
      `select p.proname, p.prosecdef as secdef, array_to_string(p.proconfig, ',') as cfg
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public'
          and p.proname in ('builder_site_create_version','builder_site_publish',
                            'builder_site_unpublish','builder_site_restore_version')
        order by p.proname`
    );
    assertEq(fns.map((f) => f.proname).sort(),
      ["builder_site_create_version", "builder_site_publish", "builder_site_restore_version", "builder_site_unpublish"],
      "function set differs");
    assert(fns.every((f) => f.secdef === false), "the four functions must be SECURITY INVOKER so RLS applies to the caller");
    assert(fns.every((f) => (f.cfg ?? "").includes("search_path=public")), "every function must pin search_path");
  });

  await ok("the pointer-ownership trigger is installed on the right events", () => {
    const trg = sqlJson<Array<{ tgname: string; def: string }>>(
      `select tgname, pg_get_triggerdef(oid) as def from pg_trigger
        where tgrelid='public.builder_sites'::regclass and not tgisinternal
          and tgname='builder_sites_validate_version_pointers_trg'`
    );
    assert(trg.length === 1, "trigger missing");
    assert(/BEFORE INSERT OR UPDATE OF draft_version_id, published_version_id/i.test(trg[0].def), `unexpected trigger events: ${trg[0].def}`);
  });

  await ok("uniqueness, check constraints and foreign keys are all present", () => {
    const cons = sqlJson<Array<{ conname: string; contype: string }>>(
      `select conname, contype::text from pg_constraint
        where conrelid='public.builder_site_versions'::regclass order by conname`
    );
    const names = cons.map((c) => c.conname);
    for (const expected of [
      "builder_site_versions_site_number_unique",
      "builder_site_versions_number_positive",
      "builder_site_versions_source_check",
      "builder_site_versions_site_id_fkey",
      "builder_site_versions_business_id_fkey"
    ]) {
      assert(names.includes(expected), `missing constraint ${expected} (have: ${names.join(", ")})`);
    }
  });

  await ok("RLS is enabled and there is deliberately no UPDATE policy", () => {
    const rls = sqlOne(`select relrowsecurity::text from pg_class where relname='builder_site_versions'`);
    assertEq(rls, "true", "RLS is not enabled on builder_site_versions");
    const cmds = sqlJson<Array<{ cmd: string }>>(
      `select cmd from pg_policies where tablename='builder_site_versions' order by cmd`
    ).map((r) => r.cmd);
    assertEq(cmds, ["DELETE", "INSERT", "SELECT"], "policy set differs — an UPDATE policy would break append-only history");
  });

  await ok("execute is granted to authenticated, and the table is not world-writable", () => {
    // CALLABLE functions only. A function returning `trigger` is unreachable
    // through PostgREST RPC, so it needs no grant and Stage 3 revoked the
    // default one as defence in depth — the next assertion is that it stays
    // revoked. Globbing on the name alone used to sweep the trigger function
    // into this list and asserted the opposite of what the product wants.
    const grants = sqlJson<Array<{ proname: string; has: boolean }>>(
      `select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as has
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname like 'builder_site_%'
          and p.prorettype <> 'trigger'::regtype
        order by p.proname`
    );
    assert(grants.length >= 4, `expected the four callable Site Spec functions, found ${grants.length}`);
    assert(grants.every((g) => g.has), `authenticated cannot execute: ${grants.filter((g) => !g.has).map((g) => g.proname).join(", ")}`);

    // The trigger function must NOT be directly executable by anon/authenticated.
    const triggerGrants = sqlJson<Array<{ proname: string; anon: boolean; auth: boolean }>>(
      `select p.proname,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname like 'builder_site%'
          and p.prorettype = 'trigger'::regtype`
    );
    assert(
      triggerGrants.every((g) => !g.anon && !g.auth),
      `a SECURITY DEFINER trigger function is directly executable: ${triggerGrants.filter((g) => g.anon || g.auth).map((g) => g.proname).join(", ")}`
    );
    const anonSelect = sqlOne(`select has_table_privilege('anon','public.builder_site_versions','select')::text`);
    // `anon` may hold the grant; RLS is what actually stops it. Proved in §12.
    assert(anonSelect === "true" || anonSelect === "false", "unreadable privilege state");
  });

  // ── §5 version creation ───────────────────────────────────────────────
  heading("§5 · Real version creation");

  let v1Id = "";
  await ok("saving a draft through the real store inserts version 1 and moves the draft pointer", async () => {
    const version = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Version one.", a.businessId), { source: "generated" }), "saveDraftSpec");
    v1Id = version.id;
    assertEq(version.versionNumber, 1, "first version must be 1");
    assertEq(version.source, "generated", "source not recorded");
    assertEq(version.parentVersionId, null, "first version must have no parent");

    const row = sqlJson<Array<{ draft: string | null; published: string | null; site_id: string; business_id: string }>>(
      `select s.draft_version_id as draft, s.published_version_id as published, v.site_id, v.business_id
         from builder_sites s join builder_site_versions v on v.id = s.draft_version_id
        where s.id='${SITE_A}'`
    )[0];
    assertEq(row.draft, version.id, "draft_version_id does not point at version 1");
    assertEq(row.published, null, "published_version_id must remain null");
    assertEq(row.site_id, SITE_A, "version site_id wrong");
    assertEq(row.business_id, a.businessId, "version business_id wrong");
  });

  await ok("the stored spec survives the database round trip and still validates", async () => {
    const draft = unwrap(await getDraftVersion(clientA as any, SITE_A), "getDraftVersion");
    assert(draft, "no draft returned");
    assertEq((draft!.spec.sections[0] as { headline: string }).headline, "Version one.", "spec changed in the database");
    // Read straight from Postgres too, not only through the client.
    const raw = sqlOne(`select spec->'sections'->0->>'headline' from builder_site_versions where id='${v1Id}'`);
    assertEq(raw, "Version one.", "raw jsonb differs from what the store returned");
  });

  await ok("version numbers increase monotonically and parents chain correctly", async () => {
    const v2 = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Version two.", a.businessId)), "v2");
    const v3 = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Version three.", a.businessId)), "v3");
    const v4 = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Version four.", a.businessId)), "v4");
    assertEq([v2.versionNumber, v3.versionNumber, v4.versionNumber], [2, 3, 4], "version numbers not monotonic");
    assertEq(v2.parentVersionId, v1Id, "v2 parent wrong");
    assertEq(v3.parentVersionId, v2.id, "v3 parent wrong");
    assertEq(v4.parentVersionId, v3.id, "v4 parent wrong");
  });

  // ── §6 concurrency ────────────────────────────────────────────────────
  heading("§6 · Real concurrency");

  await ok("overlapping create-version calls produce distinct versions with no duplicate or lost number", async () => {
    const before = Number(sqlOne(`select count(*) from builder_site_versions where site_id='${SITE_A}'`));

    // Genuinely concurrent: six separate HTTP requests to PostgREST, each on its
    // own backend, all racing for the same site row.
    const attempts = Array.from({ length: 6 }, (_, i) =>
      saveDraftSpec(clientA as any, SITE_A, withHeadline(`Concurrent ${i}.`, a.businessId), { label: `c${i}` })
    );
    const settled = await Promise.all(attempts);

    const failures = settled.filter((r) => !r.ok);
    assert(failures.length === 0, `concurrent creates failed: ${JSON.stringify(failures)}`);

    const numbers = settled.map((r) => (r as { ok: true; value: { versionNumber: number } }).value.versionNumber).sort((x, y) => x - y);
    assertEq(new Set(numbers).size, numbers.length, `duplicate version numbers: ${numbers.join(",")}`);

    const after = Number(sqlOne(`select count(*) from builder_site_versions where site_id='${SITE_A}'`));
    assertEq(after - before, 6, `expected 6 new versions, got ${after - before} — a version was lost`);
    assertEq(numbers, [before + 1, before + 2, before + 3, before + 4, before + 5, before + 6], `numbers not contiguous: ${numbers.join(",")}`);

    const draftValid = sqlOne(
      `select (exists (select 1 from builder_site_versions v join builder_sites s on s.draft_version_id=v.id where s.id='${SITE_A}'))::text`
    );
    assertEq(draftValid, "true", "draft pointer does not reference a valid version after the race");
  });

  await ok("the site-row lock is what serialises them — no uniqueness error was raised", () => {
    // If the lock were absent, two backends would compute the same max+1 and one
    // would hit builder_site_versions_site_number_unique. The previous test
    // asserts zero failures, so the lock held; record the mechanism explicitly.
    const def = sqlOne(`select pg_get_functiondef(oid) from pg_proc where proname='builder_site_create_version'`);
    assert(/for update/i.test(def), "builder_site_create_version does not lock the site row");
  });

  // ── §7 draft / published separation ───────────────────────────────────
  heading("§7 · Draft / published separation");

  let publishedVersionId = "";
  await ok("publishing points published_version_id at the chosen version and stamps the time", async () => {
    const target = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("This one is live.", a.businessId)), "live version");
    publishedVersionId = target.id;
    const result = unwrap(await publishSite(clientA as any, SITE_A), "publishSite");
    assertEq(result.publishedVersion.id, target.id, "published the wrong version");
    assert(result.publishedAt, "spec_published_at was not set");

    const row = sqlJson<Array<{ published: string; stamped: string | null; status: string }>>(
      `select published_version_id as published, spec_published_at::text as stamped, status from builder_sites where id='${SITE_A}'`
    )[0];
    assertEq(row.published, target.id, "published pointer wrong in the database");
    assert(row.stamped, "spec_published_at null in the database");
    assertEq(row.status, "published", "status not moved to published");
  });

  await ok("publishing does not copy, rewrite or mutate version content", async () => {
    const before = sqlOne(`select md5(string_agg(v.id || v.spec::text || v.version_number, '|' order by v.id)) from builder_site_versions v where v.site_id='${SITE_A}'`);
    unwrap(await publishSite(clientA as any, SITE_A, publishedVersionId), "re-publish");
    const after = sqlOne(`select md5(string_agg(v.id || v.spec::text || v.version_number, '|' order by v.id)) from builder_site_versions v where v.site_id='${SITE_A}'`);
    assertEq(after, before, "publishing mutated version history");
  });

  await ok("the draft moves and the published pointer does not — the primary acceptance condition", async () => {
    for (const headline of ["Draft edit one.", "Draft edit two.", "Draft edit three."]) {
      unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline(headline, a.businessId)), headline);
    }
    const state = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assertEq(state.publishedVersionId, publishedVersionId, "the live site moved while only the draft was edited");
    assert(state.draftVersionId !== publishedVersionId, "the draft pointer did not move");
    assertEq(state.hasUnpublishedChanges, true, "unpublished changes not reported");

    const live = unwrap(await getPublishedVersion(clientA as any, SITE_A), "published version");
    assertEq((live!.spec.sections[0] as { headline: string }).headline, "This one is live.", "published spec changed");
  });

  await ok("public loading returns the published spec; preview returns the draft", async () => {
    const publicSite = await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a");
    assert(publicSite, "published site not loadable by slug");
    assertEq((publicSite!.spec.sections[0] as { headline: string }).headline, "This one is live.", "public route served draft content");

    const preview = await loadDraftSpecBySiteId(clientA as any, SITE_A);
    assert(preview, "draft not loadable");
    assertEq((preview!.spec.sections[0] as { headline: string }).headline, "Draft edit three.", "preview did not serve the current draft");
  });

  // ── §8 publish an older version ───────────────────────────────────────
  heading("§8 · Publishing an older version intentionally");

  await ok("an explicitly named older version can be published, and it is not `publish latest`", async () => {
    const versions = unwrap(await listVersions(clientA as any, SITE_A), "listVersions").versions;
    const latest = versions[0];
    const older = versions[3];
    assert(older.versionNumber < latest.versionNumber, "fixture ordering wrong");

    unwrap(await publishSite(clientA as any, SITE_A, older.id), "publish older");
    const state = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assertEq(state.publishedVersionId, older.id, "the older version was not published");
    assertEq(state.draftVersionId, latest.id, "publishing an older version moved the draft");

    // A newer version afterwards must not change what is served.
    unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Even newer.", a.businessId)), "newer");
    const served = await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a");
    assertEq(served!.versionId, older.id, "public stopped serving the explicitly published version");
    publishedVersionId = older.id;
  });

  // ── §9 restore / undo ─────────────────────────────────────────────────
  heading("§9 · Restore / Undo semantics");

  await ok("restore copies history forward and leaves the source version untouched", async () => {
    const versions = unwrap(await listVersions(clientA as any, SITE_A), "list").versions;
    const source = versions[versions.length - 1]; // version 1
    const sourceBefore = sqlOne(`select spec::text from builder_site_versions where id='${source.id}'`);
    const countBefore = Number(sqlOne(`select count(*) from builder_site_versions where site_id='${SITE_A}'`));

    const restored = unwrap(await restoreVersion(clientA as any, SITE_A, source.id), "restoreVersion");

    assertEq(restored.source, "restore", "source not marked as a restore");
    assertEq(restored.restoredFromVersionId, source.id, "restored_from_version_id not recorded");
    assertEq(restored.spec, source.spec, "restored spec is not deep-equal to the source");
    assertEq(restored.versionNumber, countBefore + 1, "restore did not append a new version");

    const sourceAfter = sqlOne(`select spec::text from builder_site_versions where id='${source.id}'`);
    assertEq(sourceAfter, sourceBefore, "the historical source version was rewritten");

    const state = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assertEq(state.draftVersionId, restored.id, "draft did not move to the restored version");
    assertEq(state.publishedVersionId, publishedVersionId, "restoring changed the published site");
  });

  await ok("restoring the same version twice is deterministic", async () => {
    const first = unwrap(await restoreVersion(clientA as any, SITE_A, v1Id), "restore #1");
    const second = unwrap(await restoreVersion(clientA as any, SITE_A, v1Id), "restore #2");
    assertEq(first.spec, second.spec, "the same restore twice produced different specs");
    assert(first.id !== second.id, "restore did not create a distinct version each time");
  });

  await ok("repeated undo walks BACK through history rather than oscillating", async () => {
    // A restore appends a version whose parent is the one it replaced, so
    // following parentVersionId twice undoes and then redoes. Stage 1.5's
    // original test asserted exactly that no-op and therefore passed while the
    // behaviour was wrong; this replaces it with the real property.
    const a = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Walk one.", a_businessId), { label: "w1" }), "w1");
    const b = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Walk two.", a_businessId), { label: "w2" }), "w2");
    const c = unwrap(await saveDraftSpec(clientA as any, SITE_A, withHeadline("Walk three.", a_businessId), { label: "w3" }), "w3");
    assert(a.id && b.id && c.id, "setup versions were not created");

    const headline = (version: { spec: { sections: Array<Record<string, unknown>> } }) =>
      version.spec.sections[0].headline as string;

    const back1 = unwrap(await undoLastChange(clientA as any, SITE_A), "undo 1");
    assertEq(headline(back1), "Walk two.", "the first undo did not land on the previous state");

    const back2 = unwrap(await undoLastChange(clientA as any, SITE_A), "undo 2");
    assertEq(headline(back2), "Walk one.", "the second undo went forwards instead of back");

    // Everything is still there — undoing is itself undoable.
    const listed = unwrap(await listVersions(clientA as any, SITE_A), "list").versions;
    assert(listed.some((version) => version.id === c.id), "the undone version disappeared from history");
    const redone = unwrap(await restoreVersion(clientA as any, SITE_A, c.id), "redo");
    assertEq(headline(redone), "Walk three.", "the undone version could not be recovered");
  });

  // ── §10 unpublish ─────────────────────────────────────────────────────
  heading("§10 · Unpublish");

  await ok("unpublishing clears the pointer while draft, history and legacy content survive", async () => {
    const historyBefore = Number(sqlOne(`select count(*) from builder_site_versions where site_id='${SITE_A}'`));
    const draftBefore = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state").draftVersionId;
    const legacyBefore = sqlOne(`select coalesce(md5(site_document::text),'<null>') from builder_sites where id='${SITE_A}'`);

    unwrap(await unpublishSite(clientA as any, SITE_A), "unpublish");

    const state = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assertEq(state.publishedVersionId, null, "published pointer not cleared");
    assertEq(state.draftVersionId, draftBefore, "the draft was lost");
    assertEq(Number(sqlOne(`select count(*) from builder_site_versions where site_id='${SITE_A}'`)), historyBefore, "history was deleted");
    assertEq(sqlOne(`select coalesce(md5(site_document::text),'<null>') from builder_sites where id='${SITE_A}'`), legacyBefore, "legacy site_document was changed");
    assertEq(await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a"), null, "an unpublished site is still publicly servable");
  });

  await ok("the site can be published again afterwards", async () => {
    unwrap(await publishSite(clientA as any, SITE_A), "re-publish");
    const state = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assert(state.publishedVersionId, "re-publish did not set the pointer");
    assert(await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a"), "site not servable after re-publish");
  });

  // ── §11 invalid pointers ──────────────────────────────────────────────
  heading("§11 · Invalid pointer rejection");

  await ok("site A's draft pointer cannot be aimed at site B's version", async () => {
    unwrap(await saveDraftSpec(clientB as any, SITE_B, withHeadline("B's own.", b.businessId)), "B draft");
    const bVersion = sqlOne(`select id from builder_site_versions where site_id='${SITE_B}' limit 1`);
    const error = sqlExpectError(`update builder_sites set draft_version_id='${bVersion}' where id='${SITE_A}'`);
    assert(/does not belong to site/i.test(error), `expected the trigger to refuse, got: ${error || "(no error)"}`);
  });

  await ok("site A's published pointer cannot be aimed at site B's version", () => {
    const bVersion = sqlOne(`select id from builder_site_versions where site_id='${SITE_B}' limit 1`);
    const error = sqlExpectError(`update builder_sites set published_version_id='${bVersion}' where id='${SITE_A}'`);
    assert(/does not belong to site/i.test(error), `expected the trigger to refuse, got: ${error || "(no error)"}`);
  });

  await ok("a pointer cannot reference a version id that does not exist", () => {
    const error = sqlExpectError(`update builder_sites set draft_version_id='99999999-9999-4999-8999-999999999999' where id='${SITE_A}'`);
    assert(error.length > 0, "a nonexistent version id was accepted as a pointer");
    assert(/foreign key|does not belong/i.test(error), `unexpected error: ${error}`);
  });

  await ok("publishing another site's version is refused by the function itself", () => {
    const bVersion = sqlOne(`select id from builder_site_versions where site_id='${SITE_B}' limit 1`);
    const error = sqlExpectError(`select builder_site_publish('${SITE_A}'::uuid, '${bVersion}'::uuid)`);
    assert(/does not belong to site/i.test(error), `expected refusal, got: ${error || "(no error)"}`);
  });

  await ok("restoring another site's version is refused by the function itself", () => {
    const bVersion = sqlOne(`select id from builder_site_versions where site_id='${SITE_B}' limit 1`);
    const error = sqlExpectError(`select builder_site_restore_version('${SITE_A}'::uuid, '${bVersion}'::uuid)`);
    assert(/does not belong to site/i.test(error), `expected refusal, got: ${error || "(no error)"}`);
  });

  await ok("a nonexistent version id is refused by publish and restore", () => {
    const ghost = "99999999-9999-4999-8999-999999999999";
    assert(sqlExpectError(`select builder_site_publish('${SITE_A}'::uuid, '${ghost}'::uuid)`).length > 0, "publish accepted a ghost version");
    assert(sqlExpectError(`select builder_site_restore_version('${SITE_A}'::uuid, '${ghost}'::uuid)`).length > 0, "restore accepted a ghost version");
  });

  await ok("after every rejected attempt the pointers are still intact", () => {
    const row = sqlJson<Array<{ draft_ok: boolean; pub_ok: boolean }>>(
      `select
         (draft_version_id is null or exists (select 1 from builder_site_versions v where v.id=s.draft_version_id and v.site_id=s.id)) as draft_ok,
         (published_version_id is null or exists (select 1 from builder_site_versions v where v.id=s.published_version_id and v.site_id=s.id)) as pub_ok
       from builder_sites s where s.id='${SITE_A}'`
    )[0];
    assert(row.draft_ok && row.pub_ok, "a pointer was silently corrupted");
  });

  // ── §12 RLS ───────────────────────────────────────────────────────────
  heading("§12 · RLS / ownership");

  const rlsMatrix: Array<{ actor: string; action: string; allowed: boolean; expected: boolean }> = [];
  const record = (actor: string, action: string, allowed: boolean, expected: boolean) => {
    rlsMatrix.push({ actor, action, allowed, expected });
    assert(allowed === expected, `${actor} · ${action}: expected ${expected ? "ALLOWED" : "DENIED"}, got ${allowed ? "ALLOWED" : "DENIED"}`);
  };

  await ok("owner A can read, create, publish and restore on their own site", async () => {
    const readable = Number(asUser(a.userId, `select count(*) from builder_site_versions where site_id='${SITE_A}'`));
    record("owner A", "read own versions", readable > 0, true);

    const created = await saveDraftSpec(clientA as any, SITE_A, withHeadline("A can write.", a.businessId));
    record("owner A", "create own version", created.ok, true);

    const published = await publishSite(clientA as any, SITE_A);
    record("owner A", "publish own", published.ok, true);

    const target = unwrap(await getDraftVersion(clientA as any, SITE_A), "draft")!;
    const restored = await restoreVersion(clientA as any, SITE_A, target.id);
    record("owner A", "restore own", restored.ok, true);
  });

  await ok("owner A cannot read owner B's version history", () => {
    const visible = Number(asUser(a.userId, `select count(*) from builder_site_versions where site_id='${SITE_B}'`));
    record("owner A", "read B's versions", visible > 0, false);
  });

  await ok("owner A cannot create a version for owner B's site", async () => {
    const result = await saveDraftSpec(clientA as any, SITE_B, withHeadline("A writing into B.", b.businessId));
    record("owner A", "create version for B", result.ok, false);
    const insertError = asUserExpectError(a.userId,
      `insert into builder_site_versions (site_id, business_id, version_number, spec, source)
       values ('${SITE_B}', '${b.businessId}', 999, '{}'::jsonb, 'manual')`);
    assert(insertError.length > 0, "owner A inserted a version row directly into owner B's site");
  });

  await ok("owner A cannot publish, restore or repoint owner B's site", async () => {
    const published = await publishSite(clientA as any, SITE_B);
    record("owner A", "publish B", published.ok, false);

    const bVersion = sqlOne(`select id from builder_site_versions where site_id='${SITE_B}' limit 1`);
    const restored = await restoreVersion(clientA as any, SITE_B, bVersion);
    record("owner A", "restore B", restored.ok, false);

    const pointerBefore = sqlOne(`select coalesce(draft_version_id::text,'<null>') from builder_sites where id='${SITE_B}'`);
    asUserExpectError(a.userId, `update builder_sites set draft_version_id=null where id='${SITE_B}'`);
    const pointerAfter = sqlOne(`select coalesce(draft_version_id::text,'<null>') from builder_sites where id='${SITE_B}'`);
    record("owner A", "repoint B's draft", pointerAfter !== pointerBefore, false);
  });

  await ok("owner B has the mirrored permissions on their own site and none on A's", async () => {
    const own = Number(asUser(b.userId, `select count(*) from builder_site_versions where site_id='${SITE_B}'`));
    record("owner B", "read own versions", own > 0, true);
    const foreign = Number(asUser(b.userId, `select count(*) from builder_site_versions where site_id='${SITE_A}'`));
    record("owner B", "read A's versions", foreign > 0, false);
    const created = await saveDraftSpec(clientB as any, SITE_A, withHeadline("B writing into A.", a.businessId));
    record("owner B", "create version for A", created.ok, false);
  });

  await ok("owner A cannot unpublish owner B's site", async () => {
    unwrap(await publishSite(clientB as any, SITE_B), "B publishes their own");
    const before = sqlOne(`select coalesce(published_version_id::text,'<null>') from builder_sites where id='${SITE_B}'`);
    const attempt = await unpublishSite(clientA as any, SITE_B);
    const after = sqlOne(`select coalesce(published_version_id::text,'<null>') from builder_sites where id='${SITE_B}'`);
    record("owner A", "unpublish B", after !== before, false);
    assert(!attempt.ok, "the unpublish RPC reported success for another owner's site");
  });

  await ok("an unauthenticated visitor can read no version history at all", () => {
    const anon = Number(asAnon(`select count(*) from builder_site_versions`));
    record("anonymous", "read any version", anon > 0, false);
  });

  await ok("the service role bypasses RLS by design — and only the public read path uses it", () => {
    const all = Number(sqlOne(`select count(*) from builder_site_versions`));
    assert(all > 0, "service role should see every version");
    record("service role", "read every version (by design)", all > 0, true);
  });

  // ── §13 append-only ───────────────────────────────────────────────────
  heading("§13 · Append-only history at the database level");

  await ok("an owner cannot UPDATE a historical spec", () => {
    const target = sqlOne(`select id from builder_site_versions where site_id='${SITE_A}' order by version_number limit 1`);
    const before = sqlOne(`select spec::text from builder_site_versions where id='${target}'`);
    asUserExpectError(a.userId, `update builder_site_versions set spec='{"tampered":true}'::jsonb where id='${target}'`);
    const after = sqlOne(`select spec::text from builder_site_versions where id='${target}'`);
    assertEq(after, before, "an owner rewrote a historical spec");
  });

  await ok("an owner cannot change a version_number, source or label", () => {
    const target = sqlOne(`select id from builder_site_versions where site_id='${SITE_A}' order by version_number limit 1`);
    const before = sqlOne(`select version_number || '|' || source || '|' || coalesce(label,'') from builder_site_versions where id='${target}'`);
    asUserExpectError(a.userId, `update builder_site_versions set version_number=9999, source='manual', label='rewritten' where id='${target}'`);
    const after = sqlOne(`select version_number || '|' || source || '|' || coalesce(label,'') from builder_site_versions where id='${target}'`);
    assertEq(after, before, "an owner rewrote version metadata");
  });

  await ok("there is no UPDATE policy at all, so no owner path can mutate history", () => {
    const updatePolicies = Number(sqlOne(`select count(*) from pg_policies where tablename='builder_site_versions' and cmd='UPDATE'`));
    assertEq(updatePolicies, 0, "an UPDATE policy exists — history is no longer append-only");
  });

  await ok("DELETE is permitted for an owner by design, and is documented as such", () => {
    const deletePolicies = Number(sqlOne(`select count(*) from pg_policies where tablename='builder_site_versions' and cmd='DELETE'`));
    assertEq(deletePolicies, 1, "expected exactly one owner DELETE policy");
    // Deliberate: an owner must be able to erase their own site's history (and a
    // site delete cascades). What they cannot do is REWRITE it and pass the
    // result off as the original.
  });

  // ── §14 corrupted spec ────────────────────────────────────────────────
  heading("§14 · Corrupted spec / schema evolution");

  await ok("a malformed version is surfaced as unreadable, not silently repaired", async () => {
    const before = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    // Inserted through an administrative path, as a future schema change would appear.
    sqlRaw(`insert into builder_site_versions (site_id, business_id, version_number, spec, source, label)
            values ('${SITE_A}', '${a.businessId}',
                    (select max(version_number)+1 from builder_site_versions where site_id='${SITE_A}'),
                    '{"kind":"site_spec","version":99,"sections":[]}'::jsonb, 'import', 'corrupt')`);
    const corruptId = sqlOne(`select id from builder_site_versions where label='corrupt' and site_id='${SITE_A}'`);

    const listed = unwrap(await listVersions(clientA as any, SITE_A), "list");
    assert(listed.unreadable.some((u) => u.id === corruptId), "the malformed version was not surfaced as unreadable");
    assert(!listed.versions.some((v) => v.id === corruptId), "the malformed version was returned as if it were valid");
    assert(listed.unreadable.find((u) => u.id === corruptId)!.issues.length > 0, "no reason was given for the rejection");

    const published = await publishSite(clientA as any, SITE_A, corruptId);
    assert(!published.ok, "a malformed version was published");
    assertEq((published as { reason: string }).reason, "invalid_spec", "wrong refusal reason");

    const after = unwrap(await getSiteSpecState(clientA as any, SITE_A), "state");
    assertEq(after.publishedVersionId, before.publishedVersionId, "the live pointer moved for a malformed version");
  });

  await ok("a malformed version cannot be reached by the public or preview read paths", async () => {
    const corruptId = sqlOne(`select id from builder_site_versions where label='corrupt' and site_id='${SITE_A}'`);
    // Force the draft pointer at it the only way possible — the site's own version.
    sqlRaw(`update builder_sites set draft_version_id='${corruptId}' where id='${SITE_A}'`);
    const preview = await loadDraftSpecBySiteId(clientA as any, SITE_A);
    assertEq(preview, null, "the preview path returned a malformed spec");

    const draft = await getDraftVersion(clientA as any, SITE_A);
    assert(!draft.ok, "getDraftVersion returned a malformed spec as valid");
    assertEq((draft as { reason: string }).reason, "invalid_spec", "wrong reason for a malformed draft");

    // The published site is untouched by any of this.
    const served = await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a");
    assert(served, "the published site stopped serving because a draft was malformed");
  });

  // ── §16 legacy fallback ───────────────────────────────────────────────
  heading("§16 · Legacy fallback and reversible per-site adoption");

  const LEGACY_SLUG = "barber-demo";
  await ok("a seeded legacy site has no Site Spec pointers and keeps its document", () => {
    const row = sqlJson<Array<{ draft: string | null; published: string | null; has_doc: boolean; status: string }>>(
      `select draft_version_id as draft, published_version_id as published,
              (site_document is not null) as has_doc, status
         from builder_sites where slug='${LEGACY_SLUG}'`
    )[0];
    assert(row, "legacy fixture site missing — run `npm run seed:dev`");
    assertEq(row.draft, null, "a legacy site was auto-migrated to a draft pointer");
    assertEq(row.published, null, "a legacy site was auto-migrated to a published pointer");
    assertEq(row.has_doc, true, "the legacy document was removed");
    assertEq(row.status, "published", "the legacy site's status was changed");
  });

  await ok("the public loader returns nothing for a legacy site, so the old renderer stays in charge", async () => {
    assertEq(await loadPublishedSpecBySlug(serviceClient as any, LEGACY_SLUG), null,
      "the Site Spec path claimed a legacy site");
  });

  let legacySiteId = "";
  await ok("creating a Site Spec draft on a legacy site does not change what the public sees", async () => {
    legacySiteId = sqlOne(`select id from builder_sites where slug='${LEGACY_SLUG}'`);
    const businessId = sqlOne(`select business_id from builder_sites where slug='${LEGACY_SLUG}'`);
    const docBefore = sqlOne(`select md5(site_document::text) from builder_sites where slug='${LEGACY_SLUG}'`);

    unwrap(await saveDraftSpec(serviceClient as any, legacySiteId, withHeadline("Spec draft on a legacy site.", businessId), { source: "generated" }), "legacy draft");

    assertEq(await loadPublishedSpecBySlug(serviceClient as any, LEGACY_SLUG), null,
      "an unpublished spec draft took over the public route");
    const preview = await loadDraftSpecBySiteId(serviceClient as any, legacySiteId);
    assert(preview, "the owner cannot preview the spec draft");
    assertEq(sqlOne(`select md5(site_document::text) from builder_sites where slug='${LEGACY_SLUG}'`), docBefore,
      "the legacy document was altered");
  });

  await ok("publishing the spec switches the public route, and unpublishing gives the legacy site back", async () => {
    const docBefore = sqlOne(`select md5(site_document::text) from builder_sites where slug='${LEGACY_SLUG}'`);

    unwrap(await publishSite(serviceClient as any, legacySiteId), "publish on legacy site");
    const served = await loadPublishedSpecBySlug(serviceClient as any, LEGACY_SLUG);
    assert(served, "publishing the spec did not switch the public route");
    assertEq((served!.spec.sections[0] as { headline: string }).headline, "Spec draft on a legacy site.", "wrong spec served");

    unwrap(await unpublishSite(serviceClient as any, legacySiteId), "unpublish");
    assertEq(await loadPublishedSpecBySlug(serviceClient as any, LEGACY_SLUG), null,
      "the site did not fall back to the legacy renderer");
    assertEq(sqlOne(`select md5(site_document::text) from builder_sites where slug='${LEGACY_SLUG}'`), docBefore,
      "the legacy document did not survive the round trip");
    assertEq(sqlOne(`select coalesce(published_version_id::text,'<null>') from builder_sites where slug='${LEGACY_SLUG}'`), "<null>",
      "the published pointer was not cleared");
  });

  // ── §17 SQL security boundaries ───────────────────────────────────────
  heading("\u00a717 \u00b7 SQL function security boundaries");

  await ok("the RPC layer does not validate spec CONTENT — and the consequence is a safe fallback, not a broken page", async () => {
    // Spec validation lives in TypeScript. An owner calling the RPC directly can
    // therefore publish a malformed version of THEIR OWN site. This proves the
    // blast radius: the public read path refuses it and returns nothing, so the
    // route falls through to the legacy document rather than rendering rubbish.
    const businessId = sqlOne(`select business_id from builder_sites where id='${SITE_A}'`);
    sqlRaw(`insert into builder_site_versions (site_id, business_id, version_number, spec, source, label)
            values ('${SITE_A}', '${businessId}',
                    (select coalesce(max(version_number),0)+1 from builder_site_versions where site_id='${SITE_A}'),
                    '{"kind":"site_spec","version":1,"sections":"not-an-array"}'::jsonb, 'import', 'rpc-bypass')`);
    const badId = sqlOne(`select id from builder_site_versions where label='rpc-bypass' and site_id='${SITE_A}'`);

    // The database accepts the pointer move — it polices ownership, not schema.
    sqlRaw(`select builder_site_publish('${SITE_A}'::uuid, '${badId}'::uuid)`);
    assertEq(sqlOne(`select published_version_id::text from builder_sites where id='${SITE_A}'`), badId,
      "the RPC refused a structurally invalid spec — this test needs updating");

    // ...and the application refuses to serve it.
    assertEq(await loadPublishedSpecBySlug(serviceClient as any, "stage15-site-a"), null,
      "a malformed published spec was served to the public");
  });

  await ok("a non-owner cannot reach any of the four functions, even by calling them directly", () => {
    for (const call of [
      `select builder_site_create_version('${SITE_B}'::uuid, '{}'::jsonb, 'edit', null, null)`,
      `select builder_site_publish('${SITE_B}'::uuid, null)`,
      `select builder_site_unpublish('${SITE_B}'::uuid)`,
      `select builder_site_restore_version('${SITE_B}'::uuid, (select id from builder_site_versions where site_id='${SITE_B}' limit 1))`
    ]) {
      const error = asUserExpectError(a.userId, call);
      assert(error.length > 0, `owner A executed against owner B's site: ${call}`);
      assert(/not found|does not belong|violates row-level security|permission denied/i.test(error),
        `unexpected failure mode for a cross-tenant call: ${error}`);
    }
  });

  await ok("the functions run as SECURITY INVOKER so RLS is never bypassed, and the trigger is DEFINER for a stated reason", () => {
    const invoker = sqlJson<Array<{ proname: string; secdef: boolean }>>(
      `select proname, prosecdef as secdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and proname in
          ('builder_site_create_version','builder_site_publish','builder_site_unpublish','builder_site_restore_version')`
    );
    assert(invoker.every((f) => !f.secdef), "a data-modifying function is SECURITY DEFINER — it would bypass RLS");

    // The pointer trigger IS definer, deliberately: it must see every version of
    // the site to validate a pointer, including ones the caller's RLS hides.
    const trg = sqlJson<Array<{ secdef: boolean; cfg: string | null }>>(
      `select prosecdef as secdef, array_to_string(proconfig,',') as cfg from pg_proc
        where proname='builder_sites_validate_version_pointers'`
    )[0];
    assert(trg.secdef, "the pointer trigger must be DEFINER to see versions the caller cannot");
    assert((trg.cfg ?? "").includes("search_path=public"), "the DEFINER trigger must pin search_path");
  });

  // ── §18 performance / indexes ─────────────────────────────────────────
  heading("§18 · Index support on the required access paths");

  /**
   * On a table this small the planner rightly prefers a sequential scan, which
   * says nothing about whether the index exists or is usable. Disabling seqscan
   * for the statement reveals the index the planner WOULD use at scale — and
   * the setting has to be in the same batch, because each psql invocation is a
   * new session.
   */
  const usesIndex = (label: string, query: string, expected: RegExp) => {
    const plan = sqlRaw(
      `begin; set local enable_seqscan=off; explain (analyze false, costs false, format text) ${query}; commit;`
    );
    assert(expected.test(plan), `${label} did not use the expected index:\n     ${plan.replace(/\n/g, "\n     ")}`);
  };

  await ok("history listing uses the (site_id, version_number desc) index", () => {
    usesIndex("history listing",
      `select * from builder_site_versions where site_id='${SITE_A}' order by version_number desc limit 50`,
      /builder_site_versions_site_created_idx/);
  });

  await ok("version lookup by id uses the primary key", () => {
    usesIndex("version by id",
      `select * from builder_site_versions where id='${v1Id}'`,
      /builder_site_versions_pkey/);
  });

  await ok("next-version-number allocation uses the same index", () => {
    usesIndex("max version_number",
      `select coalesce(max(version_number),0)+1 from builder_site_versions where site_id='${SITE_A}'`,
      /builder_site_versions_site_created_idx|builder_site_versions_site_number_unique/);
  });

  await ok("published and draft pointer lookups are index-backed", () => {
    usesIndex("site by slug",
      `select id, business_id, published_version_id from builder_sites where slug='stage15-site-a'`,
      /builder_sites_slug_unique/);
    const partial = sqlOne(`select count(*) from pg_indexes where indexname='builder_sites_published_version_idx'`);
    assertEq(partial, "1", "the partial index on published_version_id is missing");
  });

  // ── cleanup ───────────────────────────────────────────────────────────
  heading("Cleanup");

  await ok("the harness leaves the local dev seed exactly as it found it", async () => {
    sqlRaw(`update builder_sites set published_version_id=null, draft_version_id=null where id in ('${SITE_A}','${SITE_B}')`);
    dropTestSites();
    // The legacy site borrowed for §16 gets its versions removed and its
    // pointers cleared; its site_document was never written.
    sqlRaw(`update builder_sites set draft_version_id=null, published_version_id=null, spec_published_at=null, status='published' where slug='${LEGACY_SLUG}'`);
    sqlRaw(`delete from builder_site_versions where site_id='${legacySiteId}'`);

    assertEq(sqlOne(`select count(*) from builder_sites`), "4", "the dev seed's site count changed");
    assertEq(sqlOne(`select count(*) from builder_site_versions`), "0", "test versions were left behind");
    assertEq(sqlOne(`select count(*) from builder_sites where site_document is null`), "0", "a legacy document was lost");
    assertEq(sqlOne(`select count(*) from builder_sites where draft_version_id is not null or published_version_id is not null`), "0",
      "a pointer was left set on a seeded site");
  });

  // ── summary ───────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(72)}`);
  console.log(`${passed} passed, ${failed} failed.`);
  console.log("\nRLS matrix:");
  for (const row of rlsMatrix) {
    console.log(`  ${row.allowed === row.expected ? "ok " : "!! "} ${row.actor.padEnd(14)} ${row.action.padEnd(32)} ${row.allowed ? "ALLOWED" : "DENIED"}`);
  }
  if (failed) process.exit(1);
};

main().catch((error) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
