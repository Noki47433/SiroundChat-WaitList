import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { type PlanId } from "@/src/billing/plans";
import { logActivity } from "@/lib/activity/log";

const ChangePlanSchema = z.object({
  workspaceId: z.string().uuid(),
  planId: z.enum(["website", "bundle", "chatbot"])
});

const resolveIsAdmin = async (supabase: any, userId: string) => {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role === "admin";
};

const assertOwnerOrAdmin = async (supabase: any, userId: string, businessId: string) => {
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

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = ChangePlanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspaceId or planId" }, { status: 400 });
  }

  const { workspaceId, planId } = parsed.data;
  const allowed = await assertOwnerOrAdmin(supabase, user.id, workspaceId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await (supabase as any).rpc("change_workspace_plan", {
    p_workspace_id: workspaceId,
    p_plan_id: planId as PlanId
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message ?? "Failed to change plan" }, { status: 500 });
  }

  const subscription = Array.isArray(data) ? data[0] : data;

  await logActivity({
    businessId: workspaceId,
    userId: user.id,
    actorType: "business_user",
    eventType: "billing_change",
    summary: `Changed plan to ${planId}`,
    meta: { plan_id: planId }
  });

  return NextResponse.json({ subscription }, { status: 200 });
}
