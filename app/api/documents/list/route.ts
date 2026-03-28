import { NextResponse } from "next/server";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import {
  canAccessBillingWorkspace,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";

export const dynamic = "force-dynamic";

const normalizeUuid = (value: string | null) => (value ?? "").trim().replace(/[<>]/g, "");

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { searchParams } = new URL(request.url);
  const businessId = normalizeUuid(searchParams.get("businessId"));

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const canAccess = await canAccessBillingWorkspace(user.id, businessId);
  if (!canAccess) {
    return NextResponse.json({ error: "Business not found or not owned" }, { status: 403 });
  }

  const billingAccess = await getBusinessEntitlementAccess(businessId, "chatbot_knowledge_base");
  if (!billingAccess.allowed) {
    return NextResponse.json({ error: "Knowledge uploads are not available on the current plan" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, size_bytes, status, error_message, updated_at, created_at")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}
