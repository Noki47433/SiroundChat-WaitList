/**
 * Stage 3E — the 25-second edit ceiling, verified end to end.
 *   BASE_URL=http://127.0.0.1:3310 npx tsx scripts/harness/verify-edit-timeout.ts
 *
 * Stage 3D put a hard ceiling on conversational edits and covered it with unit
 * tests. Unit tests prove the timer fires. They do not prove the thing that
 * actually matters, which is what the whole request does when it does — whether
 * the owner is told in time, whether anything was written, and above all whether
 * something arrives *later*, after the response has gone, and quietly changes a
 * website nobody is looking at any more.
 *
 * So this drives the real HTTP route on a production build, with a model made
 * deterministically slower than the ceiling, and then does the part that unit
 * tests cannot: it waits past the point where the slow model finally answers,
 * and checks that nothing appeared.
 *
 * Requires the server to be started with SITE_SPEC_TEST_SLOW_MODEL_MS set well
 * above the ceiling. That variable is inert on the production deployment.
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const CEILING_MS = 25_000;
const TRANSPORT_MARGIN_MS = 8_000;
const SLOW_MODEL_MS = Number(process.env.SITE_SPEC_TEST_SLOW_MODEL_MS ?? 45_000);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

let passed = 0;
let failed = 0;
const ok = async (name: string, fn: () => Promise<string>) => {
  try {
    const detail = await fn();
    console.log(`PASS ${name}\n       ${detail}`);
    passed += 1;
  } catch (error) {
    console.log(`FAIL ${name}\n       ${String((error as Error)?.message ?? error)}`);
    failed += 1;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ownerSession = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { data: roll } = await db
    .from("business_site_spec_rollout")
    .select("business_id")
    .neq("state", "off")
    .limit(1)
    .single();
  const { data: site } = await db
    .from("builder_sites")
    .select("id, owner_user_id")
    .eq("business_id", roll!.business_id)
    .eq("status", "published")
    .single();
  const { data: user } = await db.auth.admin.getUserById(site!.owner_user_id as string);
  const { data: link } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: user.user!.email!
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false }
  });
  const { data: session, error } = await anon.auth.verifyOtp({
    token_hash: (link as any).properties.hashed_token,
    type: "magiclink"
  });
  if (error) throw new Error(`could not establish an owner session: ${error.message}`);
  const ref = new URL(url).hostname.split(".")[0];
  const cookie =
    `sb-${ref}-auth-token=` +
    encodeURIComponent(
      JSON.stringify([session.session!.access_token, session.session!.refresh_token, null, null, null])
    );
  return { siteId: site!.id as string, cookie };
};

const versionCount = async (siteId: string) => {
  const { count } = await db
    .from("builder_site_versions")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);
  return count ?? 0;
};

const main = async () => {
  const { siteId, cookie } = await ownerSession();

  const state = await fetch(`${BASE}/api/site-spec/state?siteId=${siteId}`, { headers: { cookie } });
  const stateJson: any = await state.json();
  const baseVersionId = stateJson?.state?.draftVersionId as string;
  if (!baseVersionId) throw new Error("could not read the current draft version");

  const before = await versionCount(siteId);
  const requestId = `stage3e-timeout-${Date.now()}`;

  const started = Date.now();
  const response = await fetch(`${BASE}/api/site-spec/edit`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      siteId,
      baseVersionId,
      requestId,
      message: "Make the hero heading a little warmer"
    })
  });
  const body: any = await response.json().catch(() => ({}));
  const elapsed = Date.now() - started;

  await ok("the request returns within the ceiling plus transport margin", async () => {
    if (elapsed > CEILING_MS + TRANSPORT_MARGIN_MS) {
      throw new Error(`took ${(elapsed / 1000).toFixed(1)}s against a ${CEILING_MS / 1000}s ceiling`);
    }
    return `${(elapsed / 1000).toFixed(1)}s (ceiling ${CEILING_MS / 1000}s, model delayed ${
      SLOW_MODEL_MS / 1000
    }s)`;
  });

  await ok("the owner is told nothing changed", async () => {
    if (body?.changed === true) throw new Error("the response reported a change");
    const reply = String(body?.reply ?? body?.error ?? "");
    if (!reply) throw new Error("no message was returned at all");
    return `changed=${body?.changed === true} · "${reply.slice(0, 72)}"`;
  });

  await ok("no version was written", async () => {
    const after = await versionCount(siteId);
    if (after !== before) throw new Error(`version count moved ${before} → ${after}`);
    return `still ${after} versions`;
  });

  await ok("nothing arrives late, after the slow model finally answers", async () => {
    // The real risk of a timeout is not the timeout. It is the work that was
    // abandoned still finishing, and writing.
    const waitFor = SLOW_MODEL_MS - elapsed + 6_000;
    if (waitFor > 0) await sleep(waitFor);
    const after = await versionCount(siteId);
    if (after !== before) {
      throw new Error(`a version appeared ${(waitFor / 1000).toFixed(0)}s later: ${before} → ${after}`);
    }
    const stateAfter = await fetch(`${BASE}/api/site-spec/state?siteId=${siteId}`, { headers: { cookie } });
    const draftAfter = (await stateAfter.json())?.state?.draftVersionId;
    if (draftAfter !== baseVersionId) {
      throw new Error("the draft pointer moved after the response had already gone");
    }
    return `waited ${(waitFor / 1000).toFixed(0)}s past the model's own answer; still ${after} versions, draft unmoved`;
  });

  await ok("a retry is possible — the timed-out attempt did not consume the idempotency slot", async () => {
    // A caller that times out will retry. If the first attempt left a claim
    // behind, the retry is refused as a duplicate and the owner is stuck.
    const retry = await fetch(`${BASE}/api/site-spec/edit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        siteId,
        baseVersionId,
        requestId: `${requestId}-retry`,
        message: "Make the hero heading a little warmer"
      })
    });
    const retryBody: any = await retry.json().catch(() => ({}));
    if (retry.status === 409 && retryBody?.error === "duplicate_request") {
      throw new Error("the retry was rejected as a duplicate");
    }
    return `retry accepted by the route (HTTP ${retry.status})`;
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

void main();
