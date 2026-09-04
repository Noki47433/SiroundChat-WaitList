/**
 * The AI layer — clarifications, generation and conversational editing.
 *   npm run test:site-spec:ai
 *
 * No network. The model is scripted, so what is under test is the part that has
 * to hold whatever the model says: the completeness logic, the assembler, the
 * authorization boundary, the persistence contract and the reply composition.
 */
import assert from "node:assert/strict";

import { buildGenerationBrief, briefToPrompt } from "@/lib/site-spec/brief";
import {
  answerClarification,
  decideRemaining,
  MAX_CLARIFICATIONS,
  nextClarifications,
  skipClarification,
  summariseDecisions
} from "@/lib/site-spec/clarify";
import { assembleSpecFromPlan, type SitePlan } from "@/lib/site-spec/ai/plan";
import { generateSiteSpec } from "@/lib/site-spec/ai/generate";
import { emptyModelUsage } from "@/lib/site-spec/ai/client";
import { toSiteSpecOp, type EditPlan, type ModelEditOp } from "@/lib/site-spec/ai/edit";
import { runEdit, runGeneration, startSite } from "@/lib/site-spec/ai/session";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { getDraftVersion, getSiteSpecState, publishSite, restoreVersion, saveDraftSpec } from "@/lib/site-spec/store";
import { FakeSiteDb } from "@/tests/support/fake-site-db";
import {
  ELEGANCE_BUSINESS,
  FADE_BUSINESS,
  FADE_SPEC,
  LENS_BUSINESS,
  LUMI_BUSINESS
} from "@/tests/fixtures/site-spec";

let passed = 0;
let failed = 0;
let queue: Promise<void> = Promise.resolve();
const ok = (name: string, fn: () => void | Promise<void>) => {
  queue = queue.then(async () => {
    try {
      await fn();
      console.log("PASS " + name);
      passed++;
    } catch (error) {
      console.error("FAIL " + name + "\n     " + (error as Error).message);
      failed++;
    }
  });
};

const NOW = "2026-09-04T12:00:00.000Z";

// ─────────────────────────────────────────────────────────────────────────────
// A scripted model
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the given values in order; records what it was asked. */
const scriptModel = <T>(responses: Array<T | { fail: string }>) => {
  const calls: Array<{ system: string; user: string }> = [];
  let index = 0;
  // The fake mirrors the real client's contract, `usage` included: callers now
  // accumulate it, and a fake that omitted it would let a missing field pass
  // here and fail in production.
  const usage = (attempts: number) => ({
    attempts,
    durationMs: attempts,
    promptTokens: attempts * 100,
    completionTokens: attempts * 10
  });
  const call = async (input: any): Promise<any> => {
    calls.push({ system: input.system, user: input.user });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (next && typeof next === "object" && "fail" in (next as object)) {
      return {
        ok: false as const,
        reason: "invalid_output" as const,
        message: (next as { fail: string }).fail,
        attempts: index,
        usage: usage(index)
      };
    }
    // Mirror the real client: run the caller's verify hook and retry on failure.
    const issues = input.verify?.(next) ?? null;
    if (issues) {
      if (index >= responses.length) {
        return {
          ok: false as const,
          reason: "invalid_output" as const,
          message: "did not fit",
          attempts: index,
          usage: usage(index),
          issues
        };
      }
      return call(input);
    }
    return { ok: true as const, value: next as T, attempts: index, usage: usage(index) };
  };
  return { call: call as any, calls, get attempts() { return index; } };
};

const PLAN: SitePlan = {
  brandMark: "PF",
  seoTitle: "Prishtina Fade Co.",
  seoDescription: "Skin fades and hot-towel shaves, six days a week.",
  design: {
    background: "#08080A",
    ink: "#F4F1EA",
    muted: "#8C877E",
    accent: "#E0A43C",
    accentInk: "#100E0B",
    line: "#FFFFFF21",
    soft: "#111114",
    panel: "#131317",
    treatment: "cinematic",
    density: "regular",
    nav: "square",
    navPosition: "edge",
    ctaShape: "square",
    eyebrow: "caps",
    bodyFont: "system",
    displayFont: "grotesk",
    displayWeight: 800,
    heroWeight: 840,
    tracking: -0.04,
    measure: 46,
    radius: 2,
    sectionPad: 64,
    gap: 30,
    colGap: 64,
    heroHeight: 600
  },
  terminology: {
    primaryAction: "Book",
    services: "Services",
    team: "Team",
    gallery: "Work",
    hours: "Hours",
    story: "Story",
    reviews: "Reviews",
    contact: "Visit"
  },
  hero: {
    variant: "full",
    eyebrow: "Prishtina · since 2019",
    headline: "Sharp fades.\nBooked in seconds.",
    body: "Skin fades, beard sculpting and hot-towel shaves.",
    primaryCtaLabel: "Book an appointment",
    secondaryCtaLabel: "See the cuts",
    accentRule: true,
    bandCaption: null
  },
  sections: [
    section("services", "services", "split", "rows", "The list", "Four cuts. Fixed prices."),
    section("team", "team", "wide", "overlay", "Behind the chair", "The people holding the clippers"),
    section("hours", "hours", "wide", "strip", "Hours", "Open six days"),
    section("booking", "booking", "wide", "panel", "Appointments", "Pick a chair"),
    section("contact", "contact", "flush", "panel", "Find us", "Come and see us")
  ],
  footerPresentation: "brand",
  footerCtaHeadline: null,
  navItems: ["services", "team", "hours"]
};

