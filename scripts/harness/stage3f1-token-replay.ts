/**
 * Stage 3F.1 — the two failures the rerun actually found, replayed.
 *   npx tsx scripts/harness/stage3f1-token-replay.ts
 *
 * The rerun's hard failures are not spread across the vocabulary. They collect
 * on two prompts:
 *
 *   "Make the headings a little larger"  → a version is written and
 *                                          typography.headingScale is still `larger`
 *   "Put the menu at the top of the page" → a version is written and
 *                                          chrome.navPosition is `edge`
 *
 * Both look like the model picking a wrong value. They are the same defect the
 * navigation had, in two more places: `describeSpecForEditing` lists the
 * SECTIONS in detail and then describes the design in one sentence that names
 * density, photography, nav shape and two colours — and nothing else. The
 * heading scale is not in it. Neither is navPosition. So a model told "the size
 * ladder is smaller | default | larger | largest" is asked which rung to move to
 * without being told which rung it is standing on, and "put the menu at the top"
 * is answered by a model that cannot see the menu is already there.
 *
 * This prints what the model is actually told, so the claim can be checked
 * rather than believed.
 */
import { describeSpecForEditing } from "@/lib/site-spec/ai/edit";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";
import type { SiteSpec } from "@/lib/site-spec/schema";

const fixture = (): SiteSpec => {
  const spec = JSON.parse(JSON.stringify(FADE_SPEC));
  // The shape every cohort business was in at its Phase D baseline.
  spec.design.typography.headingScale = "larger";
  spec.design.chrome.navPosition = "center";
  return spec;
};

const main = () => {
  const spec = fixture();
  const described = describeSpecForEditing(spec, []);

  console.log("── what the spec actually holds ──");
  console.log(`  typography.headingScale : ${spec.design.typography.headingScale}`);
  console.log(`  typography.bodyScale    : ${(spec.design.typography as any).bodyScale ?? "(unset)"}`);
  console.log(`  chrome.navPosition      : ${spec.design.chrome.navPosition}`);
  console.log(`  geometry.radius         : ${(spec.design as any).geometry?.radius ?? "(unset)"}`);
  console.log(`  typography.display      : ${spec.design.typography.display}`);

  console.log("\n── what the model is told about the design ──");
  for (const line of described.split("\n")) {
    if (/^style:|^brand:|^the word for/.test(line)) console.log(`  ${line}`);
  }

  console.log("\n── is each writable token mentioned anywhere in the description? ──");
  const tokens = [
    ["typography.headingScale", String(spec.design.typography.headingScale)],
    ["typography.bodyScale", String((spec.design.typography as any).bodyScale ?? "")],
    ["chrome.navPosition", String(spec.design.chrome.navPosition)],
    ["typography.display", String(spec.design.typography.display)],
    ["geometry.radius", String((spec.design as any).geometry?.radius ?? "")]
  ] as const;
  for (const [path, value] of tokens) {
    const named = described.includes(path.split(".").pop()!);
    const valueShown = Boolean(value) && new RegExp(`\\b${value}\\b`).test(described);
    console.log(
      `  ${path.padEnd(24)} current="${value || "(unset)"}"  name in description: ${named ? "yes" : "NO "}  value in description: ${valueShown ? "yes" : "NO"}`
    );
  }

  console.log(
    "\n  A model that cannot see the current rung cannot step up from it, and a model" +
      "\n  that cannot see the menu is already centred cannot know the request is already met."
  );
};

main();
