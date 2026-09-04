/**
 * Deterministic renderer — same inputs, same website; different specs,
 * different websites; and no industry anywhere in between.
 *
 *   npm run test:site-spec:renderer
 *
 * Class names arrive as the identity mapping via the CSS-module stub, so an
 * assertion reads as the composition choice the spec made.
 */
import assert from "node:assert/strict";
import { createElement } from "react";

// The repo has no `@types/react-dom`, and adding one would rewrite a lockfile
// that already carries unrelated uncommitted work. Typed locally instead.
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

import { SiteSpecRenderer } from "@/components/site-spec/SiteSpecRenderer";
import type { BusinessPayload } from "@/lib/business/load";
import { resolveSite, type SiteAsset } from "@/lib/site-spec/resolve";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import {
  ELEGANCE_BUSINESS,
  ELEGANCE_SPEC,
  FADE_BUSINESS,
  FADE_SPEC,
  FIXTURES,
  LENS_BUSINESS,
  LENS_SPEC,
  LUMI_BUSINESS,
  LUMI_SPEC
} from "@/tests/fixtures/site-spec";

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    console.log("PASS " + name);
    passed++;
  } catch (error) {
    console.error("FAIL " + name + "\n     " + (error as Error).message);
    failed++;
  }
};

const render = (
  spec: SiteSpec,
  business: BusinessPayload,
  options: { assets?: SiteAsset[]; slug?: string } = {}
): string => {
  const validated = validateSiteSpec(spec);
  assert.ok(validated.ok, `fixture spec must be valid: ${JSON.stringify(validated.ok ? [] : validated.issues)}`);
  const site = resolveSite({
    spec: validated.spec,
    business,
    assets: options.assets ?? []
  });
  return renderToStaticMarkup(
    createElement(SiteSpecRenderer, { site, slug: options.slug ?? "fixture" })
  );
};

const classesIn = (html: string): Set<string> => {
  const found = new Set<string>();
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    for (const name of match[1].split(/\s+/)) if (name) found.add(name);
  }
  return found;
};

// ─────────────────────────────────────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────────────────────────────────────

ok("the same spec, business and assets render byte-identical markup", () => {
  for (const fixture of FIXTURES) {
    const first = render(fixture.spec, fixture.business);
    const second = render(fixture.spec, fixture.business);
    assert.equal(first, second, `${fixture.label} rendered differently on a second pass`);
  }
});

ok("determinism survives a round trip through JSON", () => {
  const direct = render(FADE_SPEC, FADE_BUSINESS);
  const roundTripped = render(JSON.parse(JSON.stringify(FADE_SPEC)), FADE_BUSINESS);
  assert.equal(direct, roundTripped);
});

