import assert from "node:assert/strict";
import { scoreLeadQualification } from "@/lib/chatbot/lead-scoring";
import { evaluateUpsells, type UpsellCatalogRow } from "@/lib/chatbot/upsell-evaluator";
import { evaluateBehaviorCondition } from "@/lib/chatbot/behavior-offers";

const tests: Array<{ name: string; run: () => void }> = [];

const test = (name: string, run: () => void) => {
  tests.push({ name, run });
};

test("lead scoring marks hot lead when all high-intent signals are present", () => {
  const result = scoreLeadQualification({
    budgetRange: "high budget",
    urgency: "today",
    decisionMaker: true,
    hasContactInfo: true
  });

  assert.equal(result.score, 90);
  assert.equal(result.status, "hot");
});

test("lead scoring marks warm lead for partial intent", () => {
  const result = scoreLeadQualification({
    budgetRange: "medium",
    urgency: "this week",
    decisionMaker: false,
    hasContactInfo: true
  });

  assert.equal(result.score, 40);
  assert.equal(result.status, "warm");
});

test("upsell evaluator matches reservation_size rule", () => {
  const catalog: UpsellCatalogRow[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Group platter",
      description: "Best for larger groups",
      trigger_type: "reservation_size",
      trigger_rules: { min_size: 4 },
      offer_payload: { title: "Add platter", cta: "Add now", price: "€18" },
      priority: 10
    }
  ];

  const match = evaluateUpsells(catalog, {
    reservationSize: 5,
    reservationTime: "19:30",
    message: "We are coming as a group"
  });

  assert.ok(match);
  assert.equal(match?.action.offerId, catalog[0].id);
  assert.equal(match?.action.title, "Add platter");
});

test("behavior rule evaluator triggers inactive_days at 30-day threshold", () => {
  const now = new Date("2026-02-17T12:00:00.000Z");
  const lastReservationAt = new Date("2026-01-10T12:00:00.000Z");

  const result = evaluateBehaviorCondition({ type: "inactive_days", days: 30 }, { now, lastReservationAt });

  assert.equal(result.triggered, true);
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