function section(
  type: string,
  id: string,
  layout: string,
  presentation: string,
  eyebrow: string | null,
  title: string | null
): SitePlan["sections"][number] {
  return {
    type: type as never,
    id,
    layout: layout as never,
    presentation,
    eyebrow,
    title,
    sub: null,
    ctaLabel: null,
    storyBody: null,
    storyQuote: null,
    storyAttribution: null,
    hoursNote: null,
    stripHeadline: null,
    stripSub: null,
    galleryCaptions: []
  };
}

const brief = (business = FADE_BUSINESS, request = "A dark, premium barbershop site.") =>
  buildGenerationBrief({ business, request, assets: [] });

// ─────────────────────────────────────────────────────────────────────────────
// Clarifications
// ─────────────────────────────────────────────────────────────────────────────

ok("asks zero questions when the request and the business record already decide it", () => {
  // Mood is stated, booking is live with services (so "Book" is obvious), the
  // owner mentions photos, and the team is named.
  const b = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "A dark, premium barbershop site with photos of the team.",
    assets: [{ id: "a", kind: "hero" }]
  });
  assert.deepEqual(nextClarifications(b), [], "should not have asked anything");
});

ok("asks one question when only the visual direction is missing", () => {
  const b = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "A site for my barbershop showing the team and our photos.",
    assets: [{ id: "a", kind: "hero" }]
  });
  const questions = nextClarifications(b);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].topic, "mood");
});

ok("asks two when the imagery approach is open as well", () => {
  const b = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "Make me a site for the shop. Show the team.",
    assets: []
  });
  const questions = nextClarifications(b);
  assert.deepEqual(questions.map((q) => q.topic), ["mood", "imagery"]);
});

ok("asks three, and never more than three", () => {
  const b = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "Make me a website.",
    assets: []
  });
  const questions = nextClarifications(b);
  assert.equal(questions.length, 3, `expected 3, got ${questions.map((q) => q.topic).join(",")}`);
  assert.ok(questions.length <= MAX_CLARIFICATIONS);
});

ok("never asks something the business record already answers", () => {
  // No booking engine → the primary action is settled, so it is never asked.
  const b = buildGenerationBrief({ business: LENS_BUSINESS, request: "Make me a website.", assets: [] });
  assert.ok(
    !nextClarifications(b).some((q) => q.topic === "primaryAction"),
    "asked about the main action when there is no booking engine"
  );

  // A one-person business is not asked whether to show "the team".
  const solo = buildGenerationBrief({
    business: { ...FADE_BUSINESS, team: FADE_BUSINESS.team.slice(0, 1) },
    request: "Make me a website.",
    assets: []
  });
  assert.ok(!nextClarifications(solo).some((q) => q.topic === "team"));

  // With photos already uploaded, imagery is not a question.
  const withPhotos = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "Make me a website.",
    assets: [{ id: "a", kind: "hero" }, { id: "b", kind: "gallery" }]
  });
  assert.ok(!nextClarifications(withPhotos).some((q) => q.topic === "imagery"));
});

ok("no question asks the owner to choose implementation jargon", () => {
  const b = buildGenerationBrief({ business: FADE_BUSINESS, request: "Make me a website.", assets: [] });
  const jargon = ["hero", "variant", "radius", "layout", "enum", "token", "spec", "presentation", "section"];
  for (const question of decideRemaining(b).length ? nextClarifications(b) : []) {
    const text = `${question.question} ${question.sub} ${question.options.map((o) => `${o.label} ${o.hint ?? ""}`).join(" ")}`.toLowerCase();
    for (const word of jargon) {
      assert.ok(!text.includes(word), `"${word}" leaked into a question: ${question.question}`);
    }
  }
});

