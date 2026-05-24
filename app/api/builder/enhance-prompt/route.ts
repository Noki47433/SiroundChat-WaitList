import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { enhanceRestaurantPrompt } from "@/lib/builder/template-sites/content";
import { ThemeStyleIdSchema } from "@/lib/builder/template-sites/schema";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  prompt: z.string().trim().min(12),
  businessName: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
  themeStyle: ThemeStyleIdSchema.optional().nullable(),
  primaryColor: z.string().trim().optional().nullable(),
  secondaryColor: z.string().trim().optional().nullable()
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

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OpenAI is not configured for prompt enhancement." }, { status: 503 });
  }

  try {
    const enhancedPrompt = await enhanceRestaurantPrompt(
      openai,
      parsed.data.prompt,
      parsed.data.businessName,
      parsed.data.industry,
      parsed.data.themeStyle ?? null,
      parsed.data.primaryColor ?? null,
      parsed.data.secondaryColor ?? null
    );

    return NextResponse.json({ enhancedPrompt });
  } catch (error) {
    console.error("[BUILDER_ENHANCE_PROMPT_ERROR]", error);
    return NextResponse.json({ error: "Unable to enhance prompt right now." }, { status: 500 });
  }
}
