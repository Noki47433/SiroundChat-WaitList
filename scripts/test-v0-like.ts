import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildIntakeBrief } from "@/src/generation/v0_like/intake";
import { buildWebsitePlan } from "@/src/generation/v0_like/plan";
import { runPipelineChecks } from "@/src/generation/v0_like/checks";
import { createRetryState, canRetryStage, registerRetry } from "@/src/generation/v0_like/retry";
import { renderWebsitePlan } from "@/src/generation/v0_like/render";
import { validateWebsitePlan } from "@/src/generation/v0_like/schema";
import {
  GENERIC_QUALITY_PHRASES,
  buildQualityReport
} from "@/src/generation/v0_like/quality";
import {
  BANNED_COPY_PHRASES,
  validatePlanWithBusinessRules
} from "@/src/generation/v0_like/validate";
import { runV0LikeGenerationPipeline } from "@/src/generation/v0_like";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const loadFixture = async (name: string) => {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "generation", "v0-like", name);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const collectStrings = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => collectStrings(child, output));
  }

  return output;
};

const buildRestaurantCase = async () => {
  const rawPrompt = "Build a website for Rikoli Restaurant with menu, gallery, reservations, and contact details.";
  const metadata = {
    businessName: "Rikoli",
    category: "Restaurant",
    industry: "Restaurant",
    description: "Neighborhood restaurant with seasonal menu",
    tone: "warm",
    primaryColor: "#facc15",
    secondaryColor: "#ffffff",
    fontFamily: "Playfair Display",
    targetCustomer: "Local diners",
    services: ["Dinner reservations"],
    includePricing: false
  };

  const intake = await buildIntakeBrief(rawPrompt, metadata, null);
  const plan = await buildWebsitePlan(intake, rawPrompt, null);
  return { rawPrompt, metadata, intake, plan };
};

const buildClinicCase = async () => {
  const rawPrompt = "Build a website for Dentiva dental clinic with services, testimonials, and contact.";
  const metadata = {
    businessName: "DENTIVA",
    category: "Clinic",
    industry: "Dental clinic",
    description: "Modern family dental clinic",
    tone: "friendly",
    primaryColor: "#0d9488",
    secondaryColor: "#ecfdf5",
    fontFamily: null,
    targetCustomer: "patients seeking dental care",
    services: ["Dental care"],
    includePricing: false
  };

  const intake = await buildIntakeBrief(rawPrompt, metadata as any, null);
  const plan = await buildWebsitePlan(intake, rawPrompt, null);
  return { rawPrompt, metadata, intake, plan };
};

const buildBarbershopCase = async () => {
  const rawPrompt = "Build a website for North Cut Barbershop with skin fades, beard trims, hot towel shaves, reviews, FAQ, and contact.";
  const metadata = {
    businessName: "North Cut",
    category: "Barbershop",
    industry: "Barbershop",
    description: "Modern neighborhood barbershop for working professionals",
    tone: "premium",
    primaryColor: "#d97706",
    secondaryColor: "#fff7ed",
    fontFamily: "Space Grotesk",
    targetCustomer: "Busy professionals who want sharp weekly grooming",
    services: ["Skin fades", "Beard trims", "Hot towel shaves"],
    language: "en" as const,
    brief: {
      audience: "Busy professionals who want sharp weekly grooming",
      coreOffer: "Precision barbering with reliable appointment flow",
      primaryCtaGoal: "book_appointment" as const,
      topServices: ["Skin fades", "Beard trims", "Hot towel shaves"],
      proofPoints: ["Late opening hours", "Walk-ins welcome", "5-star local reviews"],
      tone: "premium"
    }
  };

  const intake = await buildIntakeBrief(rawPrompt, metadata as any, null);
  const plan = await buildWebsitePlan(intake, rawPrompt, null, [], {
    qualityMode: "best",
    candidateIndex: 0
  });
  const quality = buildQualityReport({
    plan,
    intake,
    mode: "best",
    candidateCount: 3
  });
  return { rawPrompt, metadata, intake, plan, quality };
};

const buildEcommerceCase = async () => {
  const rawPrompt = "Build a website for Northline Outfitters online store with shop, testimonials, FAQ, and contact.";
  const metadata = {
    businessName: "Northline Outfitters",
    category: "Ecommerce",
    industry: "Ecommerce",
    description: "Outdoor gear online store",
    tone: "bold",
    primaryColor: "#ea580c",
    secondaryColor: "#fff7ed",
    fontFamily: "Inter",
    targetCustomer: "Outdoor shoppers",
    services: ["Trail-ready gear"],
    includePricing: false
  };

  const intake = await buildIntakeBrief(rawPrompt, metadata as any, null);
  const plan = await buildWebsitePlan(intake, rawPrompt, null);
  return { rawPrompt, metadata, intake, plan };
};

