/**
 * Responsive regression harness for the Site Spec renderer.
 *
 *   npm run verify:site-spec
 *
 * Renders the four approved fixtures through the REAL production renderer and
 * inlines the REAL stylesheet, so what opens in a browser is what a published
 * site is. The only difference from production is that CSS-module class names
 * are their identity mapping rather than build hashes — the rules are the same
 * file, byte for byte.
 *
 * Writes one page per fixture plus an index into the evidence directory.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";

import { SiteSpecRenderer } from "@/components/site-spec/SiteSpecRenderer";
import { resolveSite } from "@/lib/site-spec/resolve";
import { validateSiteSpec } from "@/lib/site-spec/schema";
import { FIXTURES } from "@/tests/fixtures/site-spec";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

const OUT_DIR = join(process.cwd(), "audit-output/phase-3/evidence/site-spec-stage1");
const CSS = readFileSync(join(process.cwd(), "components/site-spec/site-spec.module.css"), "utf8");

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  /* The page frame only. Everything below this block is the production
     stylesheet, unmodified. */
  html,body{margin:0;padding:0}
  body{background:#fff}
</style>
<style>
${CSS}
</style>
</head><body>
${body}
</body></html>
`;

mkdirSync(OUT_DIR, { recursive: true });

const written: string[] = [];

for (const fixture of FIXTURES) {
  const validated = validateSiteSpec(fixture.spec);
  if (!validated.ok) {
    console.error(`INVALID ${fixture.key}:`, validated.issues);
    process.exit(1);
  }

  const site = resolveSite({ spec: validated.spec, business: fixture.business, assets: [] });
  const markup = renderToStaticMarkup(
    createElement(SiteSpecRenderer, { site, slug: fixture.key })
  );

  const file = join(OUT_DIR, `${fixture.key}.html`);
  writeFileSync(file, page(fixture.label, markup), "utf8");
  written.push(`${fixture.key}.html`);
  console.log(
    `wrote ${fixture.key}.html  ${fixture.label}  ` +
      `${validated.spec.sections.length} sections · ${validated.spec.design.art.treatment} · ` +
      `footer:${validated.spec.footer.presentation}`
  );
}

writeFileSync(
  join(OUT_DIR, "index.html"),
  page(
    "Site Spec renderer — Stage 1 fixtures",
    `<div style="font:14px/1.6 -apple-system,sans-serif;padding:40px;max-width:640px">
      <h1 style="font-size:22px">Site Spec renderer — Stage 1 fixtures</h1>
      <p>Four businesses, one renderer, no industry branch. Rendered by the production
      renderer with the production stylesheet.</p>
      <ul>${written.map((f) => `<li><a href="./${f}">${f}</a></li>`).join("")}</ul>
    </div>`
  ),
  "utf8"
);

console.log(`\n${written.length} fixtures written to ${OUT_DIR}`);
