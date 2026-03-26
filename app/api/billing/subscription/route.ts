import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { resolveBillingEntitlements } from "@/lib/billing/entitlements";
import {
  normalizeWorkspaceId,
  resolveBillingWorkspaceSelection
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import { getPlanDefinition } from "@/src/billing/plans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrelaunchUserAllowed(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedWorkspaceId = normalizeWorkspaceId(searchParams.get("workspaceId"));
  const selection = await resolveBillingWorkspaceSelection(user.id, requestedWorkspaceId, {
    allowAdmin: true,
    userEmail: user.email ?? null
  });

  if (!selection.businessId) {
    if (selection.error === "workspace_ambiguous") {
      return NextResponse.json(
        { error: "workspaceId is required when your account has multiple workspaces." },
        { status: 400 }
      );
    }

    if (selection.error === "workspace_forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  try {
    const subscription = await getWorkspaceSubscription(selection.businessId);
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
    console.error("[BILLING_SUBSCRIPTION_ERROR]", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}