async function testSchemaValidation() {
  const validSaas = await loadFixture("known-good-saas.json");
  const validRestaurant = await loadFixture("known-good-restaurant.json");
  const unknown = await loadFixture("invalid-unknown-section.json");
  const overlong = await loadFixture("invalid-overlong-hero.json");

  const validSaasResult = validateWebsitePlan(validSaas);
  assert(validSaasResult.ok, "schema_accepts_known_good_saas failed");

  const validRestaurantResult = validateWebsitePlan(validRestaurant);
  assert(validRestaurantResult.ok, "schema_accepts_known_good_restaurant failed");

  const unknownResult = validateWebsitePlan(unknown);
  assert(!unknownResult.ok, "schema_rejects_unknown_section_type expected failure");
  if (!unknownResult.ok) {
    assert(
      unknownResult.errors.some((issue) => issue.path.includes("sections") && issue.path.includes("type")),
      "schema_rejects_unknown_section_type missing path hint"
    );
  }

  const overlongResult = validateWebsitePlan(overlong);
  assert(!overlongResult.ok, "schema_rejects_overlong_hero_headline expected failure");
  if (!overlongResult.ok) {
    assert(
      overlongResult.errors.some((issue) => issue.path.includes("headline")),
      "schema_rejects_overlong_hero_headline missing headline path"
    );
  }

  console.log("- schema_accepts_known_good_saas");
  console.log("- schema_accepts_known_good_restaurant");
  console.log("- schema_rejects_unknown_section_type");
  console.log("- schema_rejects_overlong_hero_headline");
}

async function testRestaurantPlanEnforcesVerticalGoalTheme() {
  const { intake, plan } = await buildRestaurantCase();

  assert(intake.vertical === "restaurant", "restaurant_plan_enforces_vertical_goal_theme intake.vertical failed");
  assert(plan.meta.vertical === "restaurant", "restaurant_plan_enforces_vertical_goal_theme plan.meta.vertical failed");
  assert(plan.meta.primaryGoal === "reservations", "restaurant_plan_enforces_vertical_goal_theme primaryGoal failed");
  assert(plan.theme.accent === "yellow", "restaurant_plan_enforces_vertical_goal_theme accent failed");
  assert(plan.theme.font !== "mono", "restaurant_plan_enforces_vertical_goal_theme font must not be mono");

  console.log("- restaurant_plan_enforces_vertical_goal_theme");
}

async function testRestaurantForbidsPricingAndSaasCopy() {
  const { rawPrompt, intake, plan } = await buildRestaurantCase();

  assert(!plan.sections.some((section) => section.type === "pricing"), "restaurant_forbids_pricing expected no pricing section");

  const strings = collectStrings(plan).map((value) => value.toLowerCase());
  const foundBanned = BANNED_COPY_PHRASES.find((phrase) => strings.some((value) => value.includes(phrase)));
  assert(!foundBanned, `restaurant_forbids_pricing_and_saas_copy found banned phrase '${foundBanned}'`);

  const validResult = validatePlanWithBusinessRules(plan, rawPrompt, intake);
  assert(validResult.ok, "restaurant_forbids_pricing_and_saas_copy expected valid restaurant plan");

  const invalidPricing = await loadFixture("invalid-restaurant-has-pricing.json");
  const invalidPricingResult = validatePlanWithBusinessRules(invalidPricing, rawPrompt, intake);
  assert(!invalidPricingResult.ok, "restaurant_forbids_pricing invalid fixture should fail");
  if (!invalidPricingResult.ok) {
    assert(
      invalidPricingResult.errors.some((issue) => issue.code === "pricing_guardrail"),
      "restaurant_forbids_pricing invalid fixture missing pricing_guardrail"
    );
  }

  const invalidBanned = await loadFixture("invalid-restaurant-banned-phrase.json");
  const invalidBannedResult = validatePlanWithBusinessRules(invalidBanned, rawPrompt, intake);
  assert(!invalidBannedResult.ok, "restaurant_banned_phrase invalid fixture should fail");
  if (!invalidBannedResult.ok) {
    assert(
      invalidBannedResult.errors.some((issue) => issue.code === "banned_phrase"),
      "restaurant_banned_phrase invalid fixture missing banned_phrase error"
    );
  }

  console.log("- restaurant_forbids_pricing_and_saas_copy");
}

