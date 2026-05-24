import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  actionType: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(500),
  slot_duration_min: z.coerce.number().int().min(5).max(480),
  slot_interval_min: z.coerce.number().int().min(5).max(240),
  avg_price_eur: z.coerce.number().min(0).max(999999).nullable().optional(),
  max_days_ahead: z.coerce.number().int().min(1).max(365),
  lead_time_min: z.coerce.number().int().min(0).max(10080),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const url = new URL(request.url);
  const actionType = url.searchParams.get("actionType") ?? "appointment";

  const { data, error } = await (context.supabase as any)
    .from("business_action_settings")
    .select("*")
    .eq("business_id", context.businessId)
    .eq("action_type", actionType)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data ?? {
      capacity: 1,
      slot_duration_min: 60,
      slot_interval_min: 30,
      avg_price_eur: null,
      max_days_ahead: 30,
      lead_time_min: 60,
      notes: null,
    },
  });
}

export async function PUT(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { actionType, ...fields } = parsed.data;

  const { data, error } = await (context.supabase as any)
    .from("business_action_settings")
    .upsert(
      {
        business_id: context.businessId,
        action_type: actionType,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,action_type" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
