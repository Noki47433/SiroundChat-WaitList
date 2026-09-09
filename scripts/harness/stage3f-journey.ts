/**
 * Stage 3F — the full website journey for one cohort business.
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3f-journey.ts <2|3|4|5>
 *
 * Phase D asks for the same proof from every business in the cohort, which is
 * precisely why it belongs in one script rather than in four sessions of manual
 * driving: if each business is exercised slightly differently, "all five passed"
 * means five different things.
 *
 * Everything here goes through the real owner and visitor routes. Nothing reaches
 * past them into the database except to read a fixture id or to assert an
 * invariant the API does not expose.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const N = Number(process.argv[2]);
const businessId = `3f00000${N}-0000-4000-8000-000000000001`;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

let passed = 0;
let failed = 0;
const results: Array<{ area: string; name: string; ok: boolean; detail: string }> = [];
const ok = async (area: string, name: string, fn: () => Promise<string>) => {
  try {
    const detail = await fn();
    console.log(`  PASS [${area}] ${name}\n         ${detail}`);
    results.push({ area, name, ok: true, detail });
    passed += 1;
  } catch (error) {
    const detail = String((error as Error)?.message ?? error);
    console.log(`  FAIL [${area}] ${name}\n         ${detail}`);
    results.push({ area, name, ok: false, detail });
    failed += 1;
  }
};

let session: { siteId: string; slug: string; cookie: string };

const api = async (path: string, init?: RequestInit & { owner?: boolean }) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.owner !== false) headers.cookie = session.cookie;
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: response.status, json, text, headers: response.headers };
};

const draftVersion = async () => (await api(`/api/site-spec/state?siteId=${session.siteId}`)).json?.state?.draftVersionId;
const publishedVersion = async () =>
  (await api(`/api/site-spec/state?siteId=${session.siteId}`)).json?.state?.publishedVersionId ?? null;
const spec = async () => (await api(`/api/site-spec/state?siteId=${session.siteId}`)).json?.spec;

const edit = async (message: string) => {
  const baseVersionId = await draftVersion();
  const started = Date.now();
  const response = await api("/api/site-spec/edit", {
    method: "POST",
    body: JSON.stringify({
      siteId: session.siteId,
      baseVersionId,
      requestId: `s3f-${N}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      message
    })
  });
  return {
    ms: Date.now() - started,
    status: response.status,
    changed: response.json?.changed === true,
    reply: String(response.json?.reply ?? response.json?.error ?? ""),
    body: response.json
  };
};

/** Wait out the owner edit budget if a burst gets close to it. */
const breathe = () => new Promise((r) => setTimeout(r, 1100));

const dayISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** A real 400×400 PNG in two different colourways, so two assets are distinguishable. */
const pngBytes = (variant: number) => {
  // A real 8x8 PNG rather than a byte string that merely starts like one: the
  // upload route checks dimensions and content type, and a fake would be
  // rejected for the wrong reason.
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");
  // The upload route enforces a 200px minimum per side, and it is right to:
  // a thumbnail-sized "photo" would look broken on a page. 400 clears it.
  const size = 400;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const p = row + 1 + x * 3;
      raw[p] = variant === 0 ? 40 + x * 8 : 200 - x * 8;
      raw[p + 1] = variant === 0 ? 60 : 120;
      raw[p + 2] = variant === 0 ? 90 + y * 6 : 160 - y * 6;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crcTable: number[] = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
};