ok("an answered question collapses and is never asked again", () => {
  const b = buildGenerationBrief({ business: FADE_BUSINESS, request: "Make me a website.", assets: [] });
  const first = nextClarifications(b);
  const answer = answerClarification(first[0], first[0].options[0].id);
  const second = nextClarifications(b, [answer]);
  assert.ok(!second.some((q) => q.topic === answer.topic), "the answered topic came back");
  assert.equal(second.length, 2, "the remaining budget should be two");
});

ok("skipping records an explicit chosen-for-you decision", () => {
  const b = buildGenerationBrief({ business: FADE_BUSINESS, request: "Make me a website.", assets: [] });
  const question = nextClarifications(b)[0];
  const skipped = skipClarification(question);
  assert.equal(skipped.chosenForYou, true);
  assert.equal(skipped.optionId, question.defaultOptionId);
  assert.ok(skipped.answerLabel.length > 0, "a skip must still record what was chosen");
  assert.match(summariseDecisions([skipped]), /^chosen for you: /);
});

ok("decideRemaining settles everything without asking, and terminates", () => {
  const b = buildGenerationBrief({ business: FADE_BUSINESS, request: "Make me a website.", assets: [] });
  const decisions = decideRemaining(b);
  assert.ok(decisions.length >= 1 && decisions.length <= MAX_CLARIFICATIONS);
  assert.ok(decisions.every((decision) => decision.chosenForYou));
  assert.deepEqual(nextClarifications(b, decisions), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// The brief
// ─────────────────────────────────────────────────────────────────────────────

ok("the brief carries no price, duration, opening time or address", () => {
  const prompt = briefToPrompt(brief());
  for (const forbidden of ["€12", "€18", "30 min", "45 min", "09:00", "19:00", "Rr. Nëna"]) {
    assert.ok(!prompt.includes(forbidden), `the brief leaked "${forbidden}" to the model`);
  }
  // But it does carry the shape the model needs to compose well.
  assert.match(prompt, /services: 4/);
  assert.match(prompt, /team members: 3/);
  assert.match(prompt, /live booking engine: yes/);
});

ok("the brief marks Knowledge as narrative-only and subordinate to Business", () => {
  const withKnowledge = buildGenerationBrief({
    business: FADE_BUSINESS,
    request: "A barbershop site.",
    knowledge: [{ source: "about.pdf", text: "We have been cutting hair since 2019." }]
  });
  const prompt = briefToPrompt(withKnowledge);
  assert.match(prompt, /BACKGROUND MATERIAL/);
  assert.match(prompt, /must not override any operational fact/);
  assert.match(prompt, /cutting hair since 2019/);
});

ok("a business with no booking engine is told to use an enquiry action", () => {
  const prompt = briefToPrompt(brief(LENS_BUSINESS, "An editorial photography site."));
  assert.match(prompt, /live booking engine: no — use an enquiry action instead/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

ok("a plan assembles into a spec that passes Stage 1 validation", () => {
  const result = assembleSpecFromPlan({ plan: PLAN, brief: brief(), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  assert.ok(validateSiteSpec(result.spec).ok);
  assert.equal(result.spec.sections[0].type, "hero", "the hero must open the page");
  assert.equal(result.spec.design.art.sequence.length, 6, "art is derived, not written by the model");
});

ok("assembly is deterministic", () => {
  const a = assembleSpecFromPlan({ plan: PLAN, brief: brief(), now: NOW });
  const b = assembleSpecFromPlan({ plan: PLAN, brief: brief(), now: NOW });
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a.spec, b.spec);
});

ok("art direction is derived from the palette, so two palettes never look alike", () => {
  const dark = assembleSpecFromPlan({ plan: PLAN, brief: brief(), now: NOW });
  const lightPlan: SitePlan = {
    ...PLAN,
    design: { ...PLAN.design, background: "#FFFCFB", ink: "#1F181B", accent: "#B4547A", accentInk: "#FFFFFF", treatment: "clean" }
  };
  const light = assembleSpecFromPlan({ plan: lightPlan, brief: brief(LUMI_BUSINESS), now: NOW });
  assert.ok(dark.ok && light.ok);
  assert.notDeepEqual(
    dark.spec.design.art.sequence,
    light.spec.design.art.sequence,
    "two different palettes produced identical imagery"
  );
});

ok("a booking section is dropped when the business has no booking engine", () => {
  const result = assembleSpecFromPlan({ plan: PLAN, brief: brief(LENS_BUSINESS, "A photography site."), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  assert.ok(!result.spec.sections.some((s) => s.type === "booking"), "a Book button with nothing behind it");
  assert.ok(result.spec.sections.some((s) => s.type === "enquiry"), "there must still be a way to get in touch");
});

ok("sections the business cannot fill are dropped rather than rendered empty", () => {
  const empty = { ...FADE_BUSINESS, services: [], team: [], hasHours: false, hours: [] };
  const result = assembleSpecFromPlan({ plan: PLAN, brief: brief(empty as never), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  for (const type of ["services", "team", "hours"]) {
    assert.ok(!result.spec.sections.some((s) => s.type === type), `an empty ${type} section survived`);
  }
});

ok("generation never produces a populated reviews section", () => {
  const withReviews: SitePlan = {
    ...PLAN,
    sections: [...PLAN.sections, section("reviews", "reviews", "centered", "list", "Reviews", "What clients say")]
  };
  const result = assembleSpecFromPlan({ plan: withReviews, brief: brief(), now: NOW });
  assert.ok(result.ok);
  const reviews = result.spec.sections.find((s) => s.type === "reviews");
  assert.equal((reviews as any)?.presentation, "empty", "generation must not fabricate social proof");
  assert.deepEqual((reviews as any)?.items, []);
});

ok("out-of-range numbers are clamped rather than passed through", () => {
  const wild: SitePlan = {
    ...PLAN,
    design: { ...PLAN.design, radius: 9999, sectionPad: -50, heroHeight: 5, measure: 900 }
  };
  const result = assembleSpecFromPlan({ plan: wild, brief: brief(), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  assert.ok(result.spec.design.geometry.radius <= 40);
  assert.ok(result.spec.design.geometry.sectionPad >= 24);
  assert.ok(result.spec.design.hero.height >= 320);
  assert.ok(result.spec.design.typography.measure <= 78);
});

ok("a malformed structural colour falls the whole palette back coherently", () => {
  // Falling back one colour at a time could pair a defaulted white background
  // with the model's own near-white ink — well-formed and unreadable.
  const broken: SitePlan = { ...PLAN, design: { ...PLAN.design, background: "not-a-colour" } };
  const result = assembleSpecFromPlan({ plan: broken, brief: brief(), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  assert.equal(result.spec.design.palette.background, "#FFFFFF");
  assert.equal(result.spec.design.palette.ink, "#141414", "the ink must fall back with it");
  assert.ok(validateSiteSpec(result.spec).ok, "the fallback palette must be readable");
});

ok("a malformed supporting colour is derived from the good ones", () => {
  const broken: SitePlan = { ...PLAN, design: { ...PLAN.design, muted: "rgb(1,2,3)", panel: "" } };
  const result = assembleSpecFromPlan({ plan: broken, brief: brief(), now: NOW });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
  // The structural colours the model got right are kept.
  assert.equal(result.spec.design.palette.background, "#08080A");
  assert.equal(result.spec.design.palette.ink, "#F4F1EA");
  assert.match(result.spec.design.palette.muted, /^#[0-9A-F]{6}$/);
  assert.match(result.spec.design.palette.panel, /^#[0-9A-F]{6}$/);
});

ok("an unreadable palette is refused rather than clamped into something wrong", () => {
  const unreadable: SitePlan = {
    ...PLAN,
    design: { ...PLAN.design, background: "#08080A", ink: "#0A0A0C" }
  };
  const result = assembleSpecFromPlan({ plan: unreadable, brief: brief(), now: NOW });
  assert.equal(result.ok, false, "unreadable body text should not assemble");
  assert.ok((result as { issues: Array<{ path: string }> }).issues.some((i) => i.path.includes("ink")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Generation through the pipeline
// ─────────────────────────────────────────────────────────────────────────────

ok("structured generation parses, assembles and validates", async () => {
  const model = scriptModel<SitePlan>([PLAN]);
  const result = await generateSiteSpec({ brief: brief(), now: NOW, call: model.call });
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result));
  assert.ok(validateSiteSpec(result.spec).ok);
  assert.equal(result.attempts, 1);
});

ok("an unusable first response is repaired on a bounded retry", async () => {
  const broken: SitePlan = { ...PLAN, design: { ...PLAN.design, ink: "#0A0A0C" } };
  const model = scriptModel<SitePlan>([broken, PLAN]);
  const result = await generateSiteSpec({ brief: brief(), now: NOW, call: model.call });
  assert.ok(result.ok, "the retry should have recovered");
  assert.equal(result.attempts, 2, "it should have taken exactly two attempts");
});

ok("retries are bounded and a persistent failure never yields a spec", async () => {
  const broken: SitePlan = { ...PLAN, design: { ...PLAN.design, ink: "#0A0A0C" } };
  const model = scriptModel<SitePlan>([broken, broken, broken]);
  const result = await generateSiteSpec({ brief: brief(), now: NOW, call: model.call });
  assert.equal(result.ok, false, "an unfixable plan must not produce a site");
  assert.ok(model.attempts <= 3, `unbounded retry: ${model.attempts} attempts`);
});

ok("a failed generation persists nothing", async () => {
  const db = new FakeSiteDb();
  db.addSite({ id: "11111111-1111-4111-8111-000000000001", business_id: FADE_BUSINESS.businessId, slug: "s" });
  const broken: SitePlan = { ...PLAN, design: { ...PLAN.design, ink: "#0A0A0C" } };
  const model = scriptModel<SitePlan>([broken, broken, broken]);

  const outcome = await runGeneration({
    supabase: db,
    siteId: "11111111-1111-4111-8111-000000000001",
    business: FADE_BUSINESS,
    request: "A dark barbershop site.",
    now: NOW,
    generate: (input) => generateSiteSpec({ ...input, call: model.call })
  });

  assert.equal(outcome.ok, false);
  assert.equal(db.versions.length, 0, "a failed generation wrote a version");
});

ok("generation creates a draft only — it never publishes", async () => {
  const db = new FakeSiteDb();
  const siteId = "11111111-1111-4111-8111-000000000002";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "s2" });
  const model = scriptModel<SitePlan>([PLAN]);

  const outcome = await runGeneration({
    supabase: db,
    siteId,
    business: FADE_BUSINESS,
    request: "A dark barbershop site.",
    now: NOW,
    generate: (input) => generateSiteSpec({ ...input, call: model.call })
  });

  assert.ok(outcome.ok, JSON.stringify(outcome));
  const state = await getSiteSpecState(db, siteId);
  assert.ok(state.ok);
  assert.equal(state.value.draftVersionId, outcome.version.id);
  assert.equal(state.value.publishedVersionId, null, "generation published the site");
  assert.equal(outcome.version.source, "generated");
});

ok("skipped clarifications are recorded on the generated result", async () => {
  const db = new FakeSiteDb();
  const siteId = "11111111-1111-4111-8111-000000000003";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "s3" });
  const model = scriptModel<SitePlan>([PLAN]);

  const outcome = await runGeneration({
    supabase: db,
    siteId,
    business: FADE_BUSINESS,
    request: "Make me a website.",
    now: NOW,
    generate: (input) => generateSiteSpec({ ...input, call: model.call })
  });

  assert.ok(outcome.ok);
  assert.ok(outcome.decisions.length >= 1);
  assert.ok(outcome.decisions.every((d) => d.chosenForYou), "unanswered questions must be recorded as chosen-for-you");
  assert.match(outcome.reply, /chosen for you|Here's a first version/i);
});

ok("startSite asks first and generates only when nothing material is missing", () => {
  const vague = startSite({ business: FADE_BUSINESS, request: "Make me a website." });
  assert.equal(vague.status, "needs_clarification");

  const specific = startSite({
    business: FADE_BUSINESS,
    request: "A dark, premium barbershop site with photos of the team.",
    assets: [{ id: "a", kind: "hero" }]
  });
  assert.equal(specific.status, "ready");
});

ok("the model is told, in its own instructions, never to state a price or invent a fact", () => {
  const model = scriptModel<SitePlan>([PLAN]);
  return generateSiteSpec({ brief: brief(), now: NOW, call: model.call }).then(() => {
    const system = model.calls[0].system;
    assert.match(system, /Never state a price/i);
    assert.match(system, /Never invent an award/i);
    assert.match(system, /never overrides an operational fact/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Editing
// ─────────────────────────────────────────────────────────────────────────────

const editDb = async () => {
  const db = new FakeSiteDb();
  const siteId = "22222222-1111-4111-8111-000000000001";
  db.addSite({ id: siteId, business_id: FADE_BUSINESS.businessId, slug: "edit-site" });
  const saved = await saveDraftSpec(db, siteId, FADE_SPEC, { source: "generated" });
  assert.ok(saved.ok, JSON.stringify(saved));
  return { db, siteId, spec: (saved as { ok: true; value: { spec: SiteSpec } }).value.spec };
};

const scriptEdit = (plan: EditPlan) => {
  const model = scriptModel<EditPlan>([plan]);
  return model.call;
};

const editPlan = (operations: ModelEditOp[], understanding = "…", notAWebsiteChange: string | null = null): EditPlan => ({
  understanding,
  operations,
  notAWebsiteChange
});

ok("a simple copy change appends a draft version and reports what it did", async () => {
  const { db, siteId, spec } = await editDb();
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make the headline shorter.",
    interpret: (input) =>
      (require("@/lib/site-spec/ai/edit").interpretEdit as typeof import("@/lib/site-spec/ai/edit").interpretEdit)({
        ...input,
        call: scriptEdit(
          editPlan([{ op: "set_copy", field: "hero.headline", sectionId: null, index: null, value: "Sharp fades." }])
        )
      })
  });

  assert.equal(outcome.changed, true, JSON.stringify(outcome));
  assert.equal(db.versions.length, 2, "an accepted edit must append exactly one version");
  assert.equal(outcome.version?.source, "edit");
  assert.equal((outcome.spec!.sections[0] as any).headline, "Sharp fades.");
  assert.match(outcome.reply, /Rewrote the headline/);
  assert.ok(!outcome.reply.includes("set_copy"), "the reply must not dump operation JSON");
});

ok("a visual mood change moves design tokens and nothing else", async () => {
  const { db, siteId, spec } = await editDb();
  const before = JSON.stringify(spec.sections);
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make it feel more premium.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([
            { op: "set_token", path: "density", stringValue: "spacious", numberValue: null },
            { op: "set_token", path: "typography.display", stringValue: "serif-display", numberValue: null },
            { op: "set_token", path: "geometry.radius", stringValue: null, numberValue: 0 }
          ])
        )
      })
  });

  assert.equal(outcome.changed, true, JSON.stringify(outcome));
  assert.equal(outcome.spec!.design.density, "spacious");
  assert.equal(outcome.spec!.design.typography.display, "serif-display");
  assert.equal(JSON.stringify(outcome.spec!.sections), before, "a style change altered the content");
});

ok("a reorder is a reorder, and a presentation change is a presentation change", async () => {
  const { db, siteId, spec } = await editDb();
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Put the team above the services, and show services as cards.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([
            { op: "reorder_sections", order: ["hero", "book-strip", "team", "services", "hours", "booking", "contact"] },
            { op: "set_presentation", sectionId: "services", presentation: "cards" }
          ])
        )
      })
  });

  assert.equal(outcome.changed, true, JSON.stringify(outcome));
  const ids = outcome.spec!.sections.map((s) => s.id);
  assert.ok(ids.indexOf("team") < ids.indexOf("services"));
  assert.equal(ids.length, spec.sections.length, "a reorder added or dropped a section");
  assert.equal((outcome.spec!.sections.find((s) => s.id === "services") as any).presentation, "cards");
});

ok("an image request binds an owned asset by id, never a URL", async () => {
  const { db, siteId, spec } = await editDb();
  const assetId = "aaaaaaaa-1111-4111-8111-000000000001";
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    assets: [{ id: assetId, label: "shopfront.jpg" }],
    message: "Use my shopfront photo for the hero.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([
            { op: "bind_asset", slot: "hero", index: null, memberId: null, assetId, alt: "Our shopfront" }
          ])
        )
      })
  });

  assert.equal(outcome.changed, true, JSON.stringify(outcome));
  const media = (outcome.spec!.sections[0] as any).media;
  assert.equal(media.kind, "asset");
  assert.equal(media.assetId, assetId);
  // The media reference is an id, not an address — there is no URL field to fill.
  assert.ok(!JSON.stringify(media).includes("http"), "a URL reached the media slot");
  assert.deepEqual(Object.keys(media).sort(), ["alt", "assetId", "fallbackSeed", "kind"]);
});

ok("a price change through the website editor is refused and routed to Business", async () => {
  const { db, siteId, spec } = await editDb();
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Change the haircut price to €4.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([
            { op: "set_copy", field: "section.sub", sectionId: "services", index: null, value: "Haircuts now €4." }
          ])
        )
      })
  });

  assert.equal(outcome.changed, false, "a price edit changed the website");
  assert.equal(db.versions.length, 1, "a refused edit appended a version");
  assert.equal(outcome.rejections[0].reason, "operational_fact");
  assert.match(outcome.reply, /Business settings/);
});