async function testRestaurantNavIsCorrect() {
  const { plan } = await buildRestaurantCase();
  const header = plan.sections.find((section) => section.type === "header");
  assert(Boolean(header), "restaurant_nav_is_correct missing header");
  if (!header || header.type !== "header") return;

  const labels = header.copy.links.map((link) => link.label.toLowerCase());
  ["menu", "reservations", "about", "contact"].forEach((required) => {
    assert(labels.includes(required), `restaurant_nav_is_correct missing ${required}`);
  });

  assert(!labels.includes("features"), "restaurant_nav_is_correct must not include Features");
  assert(!labels.includes("pricing"), "restaurant_nav_is_correct must not include Pricing");

  const hrefs = header.copy.links.map((link) => link.href);
  assert(hrefs.includes("/#menu"), "restaurant_nav_is_correct missing /#menu");
  assert(hrefs.includes("/#reservations"), "restaurant_nav_is_correct missing /#reservations");

  console.log("- restaurant_nav_is_correct");
}

async function testRestaurantMediaHasNonEmptySrc() {
  const { rawPrompt, intake, plan } = await buildRestaurantCase();

  const hero = plan.sections.find((section) => section.type === "hero");
  assert(Boolean(hero), "restaurant_media_has_non_empty_src missing hero");
  if (!hero || hero.type !== "hero") return;

  assert(hero.media.length > 0, "restaurant_media_has_non_empty_src hero must include media");
  assert(hero.media.every((media) => media.src.trim().length > 0), "restaurant_media_has_non_empty_src hero src empty");

  const mediaAcrossPlan = plan.sections.flatMap((section) => section.media);
  assert(
    mediaAcrossPlan.filter((media) => media.src.trim().length > 0).length >= 3,
    "restaurant_media_has_non_empty_src must include at least 3 non-empty media src values"
  );

  const invalidEmptyMedia = await loadFixture("invalid-restaurant-empty-media-src.json");
  const invalidEmptyMediaResult = validatePlanWithBusinessRules(invalidEmptyMedia, rawPrompt, intake);
  assert(!invalidEmptyMediaResult.ok, "restaurant_media_has_non_empty_src invalid fixture should fail");

  console.log("- restaurant_media_has_non_empty_src");
}

async function testDeterministicOutput() {
  const rawPrompt = "Build a website for Rikoli Restaurant with menu, gallery, reservations, and contact details.";
  const metadata = {
    businessName: "Rikoli",
    industry: "Restaurant",
    description: "Neighborhood restaurant with seasonal menu",
    tone: "warm",
    primaryColor: "#facc15",
    secondaryColor: "#ffffff",
    fontFamily: "Playfair Display",
    targetCustomer: "Local diners",
    services: ["Dinner reservations"]
  };

  const intakeA = await buildIntakeBrief(rawPrompt, metadata, null);
  const intakeB = await buildIntakeBrief(rawPrompt, metadata, null);

  const planA = await buildWebsitePlan(intakeA, rawPrompt, null);
  const planB = await buildWebsitePlan(intakeB, rawPrompt, null);

  assert(JSON.stringify(planA) === JSON.stringify(planB), "deterministic_output_same_prompt_same_plan failed");

  console.log("- deterministic_output_same_prompt_same_plan");
}

async function testClinicPlanAppliesOnboardingAndNicheRules() {
  const { rawPrompt, intake, plan } = await buildClinicCase();

  assert(intake.vertical === "clinic", "clinic vertical detection failed");
  assert(plan.meta.vertical === "clinic", "clinic plan meta.vertical failed");
  assert(plan.theme.accent === "teal", "clinic onboarding accent not applied");
  assert(plan.theme.font !== "mono", "clinic font must not be mono");

  const hero = plan.sections.find((section) => section.type === "hero");
  assert(Boolean(hero), "clinic plan missing hero");
  if (hero && hero.type === "hero") {
    assert(hero.media.length > 0, "clinic hero missing media");
    assert(hero.media.every((item) => item.src.trim().length > 0), "clinic hero media src empty");
  }

  assert(!plan.sections.some((section) => section.type === "pricing"), "clinic should not include pricing by default");

  const header = plan.sections.find((section) => section.type === "header");
  assert(Boolean(header), "clinic plan missing header");
  if (header && header.type === "header") {
    const labels = header.copy.links.map((link) => link.label.toLowerCase());
    ["services", "about", "testimonials", "contact"].forEach((required) => {
      assert(labels.includes(required), `clinic header missing ${required}`);
    });
  }

  const validation = validatePlanWithBusinessRules(plan, rawPrompt, intake);
  assert(validation.ok, "clinic plan should pass business rules");

  console.log("- clinic_plan_applies_onboarding_and_niche_rules");
}

