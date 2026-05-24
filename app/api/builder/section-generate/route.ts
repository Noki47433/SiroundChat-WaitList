import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import type { SiteSection } from "@/lib/website-builder/types";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  prompt: z.string().min(1),
  theme: z.record(z.string(), z.any()).optional()
});

const ResponseSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1).optional()
});

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildSection = (title: string, body?: string): SiteSection => ({
  id: createId(),
  type: "custom",
  variant: "A",
  enabled: true,
  style: {
    alignment: "left",
    spacing: "normal",
    background: { type: "plain" },
    buttonStyle: "solid",
    colorOverride: null
  },
  content: {
    title,
    body: body ?? "Edit this section to add the details you want to highlight."
  }
});

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenantFromSession(userData.user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(tenant.businessId, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
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

  const openai = getOpenAIClient();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You generate section copy. Return JSON only with keys: title (string), body (string). Keep it concise."
          },
          { role: "user", content: `Section prompt: ${prompt}` }
        ]
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const json = JSON.parse(raw);
      const validated = ResponseSchema.safeParse(json);
      if (validated.success) {
        const section = buildSection(validated.data.title, validated.data.body);
        return NextResponse.json({ section });
      }
    } catch (error) {
      console.error("[BUILDER_SECTION_GENERATE_ERROR]", error);
    }
  }

  const fallbackTitle = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
  const section = buildSection(fallbackTitle, "Edit this section to add the details you want to highlight.");
  return NextResponse.json({ section });
}