ok("the model can also recognise a business-data request and decline before proposing anything", async () => {
  const { db, siteId, spec } = await editDb();
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "We're open until 9 now.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([], "they want to change opening hours", "Opening hours live in your business record — change them there and the website will follow.")
        )
      })
  });

  assert.equal(outcome.changed, false);
  assert.match(outcome.reply, /business record/);
  assert.equal(db.versions.length, 1);
});

ok("an edit that fails validation gets ONE bounded repair, and can succeed on it", async () => {
  // "Make it feel more premium" is an ordinary request that routinely lands one
  // token outside what the renderer accepts. Generation already repairs from the
  // validator's own issues; editing must too, or the product looks broken when
  // it is merely strict. Found by the live rehearsal.
  const { db, siteId, spec } = await editDb();
  let attempt = 0;

  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make it feel more premium.",
    interpret: async ({ message }) => {
      attempt += 1;
      if (attempt === 1) {
        // Unreadable body text — structurally fine, rejected by the validator.
        return {
          ok: true as const,
          ops: [{ op: "set_token" as const, path: "palette.ink" as const, value: "#0A0A0C" }],
          understanding: "make it darker",
          dropped: 0,
          attempts: 1,
          usage: emptyModelUsage()
        };
      }
      // The retry is told what went wrong.
      assert.match(message, /previous attempt was rejected/i, "the repair must explain the failure");
      assert.match(message, /contrast/i, "the repair must carry the validator's own issue");
      return {
        ok: true as const,
        ops: [{ op: "set_token" as const, path: "density" as const, value: "spacious" }],
        understanding: "more space instead",
        dropped: 0,
        attempts: 1,
        usage: emptyModelUsage()
      };
    }
  });

  assert.equal(attempt, 2, "exactly one repair attempt");
  assert.equal(outcome.changed, true, JSON.stringify(outcome));
  assert.equal(outcome.spec!.design.density, "spacious");
});

