import "server-only";
import { redirect } from "next/navigation";
import { getFullEntitlements } from "@/lib/billing/entitlements";
import { getTenantFromSession } from "@/lib/utils/tenant";
import {
  type EntitlementKey,
  type Entitlements
} from "@/src/billing/entitlements";

type RequireEntitlementResult = {
  workspaceId: string;
  entitlements: Entitlements;
};

type EntitlementAccessResult = {
  workspaceId: string | null;
  entitlements: Entitlements | null;
  allowed: boolean;
};

export async function getEntitlementAccess(
  entitlementKey: EntitlementKey,
  workspaceId?: string
): Promise<EntitlementAccessResult> {
  const tenant = await getTenantFromSession();
  const targetWorkspaceId = workspaceId ?? tenant.businessId ?? null;

  if (!targetWorkspaceId) {
    return { workspaceId: null, entitlements: null, allowed: false };
  }

  const entitlements = getFullEntitlements();
  const allowed = true;

  return { workspaceId: targetWorkspaceId, entitlements, allowed };
}

export async function requireEntitlement(
  entitlementKey: EntitlementKey,
  workspaceId?: string
): Promise<RequireEntitlementResult> {
  const access = await getEntitlementAccess(entitlementKey, workspaceId);
  if (!access.workspaceId || !access.entitlements || !access.allowed) {
    redirect(`/billing?blocked=${encodeURIComponent(entitlementKey)}`);
  }
  return { workspaceId: access.workspaceId, entitlements: access.entitlements };
}
