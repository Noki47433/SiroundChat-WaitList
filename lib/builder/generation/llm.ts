import { z } from "zod";

type OpenAIChatClient = {
  chat: {
    completions: {
      create: (
        request: {
          model: string;
          temperature: number;
          response_format: { type: "json_object" };
          messages: Array<{ role: "system" | "user"; content: string }>;
        },
        options?: { signal?: AbortSignal }
      ) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;
    };
  };
};

const MODEL = "gpt-4o-mini";

const parseJsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const body = raw.slice(start, end + 1);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

async function runCompletion(
  openai: OpenAIChatClient,
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: MODEL,
        temperature: Math.min(0.4, Math.max(0, temperature)),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      },
      { signal: controller.signal }
    );

    return completion.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function runStrictJsonWithRetry<T>(
  openai: OpenAIChatClient | null,
  options: {
    schema: z.ZodType<T>;
    userPrompt: string;
    systemPrompt: string;
    temperature: number;
    timeoutMs?: number;
    label: string;
  }
): Promise<T | null> {
  if (!openai) return null;
  const timeoutMs = options.timeoutMs ?? 45000;

  const attempts = [
    {
      system: `${options.systemPrompt}\nReturn JSON only.`,
      user: options.userPrompt
    },
    {
      system:
        "STRICT JSON MODE. Return one valid JSON object only. No prose, no markdown, no comments, no trailing text.",
      user: `${options.userPrompt}\nIMPORTANT: Output must be a valid JSON object that exactly matches the schema.`
    }
  ];

  for (let index = 0; index < attempts.length; index += 1) {
    try {
      const raw = await runCompletion(
        openai,
        attempts[index].system,
        attempts[index].user,
        options.temperature,
        timeoutMs
      );
      const parsed = parseJsonObject(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        continue;
      }
      const validated = options.schema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
    } catch (error) {
      if (index === attempts.length - 1) {
        console.error(`[GEN:${options.label}] strict-json failed`, error);
      }
    }
  }

  return null;
}
