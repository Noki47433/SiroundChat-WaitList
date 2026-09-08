#!/usr/bin/env node
/**
 * Guards the Stage 3D defect against coming back.
 *
 * A production GET route handler was serving a Supabase read out of the Next.js
 * Data Cache — an answer taken before any booking existed, replayed to every
 * visitor through every redeploy. The fix put the freshness guarantee inside the
 * shared Supabase client factories (`lib/supabase/live-fetch.ts`), so it applies
 * to every server-side read without a route having to remember anything.
 *
 * That guarantee holds only while every server-side client comes from those
 * factories. This checks exactly that, and nothing else:
 *
 *   1. the three server factories still pass the live fetch, and
 *   2. no production file builds its own server-side Supabase client.
 *
 * Scripts, harnesses and browser components are out of scope: they do not run
 * inside a Next.js route handler, so the Data Cache never sees them.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "lib", "components"];
const FACTORY_FILES = ["lib/supabase/admin.ts", "lib/supabase/server.ts"];
const ALLOWED = new Set([
  ...FACTORY_FILES,
  "lib/supabase/live-fetch.ts",
  // Browser-only factory: it persists a session and refreshes tokens, which only
  // makes sense in a tab. It has no importers today. Listed by name rather than
  // by a loose heuristic, so adopting it on the server trips this check.
  "lib/supabase/client.ts"
]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
};

const failures = [];

// 1 · the factories still carry the guarantee
for (const file of FACTORY_FILES) {
  const source = readFileSync(file, "utf8");
  const creates = (source.match(/createClient|createRouteHandlerClient|createServerComponentClient/g) ?? []).length;
  const guarded = (source.match(/LIVE_FETCH_OPTIONS/g) ?? []).length;
  if (creates === 0) continue;
  if (guarded === 0) {
    failures.push(`${file}: creates a Supabase client but never passes LIVE_FETCH_OPTIONS`);
  }
}

// 2 · nothing else builds a server-side client
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOWED.has(file)) continue;
    const source = readFileSync(file, "utf8");
    if (!/from ["']@supabase\/supabase-js["']/.test(source)) continue;
    if (!/\bcreateClient\s*[<(]/.test(source)) continue;
    // A "use client" file runs in the browser, where there is no Data Cache.
    if (/^\s*["']use client["']/m.test(source)) continue;
    failures.push(`${file}: creates a server-side Supabase client outside lib/supabase/*`);
  }
}

if (failures.length > 0) {
  console.error("[live-read-freshness] FAIL");
  for (const line of failures) console.error(`  - ${line}`);
  console.error(
    "\n  Server-side Supabase reads must go through lib/supabase/{admin,server}.ts so that\n" +
      "  lib/supabase/live-fetch.ts keeps them out of the Next.js Data Cache."
  );
  process.exit(1);
}

console.log("[live-read-freshness] OK — all server-side Supabase clients carry the live fetch.");
