import { NextResponse } from "next/server";
import { z } from "zod";
import {
  defaultDashboardOnboardingState,
  isDashboardOnboardingStateEmpty,
  normalizeDashboardOnboardingState
} from "@/lib/dashboard/onboarding";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  state: z.unknown()
});

const buildBackfilledState = async (admin: any, businessId: string) => {
  const [chatbotSignal, websiteSignal, documentSignal] = await Promise.all([
    admin
      .from("businesses")
      .select("greeting,tone,logo_url")
      .eq("id", businessId)
      .maybeSingle(),
    admin
      .from("builder_sites")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .limit(1),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "ready")
      .limit(1)
  ]);

  const next = defaultDashboardOnboardingState();
  const chatbotReady = Boolean(
    chatbotSignal.data?.greeting || chatbotSignal.data?.tone || chatbotSignal.data?.logo_url
  );

  next.completed.create_chatbot = chatbotReady;
  next.completed.create_website = (websiteSignal.count ?? 0) > 0;
  next.completed.train_documents = (documentSignal.count ?? 0) > 0;

  return next;
};

const resolveDashboardOnboardingState = async (admin: any, businessId: string) => {
  const { data: business, error } = await admin
    .from("businesses")
    .select("dashboard_onboarding_state")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    throw new Error(error?.message ?? "Business not found");
  }

  if (!isDashboardOnboardingStateEmpty(business.dashboard_onboarding_state)) {
    return normalizeDashboardOnboardingState(business.dashboard_onboarding_state);
  }

  return buildBackfilledState(admin, businessId);
};

export async function GET() {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  try {
    const admin = getSupabaseServerAdminClient() as any;
    const state = await resolveDashboardOnboardingState(admin, context.businessId);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load onboarding state" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const state = normalizeDashboardOnboardingState(parsed.data.state);
  const admin = getSupabaseServerAdminClient() as any;

  const { error } = await admin
    .from("businesses")
    .update({
      dashboard_onboarding_state: state,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ state });
}
