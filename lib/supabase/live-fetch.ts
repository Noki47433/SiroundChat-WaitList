import "server-only";

/**
 * The fetch every server-side Supabase client uses.
 *
 * Stage 3D found a production defect that took a canary, a real booking and a
 * long afternoon to localise: the published website was offering times that were
 * already booked. The write path refused them, so nothing was ever double-booked,
 * but a visitor picked a time, typed their details, and only then was told to
 * choose again.
 *
 * The cause was not in any query. supabase-js reads are HTTP GETs, and Next.js
 * puts fetches made inside a GET Route Handler into its Data Cache — while a POST
 * handler's fetches go straight out. On Vercel that cache outlives deployments.
 * One occupancy answer, taken before a single booking existed, was replayed to
 * every visitor through every redeploy. `export const dynamic = "force-dynamic"`
 * does not prevent it: it governs how the route renders, not how its fetches are
 * stored.
 *
 * The lesson is not "that route needed a flag". It is that the guarantee was
 * being asserted in the wrong place. A route file is a bad home for a database
 * freshness rule: it has to be repeated 54 times, and the 55th route is written
 * by someone who never read this comment. So the rule lives here, once, in the
 * client itself — every read through a server Supabase client is unambiguously
 * live, whatever kind of handler it happens to run inside.
 *
 * This is deliberately narrow. It marks Supabase traffic no-store and nothing
 * else; caching of genuinely cacheable things — static assets, third-party
 * responses, pages — is untouched.
 */
export const liveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/** The option block to spread into every server-side `createClient` call. */
export const LIVE_FETCH_OPTIONS = { global: { fetch: liveFetch } } as const;
