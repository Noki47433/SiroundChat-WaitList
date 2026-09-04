/**
 * The one place a model is called for website work.
 *
 * Everything here is schema-constrained: the model is given a JSON Schema it
 * must satisfy, the response is parsed back through the same zod schema
 * server-side, and a response that fails is retried a bounded number of times
 * with the validation issues attached. There is no self-repair loop and no path
 * where unparsed model output reaches persistence.
 *
 * The rule the mission sets, restated because it is the whole point: **validate
 * model output server-side even when the model used structured output.**
 * Schema-constrained decoding is a strong hint, not a guarantee.
 */
import type { z } from "zod";
import { z as zod } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { logSiteSpecEvent, startTimer } from "@/lib/site-spec/telemetry";

/** Site work uses the same model tier as the rest of the product. */
export const SITE_SPEC_MODEL = process.env.SITE_SPEC_MODEL || "gpt-4o";

/**
 * What one call to the model cost, in the only two units that matter for a
 * rollout decision: wall-clock and tokens.
 *
 * Accumulated across repair attempts, because "how long did this edit take" is
 * a question about the whole operation, not about the attempt that happened to
 * succeed. `attempts > 1` is itself the repair signal.
 */
export type ModelUsage = {
  attempts: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
};

/** A zero reading. Exported so stubs and harnesses can satisfy the contract. */
export const emptyModelUsage = (): ModelUsage => ({
  attempts: 0,
  durationMs: 0,
  promptTokens: 0,
  completionTokens: 0
});

export type StructuredResult<T> =
  | { ok: true; value: T; attempts: number; usage: ModelUsage }
  | {
      ok: false;
      reason: "no_client" | "model_error" | "invalid_output" | "timeout";
      message: string;
      attempts: number;
      usage: ModelUsage;
      /** Validation issues from the last attempt, for logging and repair. */
      issues?: Array<{ path: string; message: string }>;
    };

export type StructuredCall<T> = {
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  model?: string;
  /** Total attempts including the first. Bounded — never an open repair loop. */
  maxAttempts?: number;
  temperature?: number;
  /** Milliseconds. A slow model must not hold a request open indefinitely. */
  timeoutMs?: number;
  /**
   * Called when a parsed result is structurally fine but semantically unusable
   * (for example a plan that assembles into an invalid spec). Return issues to
   * trigger a repair attempt, or null to accept.
   */
  verify?: (value: T) => Array<{ path: string; message: string }> | null;
};

const toJsonSchema = (schema: z.ZodType<unknown>) => {
  const generated = (zod as unknown as {
    toJSONSchema: (s: unknown, o: Record<string, unknown>) => Record<string, unknown>;
  }).toJSONSchema(schema, { target: "draft-2020-12", io: "output" });
  // OpenAI rejects `$schema` inside a supplied schema.
  const { $schema: _dropped, ...rest } = generated;
  return rest;
};

const issuesFrom = (error: z.ZodError): Array<{ path: string; message: string }> =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

/**
 * Ask the model for a value of a given shape.
 *
 * Retries are bounded and each one is *informed*: the failing issues are handed
 * back so the second attempt is a correction rather than a re-roll.
 */