ok("the repair is bounded — a second failure gives up and leaves the draft alone", async () => {
  const { db, siteId, spec } = await editDb();
  let attempt = 0;

  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make it feel more premium.",
    interpret: async () => {
      attempt += 1;
      return {
        ok: true as const,
        ops: [{ op: "set_token" as const, path: "palette.ink" as const, value: "#0A0A0C" }],
        understanding: "still unreadable",
        dropped: 0,
        attempts: 1,
        usage: emptyModelUsage()
      };
    }
  });

  assert.equal(attempt, 2, "it must not keep retrying");
  assert.equal(outcome.changed, false);
  assert.equal(db.versions.length, 1, "a failed repair wrote a version");
  assert.match(outcome.reply, /too faint to read/i, "the owner gets the actionable reason");
  assert.ok(outcome.diagnostics?.detail.includes("contrast"), "the real reason is kept for logs");
});

ok("a failed edit leaves the draft exactly as it was", async () => {
  const { db, siteId, spec } = await editDb();
  const before = await getDraftVersion(db, siteId);
  assert.ok(before.ok);

  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Change the layout of a section that doesn't exist.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(editPlan([{ op: "set_layout", sectionId: "nowhere", layout: "wide" }]))
      })
  });

  assert.equal(outcome.changed, false);
  const after = await getDraftVersion(db, siteId);
  assert.ok(after.ok);
  assert.equal(after.value?.id, before.value?.id, "the draft pointer moved on a failed edit");
  assert.equal(db.versions.length, 1);
});

