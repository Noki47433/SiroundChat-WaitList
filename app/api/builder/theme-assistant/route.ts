import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  prompt: z.string().min(1),
  theme: z.record(z.string(), z.any()).optional()
});

const ThemeSuggestionSchema = z.object({
  primary: z.string().min(1),
  background: z.string().min(1),
  fontFamily: z.string().optional()
});

const FONT_OPTIONS = [
  "Sora, Inter, system-ui, sans-serif",
  "Manrope, Inter, system-ui, sans-serif",
  '"Space Grotesk", Inter, system-ui, sans-serif',
  '"Playfair Display", Inter, system-ui, sans-serif'
];

const normalizeHex = (value?: string | null) => {
  const raw = (value ?? "").trim().replace("#", "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (raw.length === 6) return `#${raw}`;
  return null;
};

const normalizeFont = (value?: string | null, fallback?: string | null) => {
  if (!value) return fallback ?? FONT_OPTIONS[0];
  const lowered = value.toLowerCase();
  const match = FONT_OPTIONS.find((font) => font.toLowerCase().includes(lowered.split(",")[0] ?? ""));
  if (match) return match;
  if (FONT_OPTIONS.some((font) => font === value)) return value;
  return fallback ?? FONT_OPTIONS[0];
};

const pickPalette = (prompt: string, fallback: { primary: string; background: string; fontFamily: string }) => {
  const lower = prompt.toLowerCase();
  if (lower.includes("warm") || lower.includes("sunset") || lower.includes("cozy")) {
    return {
      primary: "#E07A5F",
      background: "#FFF4F0",
      fontFamily: FONT_OPTIONS[0]
    };
  }
  if (lower.includes("luxury") || lower.includes("premium") || lower.includes("elegant")) {
    return {
      primary: "#C9B37E",
      background: "#0B0B0C",
      fontFamily: FONT_OPTIONS[3]
    };
  }
  if (lower.includes("modern") || lower.includes("tech") || lower.includes("bold") || lower.includes("blue")) {
    return {
      primary: "#2563EB",
      background: "#EEF2FF",
      fontFamily: FONT_OPTIONS[2]
    };
  }
  if (lower.includes("minimal") || lower.includes("clean") || lower.includes("neutral")) {
    return {
      primary: "#111827",
      background: "#F9FAFB",
      fontFamily: FONT_OPTIONS[1]
    };
  }
  return fallback;
};

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prompt = parsed.data.prompt.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  const theme = parsed.data.theme ?? {};
  const fallback = {
    primary: normalizeHex(theme.primary) ?? "#111827",
    background: normalizeHex(theme.bg ?? theme.background) ?? "#F3F4F6",
    fontFamily: normalizeFont(theme.fontBody ?? theme.fontFamily ?? theme.fontHeading, FONT_OPTIONS[0])
  };

  const openai = getOpenAIClient();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You suggest website themes. Return JSON with keys: primary (hex), background (hex), fontFamily (string from allowed list)."
          },
          {
            role: "user",
            content: [
              `Prompt: ${prompt}`,
              `Allowed fonts: ${FONT_OPTIONS.join(" | ")}`,
              `Current primary: ${fallback.primary}`,
              `Current background: ${fallback.background}`
            ].join("\n")
          }
        ]
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const json = JSON.parse(raw);
      const validated = ThemeSuggestionSchema.safeParse(json);
      if (validated.success) {
        const primary = normalizeHex(validated.data.primary) ?? fallback.primary;
        const background = normalizeHex(validated.data.background) ?? fallback.background;
        const fontFamily = normalizeFont(validated.data.fontFamily ?? null, fallback.fontFamily);
        return NextResponse.json({ theme: { primary, background, fontFamily } });
      }
    } catch (error) {
      console.error("[BUILDER_THEME_ASSISTANT_ERROR]", error);
    }
  }

  const suggestion = pickPalette(prompt, fallback);
  return NextResponse.json({ theme: suggestion });
}
