import { normalizeQualityMode } from "@/lib/builder/generation-config";
import { buildIntakeBrief } from "@/src/generation/v0_like/intake";
import { buildWebsitePlan } from "@/src/generation/v0_like/plan";
import { buildQualityReport } from "@/src/generation/v0_like/quality";
import { renderWebsitePlan } from "@/src/generation/v0_like/render";
import { runPipelineChecks } from "@/src/generation/v0_like/checks";
import {
  MAX_RETRIES_PER_STAGE,
  PROMPT_STAGE_7_RETRY_FEEDBACK,
  canRetryStage,
  createFailure,
  createRetryState,
  registerRetry
} from "@/src/generation/v0_like/retry";
import {
  formatCopyStyleIssuesForRetryFeedback,
  formatIssuesForRetryFeedback,
  isCopyOnlyValidationFailure,
  validatePlanWithBusinessRules
} from "@/src/generation/v0_like/validate";
import { TOKEN_CLAMPS } from "@/src/generation/v0_like/tokens";
import type {
  PipelineStage,
  PipelineChecksResult,
  V0LikeGenerationInput,
  V0LikeGenerationResult
} from "@/src/generation/v0_like/types";

const stageAttemptCount = (retryCount: number) => retryCount + 1;

const shouldRunCommandChecks = (input: V0LikeGenerationInput) => {
  if (typeof input.runCommandChecks === "boolean") {
    return input.runCommandChecks;
  }
  return process.env.SIROUNDCHAT_V0LIKE_RUN_COMMAND_CHECKS === "1";
};

const applyClampStage = (pageContent: string) => {
  const allowedTokens = new Set<string>([
    ...TOKEN_CLAMPS.sectionPadding,
    ...TOKEN_CLAMPS.containerWidths,
    ...TOKEN_CLAMPS.typography.h1,
    ...TOKEN_CLAMPS.typography.h2,
    ...TOKEN_CLAMPS.typography.body,
    ...TOKEN_CLAMPS.gaps
  ]);

  const used = pageContent.match(
    /\b(py-12|py-16|py-20|py-24|max-w-6xl|max-w-7xl|text-4xl|text-5xl|text-6xl|text-2xl|text-3xl|text-4xl|text-base|text-lg|gap-4|gap-6|gap-8|gap-10|gap-12)\b/g
  ) ?? [];

  const invalid = used.filter((token) => !allowedTokens.has(token));
  if (invalid.length > 0) {
    throw new Error(`Token clamp violation: ${Array.from(new Set(invalid)).join(", ")}`);
  }
};

const failingStage = (
  stage: PipelineStage,
  retriesForStage: number,
  errors: string[],
  lastOutputSnippet?: string
): V0LikeGenerationResult => {
  return {
    ok: false,
    error: createFailure(stage, stageAttemptCount(retriesForStage), errors, lastOutputSnippet)
  };
};

