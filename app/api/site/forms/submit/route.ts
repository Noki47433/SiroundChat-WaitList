import { NextResponse } from "next/server";
import { z } from "zod";
import { sendReservationSmsAlert } from "@/lib/server/twilio";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";
import { log } from "@/lib/utils/log";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { insertWebsiteAnalyticsEvent } from "@/lib/analytics/website-events";
import {
  buildUpgradeRequiredPayload,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import {
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap,
  getOrCreateReservationSettings,
  loadCapacityRelevantReservations,
  localDateTimeStringToUtcDate,
  validateLeadAndMaxDays
} from "@/lib/reservations/service";

export const runtime = "nodejs";

const AnyRecordSchema = z.record(z.string(), z.any());

const AnalyticsSchema = z.object({
  businessId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional().nullable(),
  pagePath: z.string().min(1),
  pageTitle: z.string().optional().nullable(),
  sessionId: z.string().min(8),
  referrer: z.string().optional().nullable()
});

const BaseSchema = z.object({
  slug: z.string().min(1).optional(),
  siteId: z.string().uuid().optional(),
  form_type: z.enum(["contact", "reservation"]),
  payload: AnyRecordSchema,
  analytics: AnalyticsSchema.optional().nullable()
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
    party_size: z.string().optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
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

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toReservationPartySize = (value: string | null | undefined) => {
  const numeric = Number(value ?? "");
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  return 2;
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
      const contactField = String(formData.get("contact") ?? "").trim();
      const emailField = String(formData.get("email") ?? "").trim();
      const phoneField = String(formData.get("phone") ?? "").trim();
      const contact = contactField || emailField || phoneField;
      const message = String(formData.get("message") ?? "").trim();
      const date = String(formData.get("date") ?? "").trim();
      const time = String(formData.get("time") ?? "").trim();
      const partySize = String(formData.get("party_size") ?? "").trim();
      const notes = String(formData.get("notes") ?? "").trim();

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
                party_size: partySize || null,
                notes: notes || null
              }
            : {
                name,
                message,
                email,
                phone
              }
      };
    } else {
      incoming = await request.json().catch(() => null);
    }

    const parsed = BaseSchema.safeParse(incoming);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { slug, siteId, form_type, payload: rawPayload, analytics } = parsed.data;
    const hasSlug = typeof slug === "string" && slug.length > 0;
    const hasSiteId = typeof siteId === "string" && siteId.length > 0;

    if (!hasSlug && !hasSiteId) {
      return NextResponse.json({ error: "slug or siteId required" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateKey = `${ip || "unknown"}:${form_type}`;
    await enforceRateLimit({ key: rateKey, limit: 6, windowInSeconds: 60 });

    const admin = getSupabaseAdminClient() as any;
    const siteQuery = admin.from("builder_sites").select("id,business_id,slug,status");
    const siteRes = hasSiteId
      ? await siteQuery.eq("id", siteId!).maybeSingle()
      : await siteQuery.eq("slug", slug!).maybeSingle();

    const site = (siteRes?.data ?? null) as BuilderSiteRow | null;
    if (!site || (!hasSiteId && site.status !== "published")) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const requiredEntitlement = form_type === "reservation" ? "reservations" : "forms_lead_capture";
    const billingAccess = await getBusinessEntitlementAccess(site.business_id, requiredEntitlement);
    if (!billingAccess.allowed) {
      return NextResponse.json(buildUpgradeRequiredPayload(requiredEntitlement, billingAccess), { status: 403 });
    }

    const payloadSchema = form_type === "reservation" ? ReservationPayloadSchema : ContactPayloadSchema;
    const payloadResult = payloadSchema.safeParse(rawPayload);
    if (!payloadResult.success) {
      return NextResponse.json({ error: payloadResult.error.flatten() }, { status: 400 });
    }

    let leadId: string | null = null;
    let reservationId: string | null = null;

    if (form_type === "contact") {
      const contactPayload = payloadResult.data as z.infer<typeof ContactPayloadSchema>;
      const leadPayload = {
        source: "website_form",
        form_type: "contact",
        site_id: site.id,
        message: contactPayload.message
      };
      const leadInsert = {
        business_id: site.business_id,
        conversation_id: null,
        name: contactPayload.name,
        email: contactPayload.email ?? null,
        phone: contactPayload.phone ?? null,
        source: "website_form",
        lead_type: "contact_form",
        payload: leadPayload
      };
      const { data: leadRow, error: leadError } = await admin.from("leads").insert(leadInsert).select("id").maybeSingle();
      if (!leadError && leadRow?.id) {
        leadId = leadRow.id as string;
      }
    } else {
      const reservationPayload = payloadResult.data as z.infer<typeof ReservationPayloadSchema>;
      const restaurant = await ensureRestaurantBootstrap(admin, site.business_id);
      if (!restaurant) {
        return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
      }

      const settings = await getOrCreateReservationSettings(admin, site.business_id);
      const startAt = localDateTimeStringToUtcDate(
        reservationPayload.date,
        reservationPayload.time,
        restaurant.timezone ?? "Europe/Belgrade"
      );

      if (!startAt) {
        return NextResponse.json({ error: "Invalid reservation date or time" }, { status: 400 });
      }

      const leadAndMaxValidation = validateLeadAndMaxDays(startAt, settings);
      if (!leadAndMaxValidation.ok) {
        return NextResponse.json({ error: leadAndMaxValidation.message, code: leadAndMaxValidation.code }, { status: 400 });
      }

      const partySize = toReservationPartySize(reservationPayload.party_size);
      const endAt = new Date(startAt.getTime() + settings.default_duration_min * 60_000);
      const overlaps = await loadCapacityRelevantReservations(admin, {
        restaurantId: site.business_id,
        intervalStart: startAt,
        intervalEnd: endAt,
        settings
      });
      const usedCapacity = computeUsedCapacityForInterval(overlaps, startAt, endAt, settings);

      if (usedCapacity + partySize > restaurant.total_capacity) {
        return NextResponse.json(
          {
            error: "Not enough capacity at that time.",
            code: "capacity_conflict",
            remainingCapacity: Math.max(restaurant.total_capacity - usedCapacity, 0)
          },
          { status: 409 }
        );
      }

      const { data: reservationRow, error: reservationError } = await admin
        .from("reservations")
        .insert({
          restaurant_id: site.business_id,
          business_id: site.business_id,
          conversation_id: null,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          datetime: startAt.toISOString(),
          party_size: partySize,
          customer_name: reservationPayload.name,
          customer_phone: reservationPayload.phone ?? reservationPayload.email ?? "website",
          customer_email: reservationPayload.email ?? null,
          notes: reservationPayload.notes?.trim() || "Website reservation form",
          status: "pending",
          created_by: "widget"
        })
        .select("id")
        .single();

      if (reservationError || !reservationRow?.id) {
        return NextResponse.json({ error: reservationError?.message ?? "Failed to create reservation" }, { status: 500 });
      }

      reservationId = reservationRow.id as string;

      try {
        await sendReservationSmsAlert({
          adminClient: admin,
          businessId: site.business_id,
          reservationId,
          name: reservationPayload.name,
          date: reservationPayload.date,
          time: reservationPayload.time,
          guests: partySize,
          phone: reservationPayload.phone ?? null
        });
      } catch {
        log("warn", "Reservation SMS alert threw unexpectedly", {
          businessId: site.business_id,
          reservationId
        });
      }
    }

    const { data: submission, error: insertError } = await admin
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

    if (form_type === "contact" && leadId) {
      const contactPayload = payloadResult.data as z.infer<typeof ContactPayloadSchema>;
      await admin
        .from("leads")
        .update({
          payload: {
            source: "website_form",
            form_type: "contact",
            site_id: site.id,
            submission_id: submission.id,
            message: contactPayload.message
          }
        })
        .eq("id", leadId)
        .eq("business_id", site.business_id);
    }

    if (analytics?.sessionId && analytics.pagePath) {
      const baseAnalyticsPayload = {
        businessId: site.business_id,
        siteId: site.id,
        pagePath: analytics.pagePath,
        pageTitle: analytics.pageTitle ?? null,
        sessionId: analytics.sessionId,
        referrer: analytics.referrer ?? null,
        userAgent: request.headers.get("user-agent")
      };

      if (form_type === "contact") {
        await insertWebsiteAnalyticsEvent(admin, {
          ...baseAnalyticsPayload,
          eventType: "lead_submitted",
          channel: "form",
          leadType: "form",
          leadId
        });
      } else {
        await insertWebsiteAnalyticsEvent(admin, {
          ...baseAnalyticsPayload,
          eventType: "reservation_started",
          channel: "form"
        });
        await insertWebsiteAnalyticsEvent(admin, {
          ...baseAnalyticsPayload,
          eventType: "reservation_completed",
          channel: "form"
        });
      }
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
        cta_label: form_type === "reservation" ? "View reservations" : leadId ? "View lead" : "Open leads",
        cta_url: form_type === "reservation" ? "/dashboard/reservations" : leadId ? `/dashboard/leads/${leadId}` : "/dashboard/leads",
        data: {
          site_id: site.id,
          form_type,
          name: payloadResult.data.name,
          reservation_id: reservationId,
          lead_id: leadId
        }
      },
      "site_form_submission",
      reservationId ?? leadId ?? submission.id
    );

    return NextResponse.json({ ok: true, leadId, reservationId });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    console.error("[SITE_FORM_SUBMIT_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit form" }, { status: 500 });
  }
}
