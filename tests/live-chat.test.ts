import assert from "node:assert/strict";
import { resolveLiveChat } from "@/lib/website-builder/live-chat";

const tests: Array<{ name: string; run: () => void }> = [];

const test = (name: string, run: () => void) => {
  tests.push({ name, run });
};

test("resolveLiveChat rewrites relative widget loader URLs to the current widget key", () => {
  const result = resolveLiveChat(
    {
      apps: [
        {
          id: "live-chat",
          name: "Live Chat",
          enabled: true,
          config: {
            src: "/api/widget/loader?key=old-widget-key"
          }
        }
      ]
    } as any,
    { widgetKey: "new-widget-key" }
  );

  assert.equal(result.scriptSrc, "/api/widget/loader?key=new-widget-key");
  assert.equal(result.document.apps?.[0]?.config?.src, "/api/widget/loader?key=new-widget-key");
});

test("resolveLiveChat rewrites absolute widget loader URLs to the current widget key", () => {
  const result = resolveLiveChat(
    {
      apps: [
        {
          id: "live-chat",
          name: "Live Chat",
          enabled: true,
          config: {
            src: "https://siroundchat.com/api/widget/loader?key=old-widget-key"
          }
        }
      ]
    } as any,
    { widgetKey: "new-widget-key" }
  );

  assert.equal(result.scriptSrc, "https://siroundchat.com/api/widget/loader?key=new-widget-key");
  assert.equal(result.document.apps?.[0]?.config?.src, "https://siroundchat.com/api/widget/loader?key=new-widget-key");
});

test("resolveLiveChat preserves non-widget external scripts", () => {
  const result = resolveLiveChat(
    {
      apps: [
        {
          id: "live-chat",
          name: "Live Chat",
          enabled: true,
          config: {
            src: "https://example.com/chat.js"
          }
        }
      ]
    } as any,
    { widgetKey: "new-widget-key" }
  );

  assert.equal(result.scriptSrc, "https://example.com/chat.js");
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
