import { NextResponse } from "next/server";
import { z } from "zod";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  enabled: z.boolean()
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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

  const tenant = await getTenantFromSession(user.id);
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { conversationId, enabled } = parsed.data;
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    takeover_enabled: enabled,
    takeover_by: enabled ? user.id : null,
    takeover_ended_at: enabled ? null : now
  };

  if (enabled) {
    updatePayload.takeover_at = now;
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("chat_conversations")
    .update(updatePayload)
    .eq("id", conversationId)
    .eq("business_id", tenant.businessId)
    .select("id, takeover_enabled, takeover_by, takeover_at, takeover_ended_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update takeover state" }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    takeover_enabled: updated.takeover_enabled,
    takeover_by: updated.takeover_by,
    takeover_at: updated.takeover_at,
    takeover_ended_at: updated.takeover_ended_at
  });
}
