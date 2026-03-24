import { spawnSync } from "node:child_process";
import type { WebsitePlan } from "@/src/generation/v0_like/schema";
import type { PipelineChecksResult, RenderOutput } from "@/src/generation/v0_like/types";

const buildPreviewMarkup = (plan: WebsitePlan) => {
  const hero = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "hero" }> =>
      section.type === "hero"
  );

  return [
    `<main role=\"main\">`,
    `<header><nav>${plan.meta.brandName}</nav></header>`,
    hero ? `<section><h1>${hero.copy.headline}</h1><p>${hero.copy.subheadline}</p></section>` : "",
    `<footer>${plan.meta.brandName}</footer>`,
    `</main>`
  ].join("");
};

const runCommand = (cwd: string, command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env
  });

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status === 0) {
    return { ok: true as const, output };
  }

  return {
    ok: false as const,
    output,
    error: `Command failed: ${command} ${args.join(" ")}`
  };
};

export function runPipelineChecks(options: {
  cwd: string;
  plan: WebsitePlan;
  rendered: RenderOutput;
  runCommandChecks: boolean;
}): PipelineChecksResult {
  const errors: string[] = [];

  try {
    const html = buildPreviewMarkup(options.plan);
    const h1Count = (html.match(/<h1/g) ?? []).length;
    if (h1Count !== 1) {
      errors.push(`Render smoke failed: expected exactly 1 <h1>, found ${h1Count}.`);
    }
  } catch (error: any) {
    errors.push(`Render smoke failed: ${error?.message ?? "Unknown render failure"}`);
  }

  if (options.rendered.h1Count !== 1) {
    errors.push(`Rendered files failed H1 guardrail: expected 1, found ${options.rendered.h1Count}.`);
  }

  if (!options.rendered.files.length) {
    errors.push("Rendered output missing generated files.");
  }

  if (options.runCommandChecks) {
    const commands: Array<{ command: string; args: string[]; label: string }> = [
      { command: "npm", args: ["run", "lint"], label: "lint" },
      { command: "npx", args: ["tsc", "--noEmit"], label: "typecheck" },
      { command: "npm", args: ["run", "build"], label: "build" }
    ];

    for (const entry of commands) {
      const result = runCommand(options.cwd, entry.command, entry.args);
      if (!result.ok) {
        const lastLines = result.output.split("\n").slice(-20).join("\n");
        errors.push(`${entry.label} failed: ${result.error}\n${lastLines}`.trim());
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