ok("a model timeout preserves the current draft and says so", async () => {
  const { db, siteId, spec } = await editDb();
  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Anything.",
    interpret: async () => ({ ok: false as const, reason: "timeout" as const, message: "timed out", attempts: 1, usage: emptyModelUsage() })
  });
  assert.equal(outcome.changed, false);
  assert.match(outcome.reply, /exactly as it was/);
  assert.equal(db.versions.length, 1);
});

ok("editing never moves the published pointer", async () => {
  const { db, siteId, spec } = await editDb();
  const published = await publishSite(db, siteId);
  assert.ok(published.ok);
  const livePointer = db.sites[0].published_version_id;

  await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make the headline shorter.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([{ op: "set_copy", field: "hero.headline", sectionId: null, index: null, value: "Short." }])
        )
      })
  });

  assert.equal(db.sites[0].published_version_id, livePointer, "an edit changed the live site");
});

ok("Undo restores the previous spec deterministically, with no model involved", async () => {
  const { db, siteId, spec } = await editDb();
  const original = JSON.parse(JSON.stringify(spec));

  const outcome = await runEdit({
    supabase: db,
    siteId,
    spec,
    business: FADE_BUSINESS,
    message: "Make the headline shorter.",
    interpret: (input) =>
      require("@/lib/site-spec/ai/edit").interpretEdit({
        ...input,
        call: scriptEdit(
          editPlan([{ op: "set_copy", field: "hero.headline", sectionId: null, index: null, value: "Short." }])
        )
      })
  });
  assert.equal(outcome.changed, true);
  assert.ok(outcome.undoToVersionId, "an accepted edit must expose what to undo to");

  const restored = await restoreVersion(db, siteId, outcome.undoToVersionId!);
  assert.ok(restored.ok, JSON.stringify(restored));
  assert.deepEqual(restored.value.spec, original, "undo did not restore the previous spec exactly");
  assert.equal(restored.value.source, "restore");
});

