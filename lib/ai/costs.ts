const DEFAULT_INPUT_COST_PER_MILLION_USD = 0.15;
const DEFAULT_OUTPUT_COST_PER_MILLION_USD = 0.6;

const toFiniteNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const AI_INPUT_COST_PER_MILLION_USD = toFiniteNumber(
  process.env.ADMIN_AI_INPUT_COST_PER_MILLION_USD ?? process.env.AI_INPUT_COST_PER_MILLION_USD,
  DEFAULT_INPUT_COST_PER_MILLION_USD
);

export const AI_OUTPUT_COST_PER_MILLION_USD = toFiniteNumber(
  process.env.ADMIN_AI_OUTPUT_COST_PER_MILLION_USD ?? process.env.AI_OUTPUT_COST_PER_MILLION_USD,
  DEFAULT_OUTPUT_COST_PER_MILLION_USD
);

export const calculateAiTextCostUsd = (
  tokensIn: number,
  tokensOut: number,
  recordedCostUsd = 0
) => {
  if (recordedCostUsd > 0) {
    return Number(recordedCostUsd.toFixed(4));
  }

  const derived =
    (Math.max(0, tokensIn) / 1_000_000) * AI_INPUT_COST_PER_MILLION_USD +
    (Math.max(0, tokensOut) / 1_000_000) * AI_OUTPUT_COST_PER_MILLION_USD;

  return Number(derived.toFixed(4));
};

const estimateTextTokens = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
};

export const estimateLegacyAiMessageUsage = (content: string) => {
  const outputTokens = Math.max(24, estimateTextTokens(content));
  const inputTokens = Math.max(700, outputTokens + 500);

  return {
    inputTokens,
    outputTokens,
    costUsd: calculateAiTextCostUsd(inputTokens, outputTokens, 0)
  };
};
