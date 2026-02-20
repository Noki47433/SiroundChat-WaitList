import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const BaseMutationSchema = z.object({
  resource: z.enum(["upsell", "faq", "objection", "catalog", "qualification"]),
  action: z.enum(["create", "update", "delete", "upsert"]),
  id: z.string().uuid().optional(),
  payload: z.record(z.string(), z.any()).optional()
});

const coerceJsonObject = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

export async function GET() {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const supabase = context.supabase as any;

  try {
    const [
      upsellsResult,
      faqResult,
      objectionsResult,
      catalogResult,
      qualificationResult
    ] = await Promise.all([
      supabase
        .from("upsell_catalog")
        .select("id,name,description,trigger_type,trigger_rules,offer_payload,priority,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("faq_entries")
        .select("id,question,answer,category,keywords,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("objection_scripts")
        .select("id,objection_key,response_text,phrases,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("catalog_items")
        .select("id,name,description,tags,price,is_active,created_at")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("qualification_settings")
        .select("questions")
        .eq("business_id", context.businessId)
        .maybeSingle()
    ]);

    return NextResponse.json({
      upsells: upsellsResult.data ?? [],
      faqEntries: faqResult.data ?? [],
      objectionScripts: objectionsResult.data ?? [],
      catalogItems: catalogResult.data ?? [],
      qualificationQuestions: qualificationResult.data?.questions ?? []
    });
  } catch (error) {
    log("error", "Failed to load chatbot sales configuration", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to load sales configuration" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BaseMutationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = context.supabase as any;
  const { resource, action, id } = parsed.data;
  const body = parsed.data.payload ?? {};

  try {
    if (resource === "upsell") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("upsell_catalog")
          .insert({
            business_id: context.businessId,
            name: String(body.name ?? "New upsell"),
            description: body.description ? String(body.description) : null,
            trigger_type: String(body.trigger_type ?? "custom"),
            trigger_rules: coerceJsonObject(body.trigger_rules),
            offer_payload: coerceJsonObject(body.offer_payload),
            priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("upsell_catalog")
          .update({
            name: body.name ? String(body.name) : undefined,
            description: body.description === null ? null : body.description ? String(body.description) : undefined,
            trigger_type: body.trigger_type ? String(body.trigger_type) : undefined,
            trigger_rules: body.trigger_rules ? coerceJsonObject(body.trigger_rules) : undefined,
            offer_payload: body.offer_payload ? coerceJsonObject(body.offer_payload) : undefined,
            priority: body.priority !== undefined ? Number(body.priority) : undefined,
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
        const { error } = await supabase.from("upsell_catalog").delete().eq("id", id).eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "faq") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("faq_entries")
          .insert({
            business_id: context.businessId,
            question: String(body.question ?? ""),
            answer: String(body.answer ?? ""),
            category: body.category ? String(body.category) : null,
            keywords: Array.isArray(body.keywords) ? body.keywords.map((item) => String(item)) : [],
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("faq_entries")
          .update({
            question: body.question !== undefined ? String(body.question) : undefined,
            answer: body.answer !== undefined ? String(body.answer) : undefined,
            category: body.category !== undefined ? (body.category ? String(body.category) : null) : undefined,
            keywords: Array.isArray(body.keywords) ? body.keywords.map((item) => String(item)) : undefined,
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
        const { error } = await supabase.from("faq_entries").delete().eq("id", id).eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "objection") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("objection_scripts")
          .insert({
            business_id: context.businessId,
            objection_key: String(body.objection_key ?? "too_expensive"),
            response_text: String(body.response_text ?? ""),
            phrases: Array.isArray(body.phrases) ? body.phrases.map((item) => String(item)) : [],
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("objection_scripts")
          .update({
            objection_key: body.objection_key ? String(body.objection_key) : undefined,
            response_text: body.response_text !== undefined ? String(body.response_text) : undefined,
            phrases: Array.isArray(body.phrases) ? body.phrases.map((item) => String(item)) : undefined,
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
          .from("objection_scripts")
          .delete()
          .eq("id", id)
          .eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "catalog") {
      if (action === "create") {
        const { data, error } = await supabase
          .from("catalog_items")
          .insert({
            business_id: context.businessId,
            name: String(body.name ?? ""),
            description: body.description ? String(body.description) : null,
            tags: Array.isArray(body.tags) ? body.tags.map((item) => String(item)) : [],
            price: body.price !== undefined && body.price !== null ? Number(body.price) : null,
            is_active: body.is_active !== false
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ item: data });
      }

      if (action === "update" && id) {
        const { data, error } = await supabase
          .from("catalog_items")
          .update({
            name: body.name !== undefined ? String(body.name) : undefined,
            description: body.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
            tags: Array.isArray(body.tags) ? body.tags.map((item) => String(item)) : undefined,
            price: body.price !== undefined ? (body.price === null ? null : Number(body.price)) : undefined,
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
        const { error } = await supabase.from("catalog_items").delete().eq("id", id).eq("business_id", context.businessId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    if (resource === "qualification") {
      if (action !== "upsert") {
        return NextResponse.json({ error: "qualification supports only upsert" }, { status: 400 });
      }

      const questions = Array.isArray(body.questions)
        ? body.questions
            .map((item) => ({ field: String(item?.field ?? ""), question: String(item?.question ?? "") }))
            .filter((item) => item.field && item.question)
        : [];

      const { data, error } = await supabase
        .from("qualification_settings")
        .upsert(
          {
            business_id: context.businessId,
            questions
          },
          { onConflict: "business_id" }
        )
        .select("questions")
        .single();

      if (error) throw error;
      return NextResponse.json({ questions: data?.questions ?? [] });
    }

    return NextResponse.json({ error: "Invalid mutation request" }, { status: 400 });
  } catch (error) {
    log("error", "Failed to mutate chatbot sales resource", {
      error,
      businessId: context.businessId,
      resource,
      action
    });
    return NextResponse.json({ error: "Failed to save sales configuration" }, { status: 500 });
  }
}