ok("generated art is a pure function of the spec and the slot index", () => {
  const html = render(LUMI_SPEC, LUMI_BUSINESS);
  const gradients = [...html.matchAll(/background-image:([^&"]*)/g)].map((m) => m[1]);
  assert.ok(gradients.length >= 6, `expected several generated images, got ${gradients.length}`);
  // Distinct slots must draw distinct pictures, or the craft pass's "every
  // image is the same soft gradient" defect is back.
  assert.ok(new Set(gradients).size > 1, "every generated image was identical");
});

// ─────────────────────────────────────────────────────────────────────────────
// Differentiation — one renderer, four materially different websites
// ─────────────────────────────────────────────────────────────────────────────

ok("the four fixtures produce structurally different pages", () => {
  const rendered = FIXTURES.map((fixture) => ({
    label: fixture.label,
    html: render(fixture.spec, fixture.business)
  }));

  for (let i = 0; i < rendered.length; i++) {
    for (let j = i + 1; j < rendered.length; j++) {
      assert.notEqual(
        rendered[i].html,
        rendered[j].html,
        `${rendered[i].label} and ${rendered[j].label} rendered identically`
      );
    }
  }
});

ok("heroes, footers and section compositions genuinely differ", () => {
  const of = (spec: SiteSpec, business: BusinessPayload) => classesIn(render(spec, business));
  const fade = of(FADE_SPEC, FADE_BUSINESS);
  const lumi = of(LUMI_SPEC, LUMI_BUSINESS);
  const elegance = of(ELEGANCE_SPEC, ELEGANCE_BUSINESS);
  const lens = of(LENS_SPEC, LENS_BUSINESS);

  // Three different hero compositions across four sites.
  assert.ok(fade.has("hero-full"), "fade uses the full-bleed hero");
  assert.ok(lumi.has("hero-split"), "lumi uses the split hero");
  assert.ok(elegance.has("hero-ed"), "elegance uses the editorial hero");
  assert.ok(lens.has("hero-full"), "lens uses the full-bleed hero");

  // Four different footers.
  assert.ok(fade.has("ft-brand"), "fade footer");
  assert.ok(lumi.has("ft-cta"), "lumi footer");
  assert.ok(elegance.has("ft-ed"), "elegance footer");
  assert.ok(lens.has("ft-min"), "lens footer");

  // Four different services presentations over the same canonical rows.
  assert.ok(fade.has("svc-rows"), "fade services");
  assert.ok(lumi.has("svc-cards"), "lumi services");
  assert.ok(elegance.has("svc-ed"), "elegance services");
  assert.ok(lens.has("svc-pk"), "lens services");

  // No site uses only one section layout.
  for (const [label, set] of [
    ["fade", fade],
    ["lumi", lumi],
    ["elegance", elegance],
    ["lens", lens]
  ] as const) {
    const layouts = [...set].filter((name) => name.startsWith("lay-"));
    assert.ok(
      new Set(layouts).size >= 2,
      `${label} used only ${JSON.stringify(layouts)} — every section reads the same`
    );
  }
});

ok("terminology is spec-owned, so the same renderer says Book or Enquire", () => {
  const fade = render(FADE_SPEC, FADE_BUSINESS);
  const lens = render(LENS_SPEC, LENS_BUSINESS);
  assert.ok(fade.includes(">Book<"), "fade should say Book");
  assert.ok(lens.includes(">Enquire<"), "lens should say Enquire");
  assert.ok(!lens.includes(">Book<"), "lens should never say Book");
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry independence
// ─────────────────────────────────────────────────────────────────────────────

ok("swapping the business under a spec changes the facts, never the composition", () => {
  // The photography spec, rendered against the barbershop's canonical data.
  const crossed = render({ ...LENS_SPEC, meta: { ...LENS_SPEC.meta, businessId: FADE_BUSINESS.businessId } }, FADE_BUSINESS);
  const native = render(LENS_SPEC, LENS_BUSINESS);

  const crossedLayouts = [...classesIn(crossed)].filter((n) => n.startsWith("lay-") || n.startsWith("svc-") || n.startsWith("ft-") || n.startsWith("hero-")).sort();
  const nativeLayouts = [...classesIn(native)].filter((n) => n.startsWith("lay-") || n.startsWith("svc-") || n.startsWith("ft-") || n.startsWith("hero-")).sort();
  assert.deepEqual(crossedLayouts, nativeLayouts, "composition changed with the business");

  // ...and the facts on the page came from the business that was handed in.
  assert.ok(crossed.includes("Skin fade"), "crossed render should show the barbershop's services");
  assert.ok(!crossed.includes("Wedding — full day"), "crossed render must not show the other business's services");
});

ok("the renderer source contains no industry, trade or fixture branch", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const sources = [
    "components/site-spec/SiteSpecRenderer.tsx",
    "lib/site-spec/resolve.ts",
    "lib/site-spec/tokens.ts",
    "lib/site-spec/schema.ts",
    "lib/site-spec/vocabulary.ts"
  ].map((path) => ({ path, code: fs.readFileSync(path, "utf8") }));

  // Trades and fixture names. Note what is NOT here: "photographic" is one of
  // four art treatments any business can choose — a presentation value, not a
  // trade — so the list names the trade words ("photography", "photographer")
  // rather than the stem they share.
  const forbidden = [
    "barber",
    "salon",
    "nail",
    "beauty",
    "photography",
    "photographer",
    "restaurant",
    "hairdresser",
    "industry",
    "prishtina",
    "lumi",
    "elegance",
    "fixture"
  ];

  // Prose in a comment explaining the rule is fine; a branch in code is not.
  const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  for (const { path, code } of sources) {
    const inCode = stripComments(code).toLowerCase();
    for (const word of forbidden) {
      // Match on a word start so `relativeLuminance` is not read as "lumi",
      // while `nails` and `barbershop` still are.
      assert.ok(
        !new RegExp(`\\b${word}`).test(inCode),
        `${path} references "${word}" outside a comment`
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Canonical business data
// ─────────────────────────────────────────────────────────────────────────────

ok("prices, durations, hours and address come from the business, not the spec", () => {
  const html = render(FADE_SPEC, FADE_BUSINESS);
  assert.ok(html.includes("€12"), "the skin fade price from the service table");
  assert.ok(html.includes("30 min"), "the duration from the service table");
  assert.ok(html.includes("Rr. Nëna Terezë 24, Prishtina"), "the canonical address");
  assert.ok(html.includes("+383 44 210 118"), "the canonical phone");
  assert.ok(html.includes("09:00–19:00"), "canonical opening hours");

  // The spec itself holds none of them.
  const specText = JSON.stringify(FADE_SPEC);
  assert.ok(!specText.includes("€12"), "the spec must not carry a price");
  assert.ok(!specText.includes("Rr. Nëna Terezë"), "the spec must not carry the address");
});

ok("a price change in Business changes the page with no edit to the spec", () => {
  const before = render(FADE_SPEC, FADE_BUSINESS);
  const raised: BusinessPayload = {
    ...FADE_BUSINESS,
    services: FADE_BUSINESS.services.map((service, index) =>
      index === 0 ? { ...service, basePriceCents: 1400 } : service
    )
  };
  const after = render(FADE_SPEC, raised);
  assert.ok(before.includes("€12") && !before.includes("€14"));
  assert.ok(after.includes("€14"), "the new price should appear without touching the spec");
});

ok("a `from` price mode and a hidden price are honoured", () => {
  const html = render(LENS_SPEC, LENS_BUSINESS);
  assert.ok(html.includes("from €900"), `expected a "from" price, got none`);

  const hidden: BusinessPayload = {
    ...LENS_BUSINESS,
    services: LENS_BUSINESS.services.map((service) => ({ ...service, priceMode: "hidden" as const }))
  };
  const hiddenHtml = render(LENS_SPEC, hidden);
  assert.ok(!hiddenHtml.includes("€900"), "a hidden price must not be rendered");
  assert.ok(hiddenHtml.includes("Wedding — full day"), "the service itself still shows");
});

ok("a fact reference that no longer resolves renders nothing, not `undefined`", () => {
  const spec: any = JSON.parse(JSON.stringify(FADE_SPEC));
  spec.sections[5].heading.title = {
    ref: "service.name",
    id: "99999999-9999-4999-8999-999999999999"
  };
  const html = render(spec, FADE_BUSINESS);
  assert.ok(!html.includes("undefined"), "a dangling reference leaked into the page");
  assert.ok(!html.includes("null"), "a dangling reference leaked into the page");
});

// ─────────────────────────────────────────────────────────────────────────────
// Missing and awkward data
// ─────────────────────────────────────────────────────────────────────────────

ok("a business with no services drops the services section and its nav item", () => {
  const empty: BusinessPayload = { ...FADE_BUSINESS, services: [], team: [] };
  const html = render(FADE_SPEC, empty);
  assert.ok(!classesIn(html).has("svc-rows"), "an empty services section was still drawn");
  assert.ok(!html.includes(">Services<"), "the nav still linked to a section that is not there");
  assert.ok(html.includes("hero-full"), "the rest of the page still renders");
});

ok("a business with no hours drops the hours section", () => {
  const noHours: BusinessPayload = { ...FADE_BUSINESS, hasHours: false, hours: [] };
  const html = render(FADE_SPEC, noHours);
  assert.ok(!classesIn(html).has("hrs"), "an empty hours block was drawn");
  assert.ok(!html.includes(">Hours<"), "the nav still linked to the hours section");
});

ok("a business with no location still renders, without an empty contact block", () => {
  const noLocation: BusinessPayload = { ...FADE_BUSINESS, location: null };
  const html = render(FADE_SPEC, noLocation);
  assert.ok(!classesIn(html).has("ct-panel"), "an empty contact panel was drawn");
  assert.ok(html.includes("hero-full"), "the rest of the page still renders");
  assert.ok(!html.includes("undefined"));
});

ok("very long text and unusual names render without throwing or overflowing markup", () => {
  const longName = "Ştüdio " + "Very".repeat(30) + " Long & <Co>";
  const business: BusinessPayload = { ...FADE_BUSINESS, businessName: longName };
  const spec: any = JSON.parse(JSON.stringify(FADE_SPEC));
  delete spec.meta.brandName;
  delete spec.meta.brandMark;
  const html = render(spec, business);
  assert.ok(html.includes("&lt;Co&gt;"), "the name should be escaped, not injected");
  // The footer wordmark is sized from its own character count so it cannot clip.
  assert.ok(html.includes("--brandlen"), "the brand-length custom property is missing");
});

ok("a service with no description or an empty team name does not break a row", () => {
  const odd: BusinessPayload = {
    ...FADE_BUSINESS,
    services: FADE_BUSINESS.services.map((service) => ({ ...service, description: null })),
    team: FADE_BUSINESS.team.map((member) => ({ ...member, name: "" }))
  };
  const html = render(LUMI_SPEC, odd);
  assert.ok(html.includes("svc-cards"), "cards still render without descriptions");
  assert.ok(!html.includes("undefined"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────────────────────

ok("spec copy is escaped, never executed", () => {
  const spec: any = JSON.parse(JSON.stringify(FADE_SPEC));
  spec.sections[0].headline = '<script>alert(1)</script>';
  spec.sections[2].heading.sub = '"><img src=x onerror=alert(1)>';
  const html = render(spec, FADE_BUSINESS);
  assert.ok(!/<script/i.test(html), "a script tag reached the page");
  assert.ok(!/<img[^>]*onerror/i.test(html), "an event handler reached the page");
  assert.ok(html.includes("&lt;script&gt;"), "the copy should appear escaped");
  assert.ok(html.includes("&lt;img src=x onerror="), "the injection should appear as inert text");
});

ok("business data is escaped too", () => {
  const hostile: BusinessPayload = {
    ...FADE_BUSINESS,
    services: [
      { ...FADE_BUSINESS.services[0], name: '<img src=x onerror=alert(1)>' },
      ...FADE_BUSINESS.services.slice(1)
    ]
  };
  const html = render(FADE_SPEC, hostile);
  assert.ok(!/<img[^>]*onerror/i.test(html), "an event handler reached the page via business data");
  assert.ok(html.includes("&lt;img src=x"), "business data should appear as inert text");
});

ok("CSS custom properties carry only bounded, typed values", () => {
  const html = render(FADE_SPEC, FADE_BUSINESS);
  const style = html.match(/style="([^"]*--w-bg[^"]*)"/)?.[1] ?? "";
  assert.ok(style.includes("--w-bg:#08080A"), `expected the palette in the root style, got ${style}`);
  assert.ok(style.includes("--w-pad:64px"), "geometry should arrive with its unit attached");
  assert.ok(!/[<>]/.test(style), "the root style must not contain markup characters");
});

ok("external links get noopener, internal anchors do not", () => {
  const html = render(FADE_SPEC, FADE_BUSINESS);
  assert.ok(
    /<a[^>]*href="https:\/\/instagram\.com[^"]*"[^>]*rel="noopener noreferrer"/.test(html),
    "an external social link is missing rel=noopener"
  );
  assert.ok(/href="#services"/.test(html), "an internal anchor should stay a plain anchor");
});

ok("a directions CTA is built from the canonical address, not from spec text", () => {
  const html = render(FADE_SPEC, FADE_BUSINESS);
  assert.ok(
    html.includes("https://www.google.com/maps/search/?api=1&amp;query=Rr.%20N%C3%ABna"),
    "the directions link should encode the canonical address"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────────────────────

ok("a pinned asset renders as a real image and survives an unrelated edit", () => {
  const assetId = "aaaaaaaa-1111-4111-8111-000000000001";
  const spec: any = JSON.parse(JSON.stringify(FADE_SPEC));
  spec.sections[0].media = { kind: "asset", assetId, alt: "Our shop front", fallbackSeed: 0 };
  const assets: SiteAsset[] = [
    { id: assetId, url: "https://cdn.example.com/shop.jpg", alt: null }
  ];

  const before = render(spec, FADE_BUSINESS, { assets });
  assert.ok(before.includes('src="https://cdn.example.com/shop.jpg"'), "the pinned asset is missing");
  assert.ok(before.includes('alt="Our shop front"'), "the alt text is missing");

  // An edit somewhere else in the spec must not dislodge it — the asset is
  // addressed by id, not by position.
  const edited = JSON.parse(JSON.stringify(spec));
  edited.sections[0].headline = "A shorter headline.";
  edited.sections[2].presentation = "cards";
  const after = render(edited, FADE_BUSINESS, { assets });
  assert.ok(after.includes('src="https://cdn.example.com/shop.jpg"'), "the pinned asset was lost");
});

ok("a missing or unsafe asset falls back to generated art, never a broken image", () => {
  const spec: any = JSON.parse(JSON.stringify(FADE_SPEC));
  spec.sections[0].media = {
    kind: "asset",
    assetId: "aaaaaaaa-1111-4111-8111-000000000002",
    alt: "Gone",
    fallbackSeed: 3
  };

  const missing = render(spec, FADE_BUSINESS, { assets: [] });
  assert.ok(!missing.includes("<img"), "a deleted asset should not leave an <img>");
  assert.ok(missing.includes("background-image"), "it should fall back to generated art");

  const unsafe = render(spec, FADE_BUSINESS, {
    assets: [
      {
        id: "aaaaaaaa-1111-4111-8111-000000000002",
        url: "javascript:alert(1)",
        alt: null
      }
    ]
  });
  assert.ok(!unsafe.includes("javascript:"), "an unsafe asset URL reached the page");
});

// ─────────────────────────────────────────────────────────────────────────────
// Honesty
// ─────────────────────────────────────────────────────────────────────────────

ok("no bookable time slot is drawn — the renderer has no availability to offer", () => {
  for (const fixture of FIXTURES) {
    const classes = classesIn(render(fixture.spec, fixture.business));
    assert.ok(!classes.has("slot"), `${fixture.label} drew a bookable slot`);
    assert.ok(!classes.has("slots"), `${fixture.label} drew a slot row`);
  }
});

ok("an empty reviews section says so rather than inventing a testimonial", () => {
  const html = render(ELEGANCE_SPEC, ELEGANCE_BUSINESS);
  assert.ok(html.includes("No reviews connected yet"));
  assert.ok(html.includes("never write a review for you"));
});

// ── Stage 2.5 · hostile content on the way out ───────────────────────────────

ok("hostile copy is escaped on render — it can never become markup or script", () => {
  // The complement to the Stage 2.5 authorization tests: those prove hostile
  // text can only ever land in a copy field, this proves that a copy field is
  // rendered as text. Together they close "smuggle HTML/JS through natural
  // language" without a denylist anywhere in the pipeline.
  const hostile = JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
  const payload = '</h1><script>alert(1)</script><img src=x onerror=alert(2)>';
  (hostile.sections[0] as { headline: string }).headline = payload;
  (hostile.meta.seo as { title: string }).title = payload;
  assert.ok(validateSiteSpec(hostile).ok, "the fixture must stay a valid spec");

  const html = render(hostile, FADE_BUSINESS);
  // Every `<` from the payload must have become `&lt;`, so no element and no
  // attribute is created by it. The text itself is still on the page, visible
  // and inert, which is the honest outcome — the renderer does not silently
  // delete what an owner typed.
  assert.ok(!html.includes("<script"), "a script tag reached the document");
  assert.ok(!html.includes("<img src=x"), "an element reached the document");
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(2)&gt;"));
});

ok("a hostile string in copy cannot reach a style attribute or a URL", () => {
  const hostile = JSON.parse(JSON.stringify(FADE_SPEC)) as SiteSpec;
  const payload = "#fff;} body{display:none} a{content:url(https://evil.example.com)";
  (hostile.sections[0] as { headline: string }).headline = payload;
  const html = render(hostile, FADE_BUSINESS);

  // The string may appear once — as the headline's text. It must not appear
  // inside any attribute value or any <style> block, which is what would make
  // it a stylesheet rather than a sentence.
  assert.ok(!/style="[^"]*display:none/.test(html), "copy reached a style attribute");
  assert.ok(!/<style[^>]*>[^<]*evil\.example\.com/.test(html), "copy reached a stylesheet");
  assert.ok(!/(?:src|href)="[^"]*evil\.example\.com/.test(html), "copy reached a URL attribute");
  assert.ok(html.includes(payload), "the owner's text should still be shown, inert");
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

