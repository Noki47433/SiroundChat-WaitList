import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { resolveBillingEntitlements } from "@/lib/billing/entitlements";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import { getPlanDefinition } from "@/src/billing/plans";

const normalizeUuid = (value: string | null) => (value ?? "").trim().replace(/[<>]/g, "");

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
    const subscription = await getWorkspaceSubscription(workspaceId);
    const entitlements = resolveBillingEntitlements(
      subscription.billing_plan_id,
      subscription.is_access_active
    );

    return NextResponse.json(
      {
        subscription,
        accessActive: subscription.is_access_active,
        planDefinition: getPlanDefinition(subscription.plan_id),
        entitlements
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
