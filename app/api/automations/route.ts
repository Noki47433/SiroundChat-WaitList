import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const MutationSchema = z.object({
  resource: z.enum(["followup", "behavior", "abandoned"]),
  action: z.enum(["create", "update", "delete", "upsert"]),
  id: z.string().uuid().optional(),
  payload: z.record(z.string(), z.any()).optional()
});

const toJson = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

export async function GET() {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const supabase = context.supabase as any;

  try {
    const [followupsResult, behaviorsResult] = await Promise.all([
      supabase
        .from("followup_rules")
        .select("id,rule_type,config,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("behavior_offer_rules")
        .select("id,name,condition,action,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false })
    ]);

    const abandonedRule = (followupsResult.data ?? []).find((rule: any) => rule.rule_type === "abandoned_booking") ?? null;

    return NextResponse.json({
      followupRules: followupsResult.data ?? [],
      behaviorRules: behaviorsResult.data ?? [],
      abandonedRecovery: abandonedRule
    });
  } catch (error) {
    log("error", "Failed to load automations config", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to load automations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = MutationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = context.supabase as any;
  const { resource, action, id } = parsed.data;
  const body = parsed.data.payload ?? {};

  try {
    if (resource === "followup") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("followup_rules")
          .insert({
            business_id: context.businessId,
            rule_type: String(body.rule_type ?? "reservation_reminder"),
            config: toJson(body.config),
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("followup_rules")
          .update({
            rule_type: body.rule_type !== undefined ? String(body.rule_type) : undefined,
            config: body.config !== undefined ? toJson(body.config) : undefined,
            is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined
          })
          .eq("id", id)
          .eq("business_id", context.businessId)
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "delete" && id) {
        const { error } = await supabase.from("followup_rules").delete().eq("id", id).eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "behavior") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("behavior_offer_rules")
          .insert({
            business_id: context.businessId,
            name: String(body.name ?? "Behavior rule"),
            condition: toJson(body.condition),
            action: toJson(body.action),
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("behavior_offer_rules")
          .update({
            name: body.name !== undefined ? String(body.name) : undefined,
            condition: body.condition !== undefined ? toJson(body.condition) : undefined,
            action: body.action !== undefined ? toJson(body.action) : undefined,
            is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined
          })
          .eq("id", id)
          .eq("business_id", context.businessId)
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "delete" && id) {
        const { error } = await supabase
          .from("behavior_offer_rules")
          .delete()
          .eq("id", id)
          .eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "abandoned") {
      const thresholdMinutes = Number(body.threshold_minutes ?? 15);
      const enabled = body.enabled !== false;

      const { data: existing } = await supabase
        .from("followup_rules")
        .select("id")
        .eq("business_id", context.businessId)
        .eq("rule_type", "abandoned_booking")
        .maybeSingle();

      const payload = {
        business_id: context.businessId,
        rule_type: "abandoned_booking",
        config: { threshold_minutes: Number.isFinite(thresholdMinutes) ? thresholdMinutes : 15 },
        is_active: enabled
      };

      if (existing?.id) {
        const { data, error } = await supabase
          .from("followup_rules")
          .update(payload)
          .eq("id", existing.id)
          .eq("business_id", context.businessId)
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      const { data, error } = await supabase.from("followup_rules").insert(payload).select("*").single();
      if (error) throw error;
      return NextResponse.json({ item: data });
    }

    return NextResponse.json({ error: "Invalid mutation request" }, { status: 400 });
  } catch (error) {
    log("error", "Failed to mutate automations config", {
      error,
      businessId: context.businessId,
      resource,
      action
    });
    return NextResponse.json({ error: "Failed to save automations" }, { status: 500 });
  }
}