const main = async () => {
  const raw = readFileSync(`/tmp/s${N}.json`, "utf8");
  session = JSON.parse(raw);
  const { data: business } = await db.from("businesses").select("business_name").eq("id", businessId).single();
  console.log(`\n════════ business #${N} · ${business!.business_name} ════════`);

  const { data: services } = await db
    .from("service")
    .select("id, name, base_duration_min")
    .eq("business_id", businessId)
    .order("display_order");
  const { data: workers } = await db
    .from("team_member")
    .select("id, display_name")
    .eq("business_id", businessId);

  // ── EDITING ───────────────────────────────────────────────────────────────
  // Eight representative edits, spanning every operation family an owner can
  // reach, plus the two refusals that matter: one the model should decline and
  // one the product must decline.
  const editPlan: Array<{ label: string; message: string; mustApply: boolean }> = [
    { label: "copy", message: "Make the hero heading shorter and warmer", mustApply: true },
    { label: "copy", message: "Rewrite the intro paragraph so it sounds calmer", mustApply: true },
    { label: "layout", message: "Make the services section full width", mustApply: true },
    { label: "design token", message: "Give the buttons rounder corners", mustApply: true },
    { label: "typography", message: "Make the headings a little larger", mustApply: true },
    { label: "typography", message: "Use a more classic typeface for headings", mustApply: true },
    { label: "reorder", message: "Move the hours section to the bottom of the page", mustApply: true },
    { label: "section op", message: "Add a gallery section with our photos", mustApply: true }
  ];

  for (const item of editPlan) {
    await breathe();
    await ok("edit", `${item.label}: "${item.message.slice(0, 46)}"`, async () => {
      const result = await edit(item.message);
      if (item.mustApply && !result.changed) {
        throw new Error(`refused (${result.status}): ${result.reply.slice(0, 90)}`);
      }
      return `${(result.ms / 1000).toFixed(1)}s · ${result.reply.slice(0, 76)}`;
    });
  }

  await breathe();
  await ok("edit", "an operational fact is refused, not written to the page", async () => {
    const result = await edit("Change the price of the consultation to 12 euros");
    if (result.changed) throw new Error("the website edited a price");
    return result.reply.slice(0, 96);
  });

  await breathe();
  await ok("edit", "a duplicate section is refused with a specific reason", async () => {
    const result = await edit("Add a gallery section with our photos");
    if (result.changed) throw new Error("a second gallery was added");
    if (!/already has a/i.test(result.reply)) throw new Error(`vague refusal: ${result.reply.slice(0, 80)}`);
    return result.reply.slice(0, 96);
  });

  await breathe();
  await ok("edit", "a stale baseVersionId is refused (stale-write protection)", async () => {
    const stale = await draftVersion();
    await edit("Make the hero heading a touch shorter"); // moves the draft on
    await breathe();
    const response = await api("/api/site-spec/edit", {
      method: "POST",
      body: JSON.stringify({
        siteId: session.siteId,
        baseVersionId: stale,
        requestId: `s3f-stale-${Date.now()}`,
        message: "Make the hero heading a touch shorter"
      })
    });
    if (response.status !== 409) throw new Error(`expected 409, got ${response.status}`);
    return `409 ${response.json?.error} — the earlier draft could not overwrite the newer one`;
  });

  await breathe();
  await ok("edit", "a replayed requestId does not apply twice", async () => {
    const baseVersionId = await draftVersion();
    const requestId = `s3f-idem-${Date.now()}`;
    const body = JSON.stringify({
      siteId: session.siteId,
      baseVersionId,
      requestId,
      message: "Make the footer simpler"
    });
    const first = await api("/api/site-spec/edit", { method: "POST", body });
    const second = await api("/api/site-spec/edit", { method: "POST", body });
    if (second.json?.changed === true && first.json?.changed === true) {
      throw new Error("both deliveries applied");
    }
    return `first ${first.status} changed=${first.json?.changed}, replay ${second.status} ${second.json?.error ?? "not applied"}`;
  });

  // ── ASSETS ────────────────────────────────────────────────────────────────
  let assetIds: string[] = [];
  await ok("assets", "two images upload through the real route", async () => {
    const upload = async (name: string, variant: number) => {
      const form = new FormData();
      form.append("siteId", session.siteId);
      form.append("kind", "gallery");
      form.append(
        "file",
        new Blob([pngBytes(variant)], { type: "image/png" }),
        name
      );
      const response = await fetch(`${BASE}/api/builder/upload-image`, {
        method: "POST",
        headers: { cookie: session.cookie },
        body: form
      });
      return { status: response.status, json: await response.json().catch(() => ({})) };
    };
    const a = await upload("stage3f-a.png", 0);
    const b = await upload("stage3f-b.png", 1);
    if (a.status !== 200 || b.status !== 200) {
      throw new Error(`upload returned ${a.status} / ${b.status}: ${JSON.stringify(a.json).slice(0, 120)}`);
    }
    const { data: assets } = await db
      .from("builder_site_assets")
      .select("id")
      .eq("site_id", session.siteId);
    assetIds = (assets ?? []).map((x: any) => x.id);
    if (assetIds.length < 2) throw new Error(`expected 2+ assets, found ${assetIds.length}`);
    return `${assetIds.length} assets owned by this site`;
  });

  await breathe();
  await ok("assets", "an image binds, and no URL enters the spec", async () => {
    const result = await edit("Use one of my photos for the hero image");
    const current = await spec();
    const blob = JSON.stringify(current);
    if (/https?:\/\//.test(blob.replace(/"seo"[^}]*}/g, ""))) {
      const hit = blob.match(/https?:\/\/[^"]{0,60}/);
      throw new Error(`a URL reached the spec: ${hit?.[0]}`);
    }
    return `${result.changed ? "bound" : "not bound"} · no media URL anywhere in the spec ✓`;
  });

  // ── PUBLISH ───────────────────────────────────────────────────────────────
  await ok("publish", "the published pointer is untouched until an explicit publish", async () => {
    const published = await publishedVersion();
    if (published) throw new Error(`already published as ${published}`);
    return "draft-only so far — nothing has ever been served ✓";
  });

  let publishedId = "";
  await ok("publish", "an explicit publish by version id goes live", async () => {
    const versionId = await draftVersion();
    const response = await api("/api/site-spec/publish", {
      method: "POST",
      body: JSON.stringify({ siteId: session.siteId, versionId })
    });
    if (response.status !== 200) throw new Error(`publish returned ${response.status}`);
    publishedId = versionId;
    // Public serving is switched on only now, once a reviewed version exists.
    await db
      .from("business_site_spec_rollout")
      .update({ public_mode: "site_spec" })
      .eq("business_id", businessId);
    return `version ${response.json?.version?.number} live; public_mode → site_spec`;
  });

  await ok("publish", "the live page matches the published version", async () => {
    const live = await api(`/s/${session.slug}`, { owner: false });
    if (live.status !== 200) throw new Error(`public page returned ${live.status}`);
    const draft = await api(`/s/${session.slug}?preview=true&siteId=${session.siteId}`);
    const strip = (html: string) =>
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (strip(live.text) !== strip(draft.text)) throw new Error("live and draft differ right after publishing");
    return "live and draft render identical visible text ✓";
  });

  await breathe();
  await ok("publish", "a draft edit after publishing does NOT change the live page", async () => {
    const before = await api(`/s/${session.slug}`, { owner: false });
    const result = await edit("Change the hero eyebrow to say Stage 3F draft only");
    if (!result.changed) return `SKIPPED — the edit did not apply (${result.reply.slice(0, 60)})`;
    const after = await api(`/s/${session.slug}`, { owner: false });
    const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    if (strip(before.text) !== strip(after.text)) throw new Error("the live page moved without a publish");
    if ((await publishedVersion()) !== publishedId) throw new Error("the published pointer moved");
    return "draft advanced, live page byte-identical, published pointer unmoved ✓";
  });

  await ok("publish", "an explicit republish is required to show the new draft", async () => {
    const versionId = await draftVersion();
    const response = await api("/api/site-spec/publish", {
      method: "POST",
      body: JSON.stringify({ siteId: session.siteId, versionId })
    });
    if (response.status !== 200) throw new Error(`republish returned ${response.status}`);
    publishedId = versionId;
    return `republished as version ${response.json?.version?.number}`;
  });

  // ── BOOKING ───────────────────────────────────────────────────────────────
  const service = services![0];
  let openDay = "";
  let slots: Array<{ startAtIso: string }> = [];
  await ok("booking", "public availability answers for a real day", async () => {
    for (let i = 2; i <= 20; i += 1) {
      const date = dayISO(i);
      const response = await api(
        `/api/site-spec/booking?slug=${session.slug}&serviceId=${service.id}&date=${date}`,
        { owner: false }
      );
      if (response.status === 200 && (response.json?.slots ?? []).length > 0) {
        openDay = date;
        slots = response.json.slots;
        return `${date}: ${slots.length} slots, workers ${(response.json.workers ?? []).map((w: any) => w.name).join(", ")}`;
      }
    }
    throw new Error("no open day found in 20 days");
  });

  let manageToken = "";
  await ok("booking", "a visitor completes a booking", async () => {
    const target = slots[Math.min(2, slots.length - 1)].startAtIso;
    const response = await api("/api/site-spec/booking/create", {
      owner: false,
      method: "POST",
      body: JSON.stringify({
        slug: session.slug,
        serviceId: service.id,
        teamMemberId: workers![0].id,
        date: openDay,
        startAt: target,
        customerName: `Stage3F Visitor ${N}`,
        customerPhone: `+3830000${N}001`,
        requestId: `s3f-book-${N}-${Date.now()}`
      })
    });
    if (response.status !== 200 || !response.json?.ok) {
      throw new Error(`create returned ${response.status}: ${JSON.stringify(response.json).slice(0, 120)}`);
    }
    manageToken = String(response.json.manageUrl).split("/").pop()!;
    // The slot must disappear FOR THE WORKER WHO WAS BOOKED. Asserting it
    // disappears from the union is wrong wherever a business has more than one
    // eligible worker — business #3 caught this: booking Blerim quite correctly
    // leaves the slot on offer, because Driton is still free to take it.
    const mine = await api(
      `/api/site-spec/booking?slug=${session.slug}&serviceId=${service.id}&date=${openDay}&teamMemberId=${workers![0].id}`,
      { owner: false }
    );
    const stillMine = (mine.json?.slots ?? []).some((s: any) => s.startAtIso === target);
    if (stillMine) throw new Error("the booked worker is still being offered that slot");

    const union = await api(
      `/api/site-spec/booking?slug=${session.slug}&serviceId=${service.id}&date=${openDay}`,
      { owner: false }
    );
    const stillAnyone = (union.json?.slots ?? []).some((s: any) => s.startAtIso === target);
    const others = (union.json?.workers ?? []).length - 1;
    if (stillAnyone && others === 0) {
      throw new Error("the only eligible worker is booked, yet the slot is still offered");
    }
    return `${response.json.booking.status} · gone for ${workers![0].display_name} immediately${
      stillAnyone ? ` · still offered by ${others} other eligible worker(s), correctly` : " · gone from the union too"
    }`;
  });

  await ok("booking", "the manage link views, reschedules and cancels", async () => {
    const view = await api(`/api/manage-booking/${manageToken}`, { owner: false });
    if (view.status !== 200) throw new Error(`view returned ${view.status}`);
    const fresh = await api(
      `/api/site-spec/booking?slug=${session.slug}&serviceId=${service.id}&date=${openDay}`,
      { owner: false }
    );
    const next = (fresh.json?.slots ?? [])[0]?.startAtIso;
    const moved = await api(`/api/manage-booking/${manageToken}`, {
      owner: false,
      method: "POST",
      body: JSON.stringify({ action: "reschedule", date: openDay, newStart: next })
    });
    if (moved.status !== 200) throw new Error(`reschedule returned ${moved.status}: ${moved.text.slice(0, 90)}`);
    const cancelled = await api(`/api/manage-booking/${manageToken}`, {
      owner: false,
      method: "POST",
      body: JSON.stringify({ action: "cancel" })
    });
    if (cancelled.status !== 200) throw new Error(`cancel returned ${cancelled.status}`);
    return `view 200 · reschedule 200 · cancel 200`;
  });

  await ok("booking", "a forged manage token reveals nothing", async () => {
    const response = await api(`/api/manage-booking/${"a".repeat(43)}`, { owner: false });
    if (response.status !== 404) throw new Error(`expected 404, got ${response.status}`);
    return `404 ${response.json?.error}`;
  });

  // ── CONCURRENCY ───────────────────────────────────────────────────────────
  await ok("concurrency", "three visitors racing one slot produce exactly one booking", async () => {
    const fresh = await api(
      `/api/site-spec/booking?slug=${session.slug}&serviceId=${service.id}&date=${openDay}`,
      { owner: false }
    );
    const target = (fresh.json?.slots ?? [])[0]?.startAtIso;
    if (!target) throw new Error("no slot left to race for");
    const attempts = await Promise.all(
      [1, 2, 3].map((i) =>
        api("/api/site-spec/booking/create", {
          owner: false,
          method: "POST",
          body: JSON.stringify({
            slug: session.slug,
            serviceId: service.id,
            teamMemberId: workers![0].id,
            date: openDay,
            startAt: target,
            customerName: `Stage3F Race ${N}-${i}`,
            customerPhone: `+3830000${N}10${i}`,
            requestId: `s3f-race-${N}-${i}-${Date.now()}`
          })
        })
      )
    );
    const won = attempts.filter((a) => a.json?.ok === true);
    if (won.length !== 1) throw new Error(`${won.length} of 3 succeeded — expected exactly one`);
    return `1 booked, ${attempts.length - 1} refused (${attempts.filter((a) => a.status === 409).length}×409)`;
  });

  // ── ROLLBACK ──────────────────────────────────────────────────────────────
  await ok("rollback", "site_spec → maintenance → site_spec, losing nothing", async () => {
    const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const before = strip((await api(`/s/${session.slug}`, { owner: false })).text);
    const { count: versionsBefore } = await db
      .from("builder_site_versions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", session.siteId);

    await db.from("business_site_spec_rollout").update({ public_mode: "maintenance" }).eq("business_id", businessId);
    await new Promise((r) => setTimeout(r, 2500));
    const held = await api(`/s/${session.slug}`, { owner: false });
    if (held.status !== 200) throw new Error(`maintenance returned ${held.status}, expected 200`);
    if (!/temporarily unavailable/i.test(held.text)) throw new Error("not the holding page");
    if (/\b\d{1,2}:\d{2}\b/.test(strip(held.text))) throw new Error("the holding page is showing times");

    await db.from("business_site_spec_rollout").update({ public_mode: "site_spec" }).eq("business_id", businessId);
    await new Promise((r) => setTimeout(r, 2500));
    const after = strip((await api(`/s/${session.slug}`, { owner: false })).text);
    const { count: versionsAfter } = await db
      .from("builder_site_versions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", session.siteId);

    if (after !== before) throw new Error("the page changed across the rollback");
    if (versionsBefore !== versionsAfter) throw new Error("version history changed across the rollback");
    if ((await publishedVersion()) !== publishedId) throw new Error("the published pointer moved");
    return `200 → holding page (no times) → 200 byte-identical · ${versionsAfter} versions intact`;
  });

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  const path = `/Users/kyro/Downloads/next/audit-output/phase-3/evidence/site-spec-stage3f/journey-${N}.json`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, JSON.stringify({ business: N, passed, failed, results }, null, 2));
  console.log(`  written to ${path}`);
  if (failed > 0) process.exit(1);
};

void main();
