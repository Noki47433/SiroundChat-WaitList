import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildGenerationContract,
  getPersistedTemplateIdForRail,
  parseAndValidateGeneratedJson,
  validateDeterministicPayload,
  validateLayoutTokens
} from "@/lib/deterministic-templates";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const fixturePath = (name: string) =>
  path.join(process.cwd(), "tests", "fixtures", "generation", "deterministic", name);

const loadJson = async (name: string) => {
  const raw = await readFile(fixturePath(name), "utf8");
  return JSON.parse(raw);
};

async function testTemplateResolution() {
  const restaurant = buildGenerationContract("restaurant");
  const dental = buildGenerationContract("dental clinic");
  const realEstate = buildGenerationContract("real estate");
  const barber = buildGenerationContract("barbershop");

  assert(restaurant.template === "restaurant", "template_resolution_restaurant failed");
  assert(dental.template === "dental", "template_resolution_dental failed");
  assert(realEstate.template === "real_estate", "template_resolution_real_estate failed");
  assert(barber.template === "service" && barber.serviceNiche === "barbershop", "template_resolution_service failed");

  console.log("- template_resolution");
}

async function testRestaurantValidation() {
  const valid = await loadJson("valid-restaurant.json");
  const invalid = await loadJson("invalid-restaurant-cta.json");

  const validResult = validateDeterministicPayload("restaurant", valid);
  assert(validResult.ok, "restaurant_valid_fixture should pass");

  const invalidResult = validateDeterministicPayload("restaurant", invalid);
  assert(!invalidResult.ok, "restaurant_invalid_cta should fail");
  if (!invalidResult.ok) {
    assert(
      invalidResult.errors.some((error) => error.code === "restaurant_primary_cta_invariant"),
      "restaurant_invalid_cta missing invariant error"
    );
  }

  console.log("- restaurant_validation");
}

async function testServiceValidation() {
  const valid = await loadJson("valid-service.json");
  const invalid = await loadJson("invalid-service-gallery-ratio.json");

  const validResult = validateDeterministicPayload("service", valid);
  assert(validResult.ok, "service_valid_fixture should pass");

  const invalidResult = validateDeterministicPayload("service", invalid);
  assert(!invalidResult.ok, "service_invalid_ratio should fail");
  if (!invalidResult.ok) {
    assert(
      invalidResult.errors.some((error) => error.path.includes("gallery.items") || error.code === "schema"),
      "service_invalid_ratio missing schema error"
    );
  }

  console.log("- service_validation");
}

async function testRealEstateValidation() {
  const valid = await loadJson("valid-real-estate.json");
  const validResult = validateDeterministicPayload("real_estate", valid);
  assert(validResult.ok, "real_estate_valid_fixture should pass");
  console.log("- real_estate_validation");
}

async function testParseAndValidateJson() {
  const validRaw = await readFile(fixturePath("valid-restaurant.json"), "utf8");
  const valid = parseAndValidateGeneratedJson("restaurant", validRaw);
  assert(valid.ok, "parse_valid_json should pass");

  const invalid = parseAndValidateGeneratedJson("restaurant", "{ broken");
  assert(!invalid.ok, "parse_invalid_json should fail");

  console.log("- parse_and_validate_json");
}

async function testLayoutGuardrail() {
  const good = validateLayoutTokens(["py-10", "py-16", "gap-4", "max-w-6xl"]);
  const bad = validateLayoutTokens(["py-14", "max-w-7xl"]);

  assert(good.ok, "layout_guardrail_valid_tokens should pass");
  assert(!bad.ok && bad.invalid.length === 2, "layout_guardrail_invalid_tokens should fail");

  console.log("- layout_guardrail");
}

async function testRejectsNonRailTemplateId() {
  const valid = await loadJson("valid-restaurant.json");
  const invalid = {
    ...valid,
    template: "restaurant-editorial"
  };

  const result = validateDeterministicPayload("restaurant", invalid);
  assert(!result.ok, "reject_non_rail_template should fail");
  if (!result.ok) {
    assert(
      result.errors.some((error) => error.code === "schema" && error.path === "template"),
      "reject_non_rail_template missing template schema error"
    );
  }

  console.log("- rejects_non_rail_template_id");
}

async function testPersistedTemplateIdMatchesRail() {
  const rails = ["restaurant", "dental", "service", "real_estate"] as const;
  for (const rail of rails) {
    assert(
      getPersistedTemplateIdForRail(rail) === rail,
      `persisted_template_id_mismatch for rail ${rail}`
    );
  }

  console.log("- persisted_template_id_matches_rail");
}

async function run() {
  await testTemplateResolution();
  await testRestaurantValidation();
  await testServiceValidation();
  await testRealEstateValidation();
  await testParseAndValidateJson();
  await testLayoutGuardrail();
  await testRejectsNonRailTemplateId();
  await testPersistedTemplateIdMatchesRail();
  console.log("deterministic template tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
