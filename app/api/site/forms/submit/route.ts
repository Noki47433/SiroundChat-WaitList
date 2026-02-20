import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";

export const runtime = "nodejs";

// Zod v4: z.record needs key/value (or value) explicitly.
// We'll accept any JSON-ish object for payload.
const AnyRecordSchema = z.record(z.string(), z.any());

const BaseSchema = z.object({
  slug: z.string().min(1).optional(),
  siteId: z.string().uuid().optional(),
  form_type: z.enum(["contact", "reservation"]),
  payload: AnyRecordSchema
});

const ContactPayloadSchema = z
  .object({
    name: z.string().min(1),
    message: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().min(2).optional().nullable()
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone required"
  });

const ReservationPayloadSchema = z
  .object({
    name: z.string().min(1),
    date: z.string().min(1),
    time: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().min(2).optional().nullable(),
    party_size: z.string().optional().nullable()
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone required"
  });

type BuilderSiteRow = {
  id: string;
  business_id: string;
  slug: string | null;
  status: "draft" | "published" | "error" | string;
};

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return request.headers.get("x-real-ip") || "";
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let incoming: unknown = null;

    if (contentType.includes("application/json")) {
      incoming = await request.json().catch(() => null);
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData();

      const formType = String(formData.get("form_type") ?? "").trim();
      const slug = String(formData.get("slug") ?? "").trim();
      const siteId = String(formData.get("siteId") ?? "").trim();

      const name = String(formData.get("name") ?? "").trim();
      const contactField = String(formData.get("contact") ?? "").trim(); // combined field from templates
      const emailField = String(formData.get("email") ?? "").trim();
      const phoneField = String(formData.get("phone") ?? "").trim();
      const contact = contactField || emailField || phoneField;
      const message = String(formData.get("message") ?? "").trim();

      const date = String(formData.get("date") ?? "").trim();
      const time = String(formData.get("time") ?? "").trim();
      const partySize = String(formData.get("party_size") ?? "").trim();

      const email = emailField || (contact.includes("@") ? contact : null);
      const phone = phoneField || (contact && !contact.includes("@") ? contact : null);

      incoming = {
        slug: slug || undefined,
        siteId: siteId || undefined,
        form_type: formType,
        payload:
          formType === "reservation"
            ? {
                name,
                date,
                time,
                email,
                phone,
                party_size: partySize || null
              }
            : {
                name,
                message,
                email,
                phone
              }
      };
    } else {
      // last resort: try json anyway
      incoming = await request.json().catch(() => null);
    }

    const parsed = BaseSchema.safeParse(incoming);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { slug, siteId, form_type, payload: rawPayload } = parsed.data;

    // fix: TS wants explicit checks so siteId isn't "string | undefined" confusion
    const hasSlug = typeof slug === "string" && slug.length > 0;
    const hasSiteId = typeof siteId === "string" && siteId.length > 0;

    if (!hasSlug && !hasSiteId) {
      return NextResponse.json({ error: "slug or siteId required" }, { status: 400 });
    }

    // rate limit
    const ip = getClientIp(request);
    const rateKey = `${ip || "unknown"}:${form_type}`;
    await enforceRateLimit({ key: rateKey, limit: 6, windowInSeconds: 60 });

    const admin = getSupabaseAdminClient();

    // NOTE: cast to any to avoid Supabase "never" inference in this file
    const siteQuery = (admin as any)
      .from("builder_sites")
      .select("id,business_id,slug,status");

    const siteRes = hasSiteId
      ? await siteQuery.eq("id", siteId!).maybeSingle()
      : await siteQuery.eq("slug", slug!).maybeSingle();

    const site = (siteRes?.data ?? null) as BuilderSiteRow | null;

    if (!site || site.status !== "published") {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const payloadSchema = form_type === "reservation" ? ReservationPayloadSchema : ContactPayloadSchema;
    const payloadResult = payloadSchema.safeParse(rawPayload);

    if (!payloadResult.success) {
      return NextResponse.json({ error: payloadResult.error.flatten() }, { status: 400 });
    }

    const { data: submission, error: insertError } = await (admin as any)
      .from("site_form_submissions")
      .insert({
        site_id: site.id,
        business_id: site.business_id,
        form_type,
        payload: payloadResult.data
      })
      .select("id")
      .single();

    if (insertError || !submission?.id) {
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
    }

    const title = form_type === "reservation" ? "New reservation request" : "New contact form submission";
    const body =
      form_type === "reservation"
        ? `Reservation request from ${payloadResult.data.name}.`
        : `Message from ${payloadResult.data.name}.`;

    await createNotificationIfNotExists(
      site.business_id,
      {
        title,
        body,
        severity: form_type === "reservation" ? "critical" : "success",
        category: "ops",
        cta_label: form_type === "reservation" ? "View reservations" : "View messages",
        cta_url: form_type === "reservation" ? "/dashboard/reservations" : "/dashboard/conversations",
        data: {
          site_id: site.id,
          form_type,
          name: payloadResult.data.name
        }
      },
      "site_form_submission",
      submission.id
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    console.error("[SITE_FORM_SUBMIT_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit form" }, { status: 500 });
  }
}