export const callStructured = async <T>({
  schema,
  schemaName,
  system,
  user,
  model = SITE_SPEC_MODEL,
  maxAttempts = 3,
  temperature = 0.7,
  timeoutMs = 60_000,
  verify
}: StructuredCall<T>): Promise<StructuredResult<T>> => {
  const client = getOpenAIClient();
  const usage = emptyModelUsage();
  if (!client) {
    return {
      ok: false,
      reason: "no_client",
      message: "No model is configured for this environment.",
      attempts: 0,
      usage
    };
  }
  const elapsed = startTimer();

  const jsonSchema = toJsonSchema(schema as z.ZodType<unknown>);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: user }
  ];

  let lastIssues: Array<{ path: string; message: string }> | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    usage.attempts = attempt;
    usage.durationMs = elapsed();
    let raw: string | null | undefined;
    try {
      const response = await client.chat.completions.create(
        {
          model,
          temperature,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, schema: jsonSchema as Record<string, unknown>, strict: true }
          }
        },
        { timeout: timeoutMs }
      );
      raw = response.choices[0]?.message?.content;
      usage.promptTokens += response.usage?.prompt_tokens ?? 0;
      usage.completionTokens += response.usage?.completion_tokens ?? 0;
      usage.durationMs = elapsed();
    } catch (error) {
      const message = (error as Error).message ?? "model call failed";
      // A timeout is worth distinguishing: the caller keeps the current draft.
      const reason = /timeout|aborted/i.test(message) ? "timeout" : "model_error";
      usage.durationMs = elapsed();
      if (attempt === maxAttempts) {
        logModelCall(schemaName, model, usage, false);
        return { ok: false, reason, message, attempts: attempt, usage };
      }
      continue;
    }

    if (!raw) {
      if (attempt === maxAttempts) {
        logModelCall(schemaName, model, usage, false);
        return {
          ok: false,
          reason: "invalid_output",
          message: "The model returned nothing.",
          attempts: attempt,
          usage
        };
      }
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      lastIssues = [{ path: "", message: "response was not valid JSON" }];
      if (attempt === maxAttempts) {
        logModelCall(schemaName, model, usage, false);
        return {
          ok: false,
          reason: "invalid_output",
          message: "The model's response could not be read.",
          attempts: attempt,
          usage,
          issues: lastIssues
        };
      }
      messages.push({ role: "assistant", content: raw.slice(0, 2000) });
      messages.push({ role: "user", content: "That was not valid JSON. Return only the JSON object." });
      continue;
    }

    // Server-side validation, regardless of what the decoder promised.
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      lastIssues = issuesFrom(parsed.error);
    } else {
      const verificationIssues = verify?.(parsed.data) ?? null;
      if (!verificationIssues) {
        usage.durationMs = elapsed();
        logModelCall(schemaName, model, usage, true);
        return { ok: true, value: parsed.data, attempts: attempt, usage };
      }
      lastIssues = verificationIssues;
    }

    if (attempt === maxAttempts) {
      logModelCall(schemaName, model, usage, false);
      return {
        ok: false,
        reason: "invalid_output",
        message: "The model's response did not fit the required shape.",
        attempts: attempt,
        usage,
        issues: lastIssues
      };
    }

    messages.push({ role: "assistant", content: raw.slice(0, 4000) });
    messages.push({
      role: "user",
      content:
        "That response had problems. Fix exactly these and return the whole object again:\n" +
        lastIssues.map((issue) => `- ${issue.path || "(root)"}: ${issue.message}`).join("\n")
    });
  }

  usage.durationMs = elapsed();
  logModelCall(schemaName, model, usage, false);
  return {
    ok: false,
    reason: "invalid_output",
    message: "The model could not produce a usable response.",
    attempts: maxAttempts,
    usage,
    issues: lastIssues
  };
};

/**
 * One line per model call, so latency and spend are measurable in production
 * without a tracing stack. Schema name and model id only — never the prompt.
 */
const logModelCall = (schemaName: string, model: string, usage: ModelUsage, ok: boolean) => {
  logSiteSpecEvent("MODEL_CALL", {
    schema: schemaName,
    model,
    ok,
    attempts: usage.attempts,
    repaired: usage.attempts > 1,
    durationMs: usage.durationMs,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens
  });
};

/**
 * What is safe to log about a failed call.
 *
 * Validation issues name fields and constraints, never Business or Knowledge
 * content, so they can go in application logs. The prompt never can.
 */
export const safeFailureLog = (result: Extract<StructuredResult<unknown>, { ok: false }>) => ({
  reason: result.reason,
  attempts: result.attempts,
  issueCount: result.issues?.length ?? 0,
  issuePaths: (result.issues ?? []).slice(0, 12).map((issue) => issue.path)
});
