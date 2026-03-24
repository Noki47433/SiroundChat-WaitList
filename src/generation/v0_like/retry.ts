import type { PipelineStage, StageFailure } from "@/src/generation/v0_like/types";

export const MAX_RETRIES_PER_STAGE = 2;
export const MAX_TOTAL_RETRIES = 4;

export const PROMPT_STAGE_7_RETRY_FEEDBACK = [
  "Stage 7 Retry: retry only the failing stage.",
  "Use the exact validation error text below.",
  "Do not change successful stages.",
  "Do not regenerate everything unless the failing stage is Stage 1 plan generation.",
  `Max retries per stage: ${MAX_RETRIES_PER_STAGE}`,
  `Max total retries: ${MAX_TOTAL_RETRIES}`
].join("\n");

export type RetryState = {
  totalRetries: number;
  stageRetries: Record<PipelineStage, number>;
};

export const createRetryState = (): RetryState => ({
  totalRetries: 0,
  stageRetries: {
    stage0_intake: 0,
    stage1_plan: 0,
    stage2_validate: 0,
    stage3_render: 0,
    stage4_clamp: 0,
    stage5_output: 0,
    stage6_checks: 0
  }
});

export const canRetryStage = (state: RetryState, stage: PipelineStage) => {
  return state.totalRetries < MAX_TOTAL_RETRIES && state.stageRetries[stage] < MAX_RETRIES_PER_STAGE;
};

export const registerRetry = (state: RetryState, stage: PipelineStage): RetryState => {
  return {
    totalRetries: state.totalRetries + 1,
    stageRetries: {
      ...state.stageRetries,
      [stage]: state.stageRetries[stage] + 1
    }
  };
};

export const createFailure = (
  stage: PipelineStage,
  attempts: number,
  errors: string[],
  lastOutputSnippet?: string
): StageFailure => ({
  stage,
  attempts,
  errors,
  ...(lastOutputSnippet ? { lastOutputSnippet } : {})
});
