import { NextResponse } from "next/server";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import {
  normalizeOptionalUrl,
  normalizeStoredEmail
} from "@/lib/server/invite-access";
import { RequestAccessSchema } from "@/lib/validation/access";
import { RateLimitError, enforceRateLimit } from "@/lib/utils/rate-limit";

const getRequestIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
};

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = RequestAccessSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const admin = getSupabaseAdminClientIfAvailable() as any;
    if (!admin) {
      console.error("[ACCESS_REQUEST_CONFIG_MISSING]");
      return NextResponse.json({ error: "Request access is unavailable right now." }, { status: 500 });
    }

    const ip = getRequestIp(request);
    const normalizedEmail = normalizeStoredEmail(parsed.data.email);

    await enforceRateLimit({
      key: `access-request:${ip}:${normalizedEmail}`,
      limit: 5,
      windowInSeconds: 60 * 60
    });

    const { data: existing, error: existingError } = await admin
      .from("access_requests")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          message: "We already have your request and will review it shortly."
        },
        { status: 200 }
      );
    }

    const { error } = await admin.from("access_requests").insert({
      business_name: parsed.data.businessName,
      owner_name: parsed.data.ownerName || null,
      email: normalizedEmail,
      phone: parsed.data.phone || null,
      website_url: normalizeOptionalUrl(parsed.data.websiteUrl),
      instagram_url: normalizeOptionalUrl(parsed.data.instagramUrl),
      business_type: parsed.data.businessType || null,
      note: parsed.data.note || null,
      status: "pending"
    });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Thanks. If approved, we’ll send you an invite code."
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    console.error("[ACCESS_REQUEST_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: "Request access is unavailable right now." },
      { status: 500 }
    );
  }
}
