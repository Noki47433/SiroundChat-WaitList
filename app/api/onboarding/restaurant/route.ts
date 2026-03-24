import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import {
  RESTAURANT_ONBOARDING_STEP_COUNT,
  RestaurantOnboardingDataSchema,
  generateRestaurantStarterKnowledge,
  normalizeRestaurantOnboardingData,
  sanitizeRestaurantOnboardingData,
  validateRestaurantOnboardingCompletion,
  validateRestaurantOnboardingStep
} from "@/lib/onboarding/restaurant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SaveRestaurantOnboardingSchema = z.object({
  data: RestaurantOnboardingDataSchema,
  stepIndex: z.number().int().min(0).max(RESTAURANT_ONBOARDING_STEP_COUNT - 1).default(0),
  complete: z.boolean().default(false)
});

export async function GET() {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const admin = getSupabaseServerAdminClient() as any;
  const { data: business, error } = await admin
    .from("businesses")
    .select("business_name, industry, onboarding_data, generated_starter_knowledge, onboarding_completed_at")
    .eq("id", context.businessId)
    .single();

  if (error || !business) {
    return NextResponse.json({ error: error?.message ?? "Business not found" }, { status: 404 });
  }

  const onboardingData = normalizeRestaurantOnboardingData(
    business.onboarding_data,
    business.business_name
  );

  return NextResponse.json({
    data: onboardingData,
    industry: business.industry ?? null,
    completedAt: business.onboarding_completed_at ?? null,
    generatedStarterKnowledge: business.generated_starter_knowledge ?? null
  });
}

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = SaveRestaurantOnboardingSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseServerAdminClient() as any;
  const data = sanitizeRestaurantOnboardingData(parsed.data.data);
  const validation = parsed.data.complete
    ? validateRestaurantOnboardingCompletion(data)
    : validateRestaurantOnboardingStep(data, parsed.data.stepIndex);

  if (validation.generalErrors.length) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const now = new Date().toISOString();
  const generatedStarterKnowledge = parsed.data.complete ? generateRestaurantStarterKnowledge(data) : null;

  const updatePayload: Record<string, unknown> = {
    industry: "restaurant",
    onboarding_data: data,
    updated_at: now
  };

  if (data.restaurantName) {
    updatePayload.business_name = data.restaurantName;
  }

  if (parsed.data.complete) {
    updatePayload.generated_starter_knowledge = generatedStarterKnowledge;
    updatePayload.onboarding_completed_at = now;
  }

  const { error: updateError } = await admin.from("businesses").update(updatePayload).eq("id", context.businessId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (parsed.data.complete) {
    const { error: userError } = await admin
      .from("users")
      .update({ onboarding_complete: true, updated_at: now })
      .eq("id", context.userId);

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    data,
    completedAt: parsed.data.complete ? now : null,
    generatedStarterKnowledge
  });
}
