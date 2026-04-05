import assert from "node:assert/strict";
import {
  SIROUNDCHAT_DEMO_GREETING,
  SIROUNDCHAT_DEMO_ICON_ID,
  SIROUNDCHAT_DEMO_THEME,
  getSiroundChatDemoWidgetOverrides
} from "@/lib/chatbot/siroundchat-demo";

const tests: Array<{ name: string; run: () => void }> = [];

const test = (name: string, run: () => void) => {
  tests.push({ name, run });
};

test("demo widget overrides pin the branded SiroundChat theme", () => {
  const overrides = getSiroundChatDemoWidgetOverrides(null);

  assert.equal(overrides.greeting, SIROUNDCHAT_DEMO_GREETING);
  assert.equal(overrides.iconId, SIROUNDCHAT_DEMO_ICON_ID);
  assert.deepEqual(overrides.theme, SIROUNDCHAT_DEMO_THEME);
});

test("demo widget overrides preserve an existing icon choice", () => {
  const overrides = getSiroundChatDemoWidgetOverrides("custom-9");

  assert.equal(overrides.iconId, "custom-9");
  assert.equal(overrides.theme?.primary, "#F59E0B");
  assert.equal(overrides.theme?.background, "#0D1329");
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
