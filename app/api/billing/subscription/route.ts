import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getPlanDefinition, resolveEntitlements, type PlanId } from "@/src/billing/plans";

const normalizeUuid = (value: string | null) => (value ?? "").trim().replace(/[<>]/g, "");

const SUBSCRIPTION_SELECT =
  "id,business_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at";

const resolveIsAdmin = async (supabase: any, userId: string) => {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role === "admin";
};

const assertMembership = async (supabase: any, userId: string, businessId: string) => {
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id, owner_id, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (!business?.id) return false;

  const ownerId = (business.owner_user_id ?? business.owner_id) as string | null;
  if (ownerId && ownerId === userId) return true;
  return resolveIsAdmin(supabase, userId);
};

const ensureSubscription = async (supabaseAdmin: any, businessId: string) => {
  const { data: existing } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("business_id", businessId)
    .maybeSingle();

  if (existing) return existing;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data: inserted, error } = await (supabaseAdmin as any)
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        plan: "local_basic",
        plan_id: "website",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false
      },
      { onConflict: "business_id" }
    )
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to ensure subscription");
  }

  return inserted;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedWorkspaceId = normalizeUuid(searchParams.get("workspaceId"));

  const tenant = await getTenantFromSession(user.id);
  const workspaceId = requestedWorkspaceId || tenant.businessId;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const canAccess = await assertMembership(supabase, user.id, workspaceId);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const subscription = await ensureSubscription(admin, workspaceId);
    const planId = (subscription.plan_id ?? "website") as PlanId;
    return NextResponse.json(
      {
        subscription,
        planDefinition: getPlanDefinition(planId),
        entitlements: resolveEntitlements(planId)
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