async function testEcommercePlanUsesBusinessCopyAndMedia() {
  const { rawPrompt, intake, plan } = await buildEcommerceCase();

  assert(intake.vertical === "ecommerce", "ecommerce vertical detection failed");
  assert(plan.meta.vertical === "ecommerce", "ecommerce plan meta.vertical failed");
  assert(plan.theme.accent === "orange", "ecommerce onboarding accent not applied");
  assert(plan.theme.font === "sans", "ecommerce font should default to sans when onboarding is sans");

  const header = plan.sections.find((section) => section.type === "header");
  assert(Boolean(header), "ecommerce plan missing header");
  if (header && header.type === "header") {
    const labels = header.copy.links.map((link) => link.label.toLowerCase());
    assert(labels.includes("shop"), "ecommerce nav missing shop");
    assert(!labels.includes("features"), "ecommerce nav should not include features");
    assert(!labels.includes("pricing"), "ecommerce nav should not include pricing");
  }

  assert(plan.cta.primary.label === "Shop Now", "ecommerce primary CTA should be Shop Now");
  assert(plan.cta.secondary.label === "View Products", "ecommerce secondary CTA should be View Products");
  assert(!plan.sections.some((section) => section.type === "pricing"), "ecommerce should not include pricing by default");

  const hero = plan.sections.find((section) => section.type === "hero");
  assert(Boolean(hero), "ecommerce plan missing hero");
  if (hero && hero.type === "hero") {
    assert(hero.media.length > 0, "ecommerce hero missing media");
    assert(hero.media.every((item) => item.src.trim().length > 0), "ecommerce hero media src empty");
  }

  const validation = validatePlanWithBusinessRules(plan, rawPrompt, intake);
  assert(validation.ok, "ecommerce plan should pass business rules");

  console.log("- ecommerce_plan_uses_business_copy_and_media");
}

async function testLogoIsCarriedIntoPlanAndRender() {
  const rawPrompt = "Build a website for Lumina Studio portfolio with work samples and contact.";
  const logoUrl = "https://example.com/lumina-logo.png";
  const metadata = {
    businessName: "Lumina Studio",
    category: "Portfolio",
    industry: "Portfolio",
    description: "Design studio portfolio",
    tone: "premium",
    primaryColor: "#4f46e5",
    secondaryColor: "#eef2ff",
    fontFamily: "Playfair Display",
    logoUrl,
    targetCustomer: "Brand teams",
    services: ["Brand design"]
  };

  const intake = await buildIntakeBrief(rawPrompt, metadata as any, null);
  const plan = await buildWebsitePlan(intake, rawPrompt, null);
  const render = renderWebsitePlan(plan);

  assert(intake.logoUrl === logoUrl, "intake logoUrl not preserved");
  assert(plan.meta.logoUrl === logoUrl, "plan meta.logoUrl not preserved");
  const header = plan.sections.find((section) => section.type === "header");
  assert(Boolean(header), "logo test missing header");
  if (header && header.type === "header") {
    assert(header.media.some((media) => media.role === "logo" && media.src === logoUrl), "header logo media missing");
  }
  assert(render.siteDocument.siteBrief?.logoUrl === logoUrl, "rendered siteBrief.logoUrl missing");

  console.log("- logo_is_carried_into_plan_and_render");
}

async function testBarbershopPlanUsesStructuredBrief() {
  const { rawPrompt, intake, plan, quality } = await buildBarbershopCase();

  assert(intake.vertical === "barbershop", "barbershop vertical detection failed");
  assert(intake.language === "en", "barbershop language should persist");
  assert(plan.meta.vertical === "barbershop", "barbershop plan meta.vertical failed");
  assert(plan.meta.locale === "en-GB", "barbershop locale should follow language");
  assert(plan.theme.accent === "orange", "barbershop accent should map to orange");
  assert(plan.cta.primary.label === "Book Appointment", "barbershop primary CTA should match brief");
  assert(plan.sections.some((section) => section.type === "faq"), "barbershop should include faq");

  const strings = collectStrings(plan).map((value) => value.toLowerCase());
  ["skin fades", "beard trims", "hot towel shaves"].forEach((service) => {
    assert(strings.some((value) => value.includes(service)), `barbershop output missing service '${service}'`);
  });

  assert(quality.passed, `barbershop quality should pass: ${quality.issues.map((issue) => issue.code).join(", ")}`);
  assert(
    GENERIC_QUALITY_PHRASES.every((phrase) => !quality.genericPhraseHits.includes(phrase)),
    "barbershop quality should not contain generic fallback phrases"
  );

  const validation = validatePlanWithBusinessRules(plan, rawPrompt, intake);
  assert(validation.ok, "barbershop plan should pass business rules");

  console.log("- barbershop_plan_uses_structured_brief");
}

