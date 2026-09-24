/**
 * Stage 3G.3 · Phase C — are the five mechanisms the ones production serves?
 *   BASE_URL=https://siroundchat.com npx tsx scripts/harness/stage3g3-smoke.ts
 *
 * Six requests, every one from a SPENT suite, so held-out suite #5 stays unseen:
 *   · "side by side" must move the LAYOUT, not the presentation (suite #3 · C)
 *   · a bolder heading weight must reach a control that used to be invisible (#3 · A)
 *   · the portfolio look must survive a captioned gallery (#3 · B)
 *   · and the menu no-op must still be a truthful no-op that writes nothing
 * Draft-only, and the draft is put back whatever happens.
 */
import { COHORT, admin, sessionFor } from "./stage3f1-cohort";
import { semanticFingerprint } from "@/lib/site-spec/semantic-fingerprint";

const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const db = admin();

const main = async () => {
  const entry = COHORT.find((c) => c.n === 2)!;
  const cookie = await sessionFor(entry);

  const state = async () => {
    const { data: site } = await db.from("builder_sites").select("draft_version_id").eq("id", entry.siteId).single();
    const { data: version } = await db.from("builder_site_versions").select("spec").eq("id", site!.draft_version_id!).single();
    const { count } = await db.from("builder_site_versions").select("id", { count: "exact", head: true }).eq("site_id", entry.siteId);
    return { id: site!.draft_version_id as string, spec: version?.spec as any, count: count ?? 0 };
  };

  const edit = async (message: string, read: (spec: any) => string) => {
    const before = await state();
    const started = Date.now();
    const response = await fetch(`${BASE}/api/site-spec/edit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ siteId: entry.siteId, baseVersionId: before.id, requestId: `s3g3-smoke-${Date.now()}`, message })
    });
    const body: any = await response.json();
    const after = await state();
    console.log(`  "${message}"  (${Date.now() - started}ms)`);
    console.log(`     HTTP ${response.status} · changed=${body.changed} · versions ${before.count} → ${after.count} · ${read(before.spec)} → ${read(after.spec)}`);
    console.log(`     reply: ${body.reply}`);
    console.log(
      `     diagnostics: repairAttempted=${body.diagnostics?.repairAttempted} repaired=${body.diagnostics?.repaired}` +
      ` noOp=${body.diagnostics?.noOp} expectations=${body.diagnostics?.expectationsStated}/${body.diagnostics?.expectationsFailed} failed`
    );
    return { body, before, after };
  };

  const services = (spec: any) => `services layout=${spec?.sections?.find((s: any) => s.id === "services" || s.type === "services")?.layout}`;
  const weight = (spec: any) => `displayWeight=${spec?.design?.typography?.displayWeight}`;
  const gallery = (spec: any) => {
    const section = spec?.sections?.find((s: any) => s.type === "gallery");
    return section ? `gallery ${section.presentation} items=${section.items?.length} captions=${section.captions?.length}` : "no gallery";
  };
  const menu = (spec: any) => `nav=${JSON.stringify(spec?.nav?.items)}`;

  const layoutBefore = (await state()).spec;
  const sideBySide = await edit("Put the services section side by side", services);
  const bolder = await edit("Make the headings sit in a bolder weight", weight);
  const portfolio = await edit("Give the gallery the portfolio look", gallery);
  const noop = await edit("Keep the menu pinned at the top of the page", menu);
  const footerNote = (spec: any) => `footer note = ${JSON.stringify(spec?.footer?.note ?? null)}`;
  const footer = await edit("Add a short line of text in the footer", footerNote);
  const refused = await edit("Show our email as hello@example.com", (spec: any) => `hero body ${String(spec?.sections?.find((s: any) => s.type === "hero")?.body ?? "").length} chars`);

  await fetch(`${BASE}/api/site-spec/undo`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ siteId: entry.siteId, versionId: entry.baselineVersionId })
  });
  const restored = await state();
  const { data: baseline } = await db.from("builder_site_versions").select("spec").eq("id", entry.baselineVersionId).single();
  const back = semanticFingerprint(restored.spec) === semanticFingerprint(baseline?.spec);

  const layoutWas = layoutBefore?.sections?.find((s: any) => s.type === "services")?.layout;
  const layoutNow = sideBySide.after.spec?.sections?.find((s: any) => s.type === "services")?.layout;
  const weightWas = Number(bolder.before.spec?.design?.typography?.displayWeight);
  const weightNow = Number(bolder.after.spec?.design?.typography?.displayWeight);
  const gallerySection = portfolio.after.spec?.sections?.find((s: any) => s.type === "gallery");
  const galleryOk = !gallerySection || gallerySection.presentation === "portfolio";

  const footerNoteBefore = footer.before.spec?.footer?.note ?? null;
  const footerNoteAfter = footer.after.spec?.footer?.note ?? null;
  const checks = [
    ["side by side reached the layout", layoutWas === "split" ? layoutNow === "split" : layoutNow === "split"],
    ["the heading weight moved up", weightNow > weightWas],
    ["the gallery took the portfolio look", galleryOk],
    ["the no-op wrote nothing", noop.body.changed === false && noop.body.diagnostics?.noOp === true && noop.before.count === noop.after.count],
    ["the footer note itself changed", Boolean(String(footerNoteAfter ?? "").trim()) && footerNoteAfter !== footerNoteBefore],
    ["an email address is refused", refused.body.changed === false && refused.before.count === refused.after.count],
    ["the draft is back at baseline", back]
  ] as const;

  for (const [label, held] of checks) console.log(`  ${held ? "✓" : "✗"} ${label}`);
  const ok = checks.every(([, held]) => held);
  console.log(ok ? "  SMOKE PASS — the Stage 3G.3 mechanisms are live" : "  SMOKE FAIL");
  if (!ok) process.exit(1);
};

if (process.argv[1]?.includes("stage3g3-smoke")) void main();