// ─────────────────────────────────────────────────────────────────────────────
// Model-operation mapping
// ─────────────────────────────────────────────────────────────────────────────

ok("a model operation missing its target is dropped rather than guessed at", () => {
  assert.equal(
    toSiteSpecOp({ op: "set_copy", field: "section.title", sectionId: null, index: null, value: "x" } as ModelEditOp),
    null
  );
  assert.equal(
    toSiteSpecOp({ op: "bind_asset", slot: "gallery", index: null, memberId: null, assetId: "a", alt: "b" } as ModelEditOp),
    null
  );
  assert.equal(
    toSiteSpecOp({ op: "set_token", path: "density", stringValue: null, numberValue: null } as ModelEditOp),
    null
  );
});

ok("numeric and named tokens are read from the right field", () => {
  assert.deepEqual(
    toSiteSpecOp({ op: "set_token", path: "geometry.radius", stringValue: "16", numberValue: 16 } as ModelEditOp),
    { op: "set_token", path: "geometry.radius", value: 16 }
  );
  assert.deepEqual(
    toSiteSpecOp({ op: "set_token", path: "density", stringValue: "spacious", numberValue: 3 } as ModelEditOp),
    { op: "set_token", path: "density", value: "spacious" }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Differentiation
// ─────────────────────────────────────────────────────────────────────────────

ok("four different plans over four businesses produce four materially different sites", () => {
  const cases = [
    { business: FADE_BUSINESS, plan: PLAN },
    {
      business: LUMI_BUSINESS,
      plan: {
        ...PLAN,
        design: { ...PLAN.design, background: "#FFFCFB", ink: "#1F181B", accent: "#B4547A", accentInk: "#FFFFFF", treatment: "clean" as const, radius: 16, nav: "soft" as const, ctaShape: "pill" as const },
        hero: { ...PLAN.hero, variant: "split" as const },
        footerPresentation: "cta" as const,
        sections: [section("gallery", "gallery", "wide", "mosaic", "Our work", "Fresh from the studio"), ...PLAN.sections]
      }
    },
    {
      business: ELEGANCE_BUSINESS,
      plan: {
        ...PLAN,
        design: { ...PLAN.design, background: "#FCFAF6", ink: "#211A1F", accent: "#6E4A63", accentInk: "#FFFFFF", treatment: "editorial" as const, radius: 0, displayFont: "serif" as const, density: "spacious" as const, nav: "rule" as const, navPosition: "center" as const },
        hero: { ...PLAN.hero, variant: "editorial" as const },
        footerPresentation: "editorial" as const
      }
    },
    {
      business: LENS_BUSINESS,
      plan: {
        ...PLAN,
        design: { ...PLAN.design, background: "#0B0C0E", ink: "#EDE9E1", accent: "#E9E4DA", accentInk: "#0B0C0E", treatment: "photographic" as const, bodyFont: "mono" as const },
        footerPresentation: "minimal" as const,
        sections: [section("gallery", "gallery", "wide", "portfolio", "Selected work", "Twelve weddings"), ...PLAN.sections]
      }
    }
  ];

  const specs = cases.map(({ business, plan }) => {
    const result = assembleSpecFromPlan({ plan: plan as SitePlan, brief: brief(business), now: NOW });
    assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.issues));
    return result.spec;
  });

  // Every pair differs in more than a colour: hero, footer and art all move.
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      assert.notEqual(JSON.stringify(specs[i]), JSON.stringify(specs[j]));
    }
  }
  assert.equal(new Set(specs.map((s) => s.design.art.treatment)).size, 4, "four art directions expected");
  assert.equal(new Set(specs.map((s) => s.footer.presentation)).size, 4, "four footers expected");
  assert.ok(new Set(specs.map((s) => (s.sections[0] as any).variant)).size >= 3, "at least three hero variants");
});

// ─────────────────────────────────────────────────────────────────────────────

queue.then(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
});
