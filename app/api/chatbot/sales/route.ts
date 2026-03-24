import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import {
  extractUpdateRules,
  hydrateUpdateRuleRows,
  isMissingUpdateInfoSchemaError,
  syncEntryStatus
} from "@/lib/chatbot/update-info";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { log } from "@/lib/utils/log";

const SubmitEntrySchema = z.object({
  action: z.literal("submit_entry"),
  inputText: z.string().min(8)
});

const ApproveRuleSchema = z.object({
  action: z.literal("approve_rule"),
  ruleId: z.string().uuid(),
  payload: z
    .object({
      title: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      keywords: z.array(z.string().min(1)).optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      enabled: z.boolean().optional()
    })
    .optional()
});

const UpdateRuleSchema = z.object({
  action: z.literal("update_rule"),
  ruleId: z.string().uuid(),
  payload: z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    keywords: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    enabled: z.boolean().optional(),
    approval_status: z.enum(["pending", "approved", "discarded"]).optional()
  })
});

const ToggleRuleSchema = z.object({
  action: z.literal("toggle_rule"),
  ruleId: z.string().uuid(),
  enabled: z.boolean()
});

const DiscardRuleSchema = z.object({
  action: z.literal("discard_rule"),
  ruleId: z.string().uuid()
});

const DeleteEntrySchema = z.object({
  action: z.literal("delete_entry"),
  entryId: z.string().uuid()
});

const MutationSchema = z.discriminatedUnion("action", [
  SubmitEntrySchema,
  ApproveRuleSchema,
  UpdateRuleSchema,
  ToggleRuleSchema,
  DiscardRuleSchema,
  DeleteEntrySchema
]);

const serialize = async (supabase: any, businessId: string) => {
  const [entriesResult, rulesResult] = await Promise.all([
    supabase
      .from("chatbot_update_entries")
      .select("id,business_id,input_text,status,created_at,updated_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("chatbot_update_rules")
      .select("id,business_id,entry_id,category,title,body,keywords,metadata,enabled,approval_status,created_at,updated_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (rulesResult.error) throw rulesResult.error;

  const rules = hydrateUpdateRuleRows((rulesResult.data ?? []) as any[]);

  return {
    entries: entriesResult.data ?? [],
    pendingRules: rules.filter((rule: any) => rule.approval_status === "pending"),
    activeRules: rules.filter((rule: any) => rule.approval_status === "approved"),
    discardedRules: rules.filter((rule: any) => rule.approval_status === "discarded")
  };
};

export async function GET() {
  const { context, response } = await requireBusinessUser();
  if (response) return response;
  const admin = getSupabaseServerAdminClient() as any;

  try {
    const data = await serialize(admin, context.businessId);
    return NextResponse.json(data);
  } catch (error) {
    if (isMissingUpdateInfoSchemaError(error)) {
      return NextResponse.json({
        entries: [],
        pendingRules: [],
        activeRules: [],
        discardedRules: [],
        migrationRequired: true
      });
    }
    log("error", "Failed to load update info configuration", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to load update info" }, { status: 500 });
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

  const supabase = getSupabaseServerAdminClient() as any;

  try {
    if (parsed.data.action === "submit_entry") {
      const inputText = parsed.data.inputText.trim();
      const { data: entry, error: entryError } = await supabase
        .from("chatbot_update_entries")
        .insert({
          business_id: context.businessId,
          input_text: inputText,
          status: "pending_review"
        })
        .select("id")
        .single();

      if (entryError || !entry?.id) throw entryError ?? new Error("Failed to create update entry");

      const extracted = await extractUpdateRules(inputText);
      if (extracted.length) {
        const { error: rulesError } = await supabase.from("chatbot_update_rules").insert(
          extracted.map((rule) => ({
            business_id: context.businessId,
            entry_id: entry.id,
            category: rule.category,
            title: rule.title,
            body: rule.body,
            keywords: rule.keywords,
            metadata: rule.metadata,
            enabled: true,
            approval_status: "pending"
          }))
        );

        if (rulesError) throw rulesError;
      }
    }

    if (parsed.data.action === "approve_rule") {
      const { data: updated, error } = await supabase
        .from("chatbot_update_rules")
        .update({
          ...(parsed.data.payload ?? {}),
          approval_status: "approved",
          enabled: parsed.data.payload?.enabled ?? true
        })
        .eq("id", parsed.data.ruleId)
        .eq("business_id", context.businessId)
        .select("entry_id")
        .single();

      if (error) throw error;
      if (updated?.entry_id) {
        await syncEntryStatus(supabase, updated.entry_id);
      }
    }

    if (parsed.data.action === "update_rule") {
      const { data: updated, error } = await supabase
        .from("chatbot_update_rules")
        .update(parsed.data.payload)
        .eq("id", parsed.data.ruleId)
        .eq("business_id", context.businessId)
        .select("entry_id")
        .single();

      if (error) throw error;
      if (updated?.entry_id) {
        await syncEntryStatus(supabase, updated.entry_id);
      }
    }

    if (parsed.data.action === "toggle_rule") {
      const { error } = await supabase
        .from("chatbot_update_rules")
        .update({ enabled: parsed.data.enabled })
        .eq("id", parsed.data.ruleId)
        .eq("business_id", context.businessId);
      if (error) throw error;
    }

    if (parsed.data.action === "discard_rule") {
      const { data: updated, error } = await supabase
        .from("chatbot_update_rules")
        .update({ approval_status: "discarded", enabled: false })
        .eq("id", parsed.data.ruleId)
        .eq("business_id", context.businessId)
        .select("entry_id")
        .single();

      if (error) throw error;
      if (updated?.entry_id) {
        await syncEntryStatus(supabase, updated.entry_id);
      }
    }

    if (parsed.data.action === "delete_entry") {
      const { error: rulesError } = await supabase
        .from("chatbot_update_rules")
        .delete()
        .eq("entry_id", parsed.data.entryId)
        .eq("business_id", context.businessId);
      if (rulesError) throw rulesError;

      const { error: entryError } = await supabase
        .from("chatbot_update_entries")
        .delete()
        .eq("id", parsed.data.entryId)
        .eq("business_id", context.businessId);
      if (entryError) throw entryError;
    }

    const data = await serialize(supabase, context.businessId);
    return NextResponse.json(data);
  } catch (error) {
    if (isMissingUpdateInfoSchemaError(error)) {
      return NextResponse.json(
        {
          error: "Update Info is unavailable until the latest database migration is applied.",
          code: "UPDATE_INFO_MIGRATION_REQUIRED"
        },
        { status: 503 }
      );
    }
    log("error", "Failed to mutate update info configuration", {
      error,
      businessId: context.businessId,
      action: parsed.data.action
    });
    return NextResponse.json({ error: "Failed to save update info" }, { status: 500 });
  }
}