export async function runV0LikeGenerationPipeline(input: V0LikeGenerationInput): Promise<V0LikeGenerationResult> {
  let retryState = createRetryState();
  const rawPrompt = input.rawPrompt.trim();
  const qualityMode = normalizeQualityMode(input.qualityMode);

  let intake = null as Awaited<ReturnType<typeof buildIntakeBrief>> | null;
  while (!intake) {
    try {
      intake = await buildIntakeBrief(rawPrompt, input.metadata, input.openai);
    } catch (error: any) {
      const stage: PipelineStage = "stage0_intake";
      const message = error?.message ?? "Stage 0 intake failed";
      if (!canRetryStage(retryState, stage)) {
        return failingStage(stage, retryState.stageRetries[stage], [message]);
      }
      retryState = registerRetry(retryState, stage);
    }
  }

  let planFeedback: string[] = [];
  let plan = null as Awaited<ReturnType<typeof buildWebsitePlan>> | null;

  while (!plan) {
    try {
      const feedback = planFeedback.length ? [PROMPT_STAGE_7_RETRY_FEEDBACK, ...planFeedback] : [];
      const candidate = await buildWebsitePlan(intake, rawPrompt, input.openai, feedback, {
        qualityMode,
        candidateIndex: 0
      });
      const validation = validatePlanWithBusinessRules(candidate, rawPrompt, intake);
      if (!validation.ok) {
        const retryMessages = formatIssuesForRetryFeedback(validation.errors);
        const stage: PipelineStage = "stage1_plan";
        const copyOnly = isCopyOnlyValidationFailure(validation.errors);

        if (!copyOnly) {
          return failingStage(
            "stage2_validate",
            retryState.stageRetries[stage],
            retryMessages,
            JSON.stringify(candidate).slice(0, 600)
          );
        }

        if (!canRetryStage(retryState, stage)) {
          return failingStage(
            "stage2_validate",
            retryState.stageRetries[stage],
            retryMessages,
            JSON.stringify(candidate).slice(0, 600)
          );
        }

        retryState = registerRetry(retryState, stage);
        planFeedback = formatCopyStyleIssuesForRetryFeedback(validation.errors, {
          vertical: candidate.meta.vertical,
          primaryGoal: candidate.meta.primaryGoal
        });
        continue;
      }

      plan = validation.value;
    } catch (error: any) {
      const stage: PipelineStage = "stage1_plan";
      const message = error?.message ?? "Stage 1 plan generation failed";
      if (!canRetryStage(retryState, stage)) {
        return failingStage(stage, retryState.stageRetries[stage], [message]);
      }
      retryState = registerRetry(retryState, stage);
      planFeedback = [message];
    }
  }

  let rendered = null as ReturnType<typeof renderWebsitePlan> | null;
  while (!rendered) {
    try {
      rendered = renderWebsitePlan(plan);
    } catch (error: any) {
      const stage: PipelineStage = "stage3_render";
      const message = error?.message ?? "Stage 3 render failed";
      if (!canRetryStage(retryState, stage)) {
        return failingStage(stage, retryState.stageRetries[stage], [message]);
      }
      retryState = registerRetry(retryState, stage);
    }
  }

  while (true) {
    try {
      applyClampStage(rendered.files.map((file) => file.content).join("\n"));
      break;
    } catch (error: any) {
      const stage: PipelineStage = "stage4_clamp";
      const message = error?.message ?? "Stage 4 clamp check failed";
      if (!canRetryStage(retryState, stage)) {
        return failingStage(stage, retryState.stageRetries[stage], [message]);
      }
      retryState = registerRetry(retryState, stage);
      if (retryState.stageRetries[stage] >= MAX_RETRIES_PER_STAGE) {
        return failingStage(stage, retryState.stageRetries[stage], [message]);
      }
    }
  }

  if (!rendered.files.length) {
    const stage: PipelineStage = "stage5_output";
    return failingStage(stage, retryState.stageRetries[stage], ["Stage 5 output failed: no files were generated."]);
  }

  let checks = runPipelineChecks({
    cwd: process.cwd(),
    plan,
    rendered,
    runCommandChecks: shouldRunCommandChecks(input)
  });

  while (!checks.ok) {
    const stage: PipelineStage = "stage6_checks";
    if (!canRetryStage(retryState, stage)) {
      return failingStage(stage, retryState.stageRetries[stage], checks.errors);
    }

    retryState = registerRetry(retryState, stage);
    checks = runPipelineChecks({
      cwd: process.cwd(),
      plan,
      rendered,
      runCommandChecks: shouldRunCommandChecks(input)
    });
  }

  const candidateCount = qualityMode === "best" ? 3 : qualityMode === "balanced" ? 2 : 1;
  const candidateResults: Array<{
    plan: Awaited<ReturnType<typeof buildWebsitePlan>>;
    rendered: ReturnType<typeof renderWebsitePlan>;
    checks: PipelineChecksResult;
    quality: ReturnType<typeof buildQualityReport>;
    score: number;
  }> = [
    {
      plan,
      rendered,
      checks,
      quality: buildQualityReport({ plan, intake, mode: qualityMode, candidateCount }),
      score: 0
    }
  ];
  candidateResults[0].score =
    candidateResults[0].quality.score + (candidateResults[0].checks.ok ? 6 : -20);

  if (input.openai && candidateCount > 1) {
    for (let index = 1; index < candidateCount; index += 1) {
      try {
        const altPlan = await buildWebsitePlan(intake, rawPrompt, input.openai, [], {
          qualityMode,
          candidateIndex: index
        });
        const altRendered = renderWebsitePlan(altPlan);
        const altChecks = runPipelineChecks({
          cwd: process.cwd(),
          plan: altPlan,
          rendered: altRendered,
          runCommandChecks: false
        });
        if (!altChecks.ok) {
          continue;
        }
        const quality = buildQualityReport({
          plan: altPlan,
          intake,
          mode: qualityMode,
          candidateCount
        });
        candidateResults.push({
          plan: altPlan,
          rendered: altRendered,
          checks: altChecks,
          quality,
          score: quality.score + (altChecks.ok ? 6 : -20)
        });
      } catch (error) {
        console.error("[GEN:v0-like] skipped alternate candidate", error);
      }
    }
  }

  const selected =
    candidateResults.sort((left, right) => right.score - left.score)[0] ?? candidateResults[0];

  return {
    ok: true,
    intake,
    plan: selected.plan,
    rendered: selected.rendered,
    checks: selected.checks,
    quality: selected.quality
  };
}
