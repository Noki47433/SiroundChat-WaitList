import { NextResponse } from "next/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

export async function enforceAuthenticatedTenant() {
  const tenant = await getTenantFromSession();
  if (!tenant.userId || !tenant.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return tenant;
}