async function testRenderAndChecks() {
  const { plan } = await buildRestaurantCase();
  const rendered = renderWebsitePlan(plan);
  const pageFile = rendered.files.find((file) => file.path === "app/page.tsx");

  assert(Boolean(pageFile), "render_generated_output_contains_app_page failed");
  assert(rendered.h1Count === 1, "render_has_single_h1 failed");
  assert(pageFile?.content.includes("<header"), "render missing header section markup");
  assert(pageFile?.content.includes("<footer"), "render missing footer section markup");

  const checkResult = runPipelineChecks({
    cwd: process.cwd(),
    plan,
    rendered,
    runCommandChecks: false
  });
  assert(checkResult.ok, `render_smoke_no_runtime_error failed: ${checkResult.errors.join(" | ")}`);

  console.log("- render_generated_output_contains_expected_sections");
  console.log("- render_has_single_h1");
  console.log("- render_smoke_no_runtime_error");
}

function testRetryCaps() {
  let state = createRetryState();
  assert(canRetryStage(state, "stage1_plan"), "retry stage should be allowed initially");

  state = registerRetry(state, "stage1_plan");
  state = registerRetry(state, "stage1_plan");
  assert(!canRetryStage(state, "stage1_plan"), "retry stage cap should stop at 2");

  state = registerRetry(state, "stage3_render");
  state = registerRetry(state, "stage4_clamp");
  assert(!canRetryStage(state, "stage6_checks"), "retry total cap should stop at 4");

  console.log("- retry_caps_enforced");
}

async function testEndToEndPipeline() {
  const result = await runV0LikeGenerationPipeline({
    rawPrompt:
      "Build a website for Rikoli Restaurant with header, hero, menu highlights, gallery, hours, testimonials, reservation cta, and footer.",
    metadata: {
      businessName: "Rikoli",
      industry: "Restaurant",
      description: "Neighborhood restaurant with seasonal menu",
      tone: "warm",
      primaryColor: "#facc15",
      secondaryColor: "#ffffff",
      fontFamily: "Playfair Display",
      targetCustomer: "Local diners",
      services: ["Dinner reservations"],
      includePricing: false,
      language: "sq",
      brief: {
        audience: "Families and couples booking dinner in Prishtina",
        coreOffer: "Seasonal dining with easy table reservations",
        primaryCtaGoal: "reserve_table",
        topServices: ["Dinner reservations", "Private dining", "Chef specials"],
        proofPoints: ["Central location", "Fresh seasonal menu", "Fast confirmation"],
        tone: "warm"
      }
    },
    openai: null,
    runCommandChecks: false,
    qualityMode: "balanced"
  });

  assert(result.ok, `pipeline_end_to_end failed: ${result.ok ? "" : result.error.stage}`);
  if (result.ok) {
    const typedPlan = result.plan as { meta?: { vertical?: string } };
    assert(typedPlan.meta?.vertical === "restaurant", "pipeline_end_to_end expected restaurant vertical");
    assert(result.rendered.files.length > 0, "pipeline_end_to_end missing files");
    assert(result.checks.ok, "pipeline_end_to_end checks failed");
    assert(result.quality.passed, "pipeline_end_to_end quality should pass");
    assert(result.intake.language === "sq", "pipeline_end_to_end should preserve language");
  }

  console.log("- pipeline_end_to_end");
}

async function main() {
  console.log("Running v0-like generation tests...");
  await testSchemaValidation();
  await testRestaurantPlanEnforcesVerticalGoalTheme();
  await testRestaurantForbidsPricingAndSaasCopy();
  await testRestaurantNavIsCorrect();
  await testRestaurantMediaHasNonEmptySrc();
  await testDeterministicOutput();
  await testClinicPlanAppliesOnboardingAndNicheRules();
  await testEcommercePlanUsesBusinessCopyAndMedia();
  await testLogoIsCarriedIntoPlanAndRender();
  await testBarbershopPlanUsesStructuredBrief();
  await testRenderAndChecks();
  testRetryCaps();
  await testEndToEndPipeline();
  console.log("v0-like generation tests passed.");
}

main().catch((error) => {
  console.error("v0-like generation tests failed.");
  console.error(error);
  process.exit(1);
});
