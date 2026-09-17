/**
 * Stage 3F.1 · Phase C — replay the exact Stage 3F nav failure, before any fix.
 *   npx tsx scripts/harness/stage3f1-nav-replay.ts
 *
 * The Stage 3F cohort produced exactly one genuine failure: business #4 answered
 * "Add the gallery to the navigation" with "it didn't come through in a form I can
 * use". That sentence is what an owner sees when the applier refused the model's
 * operation, and it tells us nothing about which of four things went wrong:
 *
 *   1. prompt → operation mapping     (the model chose the wrong operation)
 *   2. nav target vocabulary          (it chose set_nav but named something illegal)
 *   3. section-id resolution          (it named the gallery by a label, not its id)
 *   4. applier authorisation          (the operation was right and still refused)
 *
 * This runs the real interpreter against a controlled fixture and prints the raw
 * model operation, the typed operation it maps to, and the exact stage that
 * rejects it — so the fix addresses the real cause rather than the symptom.
 */
import { interpretEdit } from "@/lib/site-spec/ai/edit";
import { applyOps } from "@/lib/site-spec/ops";
import { validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { FADE_SPEC } from "@/tests/fixtures/site-spec";

const PHRASES = [
  "Add the gallery to the navigation",
  "Put the gallery in the menu",
  "Add a link to the gallery in the nav",
  "I want the gallery in the top menu too"
];

/** The production shape: a site that HAS a gallery, as business #4 did. */
const fixture = (): SiteSpec => {
  const spec = JSON.parse(JSON.stringify(FADE_SPEC));
  const at = spec.sections.findIndex((s: any) => s.type === "services");
  spec.sections.splice(at + 1, 0, {
    id: "gallery",
    type: "gallery",
    layout: "wide",
    presentation: "mosaic",
    heading: { title: "Our Work" },
    items: Array.from({ length: 6 }, (_, i) => ({ kind: "generated", seed: i })),
    captions: [],
    framing: {}
  });
  return spec;
};

const main = async () => {
  const spec = fixture();
  const gallery = spec.sections.find((s: any) => s.type === "gallery") as any;
  const navBefore = (spec as any).nav?.items ?? [];

  console.log("── the controlled fixture ──");
  console.log(`  sections : ${spec.sections.map((s: any) => `${s.type}#${s.id}`).join("  ")}`);
  console.log(`  gallery  : ${gallery ? `#${gallery.id}` : "(none)"}`);
  console.log(`  nav.items: ${JSON.stringify(navBefore)}`);
  console.log(`  MAX_NAV_ITEMS is 4, and set_nav replaces the whole list.\n`);

  for (const phrase of PHRASES) {
    console.log(`── "${phrase}" ──`);
    const interpreted = await interpretEdit({
      message: phrase,
      spec,
      business: undefined as any,
      assets: [],
      history: []
    } as any);

    if (!interpreted.ok) {
      console.log(`  stage 1 · model    : FAILED — ${interpreted.reason}: ${String((interpreted as any).message).slice(0, 90)}`);
      continue;
    }
    const ops = (interpreted as any).ops ?? [];
    console.log(`  stage 1 · model    : ${ops.length} op(s) — ${ops.map((o: any) => o.op).join(", ") || "(none)"}`);
    for (const op of ops) {
      console.log(`             typed op: ${JSON.stringify(op)}`.slice(0, 180));
    }
    if (ops.length === 0) {
      console.log("  stage 2 · applier  : nothing to apply\n");
      continue;
    }

    const applied = applyOps(fixture(), ops);
    if (!applied.ok) {
      if (applied.reason === "unapplicable") {
        console.log(`  stage 2 · applier  : REFUSED — ${applied.message}`);
        console.log(`             on op    : ${JSON.stringify((applied as any).op)}`.slice(0, 180));
      } else {
        console.log(`  stage 3 · validator: REFUSED — ${JSON.stringify(applied.issues.slice(0, 2))}`);
      }
      console.log();
      continue;
    }
    const navAfter = (applied.spec as any).nav?.items ?? [];
    const valid = validateSiteSpec(applied.spec).ok;
    console.log(`  stage 2 · applier  : applied`);
    console.log(`  stage 3 · validator: ${valid ? "valid" : "INVALID"}`);
    console.log(`             nav.items: ${JSON.stringify(navBefore)} → ${JSON.stringify(navAfter)}`);
    const keptAll = navBefore.every((id: string) => navAfter.includes(id));
    const addedGallery = gallery && navAfter.includes(gallery.id);
    console.log(
      `             kept every existing item: ${keptAll} · gallery present: ${addedGallery}` +
        (keptAll && addedGallery ? "  ← correct" : "  ← NOT the requested outcome")
    );
    console.log();
  }
};

void main();
