import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { IndustrySchema } from "@/lib/validation/auth";
import { getOwnedBusinessAccess } from "@/lib/server/launch-access";
import { ensureBusinessRow } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SubmitOnboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required."),
  industry: IndustrySchema,
  description: z.string().trim().min(10, "Description is required."),
  website: z.string().trim().url("Website must be a valid URL.").or(z.literal("")),
  phone: z.string().trim().min(5, "Phone number is required."),
  city: z.string().trim().min(2, "City / location is required.")
});

const extractValidationErrorMessage = (flattened: {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}) => {
  const firstFormError = flattened.formErrors.find(Boolean);
  if (firstFormError) return firstFormError;

  for (const fieldErrors of Object.values(flattened.fieldErrors)) {
    const firstFieldError = fieldErrors?.find(Boolean);
    if (firstFieldError) return firstFieldError;
  }

  return "Please check your business details and try again.";
};

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = SubmitOnboardingSchema.safeParse(payload);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return NextResponse.json(
      {
        error: extractValidationErrorMessage(flattened),
        fieldErrors: flattened.fieldErrors
      },
      { status: 400 }
    );
  }

  let business = await getOwnedBusinessAccess(user.id);
  if (!business?.id) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackBusinessName =
      (typeof metadata.business_name === "string" && metadata.business_name.trim()) ||
      (typeof metadata.businessName === "string" && metadata.businessName.trim()) ||
      parsed.data.businessName;

    await ensureBusinessRow({
      userId: user.id,
      businessName: fallbackBusinessName,
      industry: parsed.data.industry
    });

    business = await getOwnedBusinessAccess(user.id);
  }

  if (!business?.id) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClientIfAvailable() as any;
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const onboardingData = {
    businessName: parsed.data.businessName,
    industry: parsed.data.industry,
    description: parsed.data.description,
    website: parsed.data.website,
    phone: parsed.data.phone,
    city: parsed.data.city
  };

  const { error: updateError } = await admin
    .from("businesses")
    .update({
      business_name: parsed.data.businessName,
      industry: parsed.data.industry,
      website_url: parsed.data.website || null,
      phone: parsed.data.phone,
      city: parsed.data.city,
      onboarding_submitted: true,
      onboarding_data: onboardingData,
      access_approved: false,
      launch_access: false,
      updated_at: now
    })
    .eq("id", business.id)
    .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`);

  if (updateError) {
    return NextResponse.json({ error: "Unable to submit onboarding." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
