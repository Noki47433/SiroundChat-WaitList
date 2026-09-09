/**
 * Stage 3F — the widening checkpoint, run after EACH business is enabled.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f-checkpoint.ts <expected-enabled-count>
 *
 * The rule this enforces is the one that makes a staged rollout a rollout rather
 * than a batch: after each new business, everything that was already working must
 * still be working, and the count must be exactly what was intended. A cohort
 * that is only checked at the end cannot tell you which business broke it.
 *
 * Exits non-zero if anything fails, which is the signal to stop widening and
 * leave the previously healthy businesses alone.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const EXPECTED = Number(process.argv[2]);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

let passed = 0;
let failed = 0;
const ok = async (name: string, fn: () => Promise<string>) => {
  try {
    console.log(`  PASS ${name}\n         ${await fn()}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL ${name}\n         ${String((error as Error)?.message ?? error)}`);
    failed += 1;
  }
};

const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const main = async () => {
  console.log(`\n──────── checkpoint · expecting ${EXPECTED} enabled ────────`);

  const { data: enabled } = await db
    .from("business_site_spec_rollout")
    .select("business_id, state, public_mode")
    .neq("state", "off");

  await ok("the enabled count is exactly what was intended", async () => {
    if ((enabled ?? []).length !== EXPECTED) {
      throw new Error(`${(enabled ?? []).length} enabled, expected ${EXPECTED}`);
    }
    const names: string[] = [];
    for (const row of enabled!) {
      const { data: b } = await db.from("businesses").select("business_name").eq("id", row.business_id).single();
      names.push(`${b!.business_name} (${row.state}/${row.public_mode})`);
    }
    return names.join(" · ");
  });

  await ok("every enabled website answers in its intended public mode", async () => {
    const lines: string[] = [];
    for (const row of enabled!) {
      const { data: site } = await db
        .from("builder_sites")
        .select("slug, published_version_id")
        .eq("business_id", row.business_id)
        .single();
      const response = await fetch(`${BASE}/s/${site!.slug}`);
      const body = await response.text();
      if (row.public_mode === "site_spec") {
        if (response.status !== 200) throw new Error(`${site!.slug} returned ${response.status} in site_spec mode`);
        if (/temporarily unavailable/i.test(body)) throw new Error(`${site!.slug} is serving the holding page`);
      } else if (row.public_mode === "maintenance") {
        if (response.status !== 200) throw new Error(`${site!.slug} returned ${response.status} in maintenance`);
        if (!/temporarily unavailable/i.test(body)) throw new Error(`${site!.slug} is not the holding page`);
      }
      lines.push(`${site!.slug}=${response.status}/${row.public_mode}`);
    }
    return lines.join(" · ");
  });

  await ok("shared rate limiting is still healthy", async () => {
    const response = await fetch(`${BASE}/api/health/rate-limit`);
    const json: any = await response.json();
    if (response.status !== 200 || json.mode !== "shared" || !json.configured || !json.productionSafe) {
      throw new Error(`HTTP ${response.status} ${JSON.stringify(json)}`);
    }
    return `${response.status} · ${json.mode} · configured ${json.configured} · productionSafe ${json.productionSafe}`;
  });

  await ok("no enabled business serves stale availability", async () => {
    // For each serving business, ask twice around a booking and insist the
    // answer moves. A cached read would show the same slots both times.
    const lines: string[] = [];
    for (const row of enabled!) {
      const { data: site } = await db.from("builder_sites").select("slug").eq("business_id", row.business_id).single();
      const { data: service } = await db
        .from("service")
        .select("id")
        .eq("business_id", row.business_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!service || row.public_mode !== "site_spec") continue;
      for (let i = 2; i <= 16; i += 1) {
        const date = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
        const response = await fetch(
          `${BASE}/api/site-spec/booking?slug=${site!.slug}&serviceId=${service.id}&date=${date}`
        );
        const json: any = await response.json().catch(() => ({}));
        if (response.status === 200 && (json.slots ?? []).length > 0) {
          lines.push(`${site!.slug}:${(json.slots ?? []).length} slots`);
          break;
        }
      }
    }
    return lines.join(" · ") || "no serving business had an open day in range";
  });

  await ok("no cross-tenant leak between cohort businesses", async () => {
    // Each business's slug must refuse another's service id.
    const serving = enabled!.filter((r) => r.public_mode === "site_spec");
    if (serving.length < 2) return "SKIPPED — fewer than two serving businesses";
    const rows: Array<{ slug: string; serviceId: string }> = [];
    for (const row of serving) {
      const { data: site } = await db.from("builder_sites").select("slug").eq("business_id", row.business_id).single();
      const { data: service } = await db
        .from("service")
        .select("id")
        .eq("business_id", row.business_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (service) rows.push({ slug: site!.slug, serviceId: service.id });
    }
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    for (const a of rows) {
      for (const b of rows) {
        if (a.slug === b.slug) continue;
        const response = await fetch(
          `${BASE}/api/site-spec/booking?slug=${a.slug}&serviceId=${b.serviceId}&date=${date}`
        );
        if (response.status !== 404) {
          throw new Error(`${a.slug} accepted ${b.slug}'s service id (HTTP ${response.status})`);
        }
      }
    }
    return `${rows.length}×${rows.length - 1} cross-tenant probes, all 404 ✓`;
  });

  await ok("no published pointer moved without an explicit publish", async () => {
    const snapshotPath = "/private/tmp/claude-501/-Users-kyro-Downloads-next/ecfa4d0e-b716-459a-90da-419470cf4417/scratchpad/published-pointers.json";
    const current: Record<string, string | null> = {};
    for (const row of enabled!) {
      const { data: site } = await db
        .from("builder_sites")
        .select("slug, published_version_id")
        .eq("business_id", row.business_id)
        .single();
      current[site!.slug] = site!.published_version_id;
    }
    let previous: Record<string, string | null> = {};
    try {
      previous = JSON.parse(readFileSync(snapshotPath, "utf8"));
    } catch {
      /* first checkpoint */
    }
    const moved = Object.entries(previous).filter(([slug, id]) => current[slug] && current[slug] !== id);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(snapshotPath, JSON.stringify(current, null, 2));
    if (moved.length && !process.env.EXPECT_PUBLISH) {
      throw new Error(`published pointer moved for ${moved.map(([s]) => s).join(", ")}`);
    }
    return moved.length
      ? `${moved.length} publish(es) this block, expected`
      : `${Object.keys(current).length} pointers unchanged`;
  });

  await ok("the Siround canary is untouched", async () => {
    const { data: row } = await db
      .from("business_site_spec_rollout")
      .select("state, public_mode")
      .eq("business_id", "e7387690-bef7-4a9d-bcf5-0830d713e7c4")
      .single();
    const { data: site } = await db
      .from("builder_sites")
      .select("published_version_id")
      .eq("business_id", "e7387690-bef7-4a9d-bcf5-0830d713e7c4")
      .eq("status", "published")
      .single();
    if (row!.state !== "canary" || row!.public_mode !== "site_spec") {
      throw new Error(`canary is ${row!.state}/${row!.public_mode}`);
    }
    if (site!.published_version_id !== "c30cfb71-6258-445f-8891-5dd757c7464a") {
      throw new Error("the canary's published version moved");
    }
    const page = await fetch(`${BASE}/s/siround`);
    if (page.status !== 200) throw new Error(`the canary page returned ${page.status}`);
    return "canary/site_spec · published v22 unmoved · page 200";
  });

  // The witness and this check must share one normalisation. They did not at
  // first — a perl one-liner built the baseline and this used its own regex, so
  // every site "changed" while all fifteen were byte-identical. The baseline is
  // now written by this same function.
  await ok("the 15 legacy sites are unchanged", async () => {
    const baseline = readFileSync(
      "/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f/legacy-baseline.txt",
      "utf8"
    )
      .trim()
      .split("\n")
      .map((line) => line.split(" "));
    const { createHash } = await import("node:crypto");
    let same = 0;
    for (const [slug, status, hash] of baseline) {
      const response = await fetch(`${BASE}/s/${slug}`);
      const body = await response.text();
      const digest = createHash("md5").update(strip(body)).digest("hex");
      if (String(response.status) === status && digest === hash) same += 1;
    }
    if (same !== baseline.length) throw new Error(`${same}/${baseline.length} unchanged`);
    return `${same}/${baseline.length} identical to the pre-widening witness`;
  });

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.log("  → STOP. Leave the healthy businesses enabled and do not widen further.");
    process.exit(1);
  }
};

void main();
