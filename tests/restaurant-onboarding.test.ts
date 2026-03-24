import assert from "node:assert/strict";
import {
  createDefaultRestaurantOnboardingData,
  generateRestaurantStarterKnowledge,
  validateRestaurantOnboardingCompletion
} from "@/lib/onboarding/restaurant";

const tests: Array<{ name: string; run: () => void }> = [];

const test = (name: string, run: () => void) => {
  tests.push({ name, run });
};

const buildValidDraft = () => {
  const draft = createDefaultRestaurantOnboardingData();
  draft.language = "en";
  draft.restaurantName = "MARCOS ITALIANO";
  draft.shortDescription = "Warm Italian restaurant with wood-fired pizza and fresh pasta.";
  draft.cuisineType = "Italian";
  draft.address = "Rr. Example 12";
  draft.city = "Prishtinë";
  draft.phone = "+383 44 123 456";
  draft.hours.monday = { closed: false, open: "09:00", close: "23:00", note: "" };
  draft.hours.tuesday = { closed: false, open: "09:00", close: "23:00", note: "" };
  draft.hours.wednesday = { closed: false, open: "09:00", close: "23:00", note: "" };
  draft.hours.thursday = { closed: false, open: "09:00", close: "23:00", note: "" };
  draft.hours.friday = { closed: false, open: "09:00", close: "23:30", note: "" };
  draft.hours.saturday = { closed: false, open: "10:00", close: "23:30", note: "" };
  draft.hours.sunday = { closed: true, open: "", close: "", note: "" };
  draft.reservationSettings.acceptsReservations = true;
  draft.reservationSettings.methods = ["phone", "chatbot", "whatsapp"];
  draft.reservationSettings.sameDay = true;
  draft.reservationSettings.maxGroupSize = "8";
  draft.reservationSettings.largeGroupConfirmationRequired = true;
  draft.reservationSettings.policyNotes = "Groups above 8 should call directly.";
  draft.serviceFeatures.menuHighlights = "Wood-fired pizza\nFresh pasta\nSeafood risotto";
  draft.serviceFeatures.vegetarian = true;
  draft.serviceFeatures.vegan = false;
  draft.serviceFeatures.glutenFree = true;
  draft.serviceFeatures.takeaway = true;
  draft.serviceFeatures.delivery = false;
  draft.serviceFeatures.outdoorSeating = true;
  draft.serviceFeatures.parking = true;
  draft.serviceFeatures.kidsFriendly = true;
  draft.serviceFeatures.cardPayments = true;
  draft.serviceFeatures.cashPayments = true;
  draft.serviceFeatures.specialOfferings = "Weekend tasting menu.";
  draft.atmosphere.description = "Cozy and elegant.";
  draft.atmosphere.bestFor = ["couples", "families", "birthdays"];
  draft.additionalInfoRaw = "Terrace seating depends on weather.";
  return draft;
};

test("completion validation passes for a minimum valid restaurant onboarding draft", () => {
  const validation = validateRestaurantOnboardingCompletion(buildValidDraft());
  assert.equal(validation.generalErrors.length, 0);
});

test("completion validation blocks missing hours and menu basics", () => {
  const draft = createDefaultRestaurantOnboardingData();
  draft.language = "sq";
  draft.restaurantName = "Restoranti";
  draft.shortDescription = "Përshkrim";
  draft.cuisineType = "Italiane";
  draft.address = "Rr. Test";
  draft.city = "Prishtinë";
  draft.phone = "+383 44 111 222";
  draft.reservationSettings.acceptsReservations = false;

  const validation = validateRestaurantOnboardingCompletion(draft);
  assert.ok(validation.fieldErrors.hours);
  assert.ok(validation.fieldErrors.menuHighlights);
});

test("english starter knowledge includes structured sections and FAQ content", () => {
  const knowledge = generateRestaurantStarterKnowledge(buildValidDraft());

  assert.match(knowledge, /Restaurant Name:/);
  assert.match(knowledge, /Opening Hours:/);
  assert.match(knowledge, /Sunday: Closed/);
  assert.match(knowledge, /Additional Business Information:/);
  assert.match(knowledge, /Starter FAQ:/);
  assert.match(knowledge, /Do you take reservations\?/);
  assert.match(knowledge, /Terrace seating depends on weather\./);
});

test("albanian starter knowledge uses localized section labels and reservation wording", () => {
  const draft = buildValidDraft();
  draft.language = "sq";
  const knowledge = generateRestaurantStarterKnowledge(draft);

  assert.match(knowledge, /Emri i Restorantit:/);
  assert.match(knowledge, /Orari i Punës:/);
  assert.match(knowledge, /Rezervimet:/);
  assert.match(knowledge, /Rezervimet pranohen\./);
  assert.match(knowledge, /Informata Shtesë:/);
  assert.match(knowledge, /Pyetje të Shpeshta Fillestare:/);
});

test("starter knowledge reflects disabled reservations accurately", () => {
  const draft = buildValidDraft();
  draft.reservationSettings.acceptsReservations = false;
  draft.reservationSettings.methods = [];
  draft.reservationSettings.sameDay = null;
  draft.reservationSettings.largeGroupConfirmationRequired = null;
  const knowledge = generateRestaurantStarterKnowledge(draft);

  assert.match(knowledge, /The restaurant does not currently accept reservations\./);
});

let passed = 0;
for (const item of tests) {
  try {
    item.run();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} tests passed.`);
