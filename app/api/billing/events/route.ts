import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

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

  const { data, error } = await (supabase as any)
    .from("billing_events")
    .select("id, business_id, actor_user_id, event_type, payload, created_at")
    .eq("business_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to load billing events" }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] }, { status: 200 });
}
