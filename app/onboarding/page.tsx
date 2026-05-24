import { redirect } from "next/navigation";
import { OnboardingForm } from "@/app/onboarding/_components/OnboardingForm";
import { ensureBusinessRow } from "@/lib/tenant";
import { getOwnedBusinessAccess } from "@/lib/server/launch-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth?next=%2Fonboarding");
  }

  let business = await getOwnedBusinessAccess(user.id);

  if (!business?.id) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackBusinessName =
      (typeof metadata.business_name === "string" && metadata.business_name.trim()) ||
      (typeof metadata.businessName === "string" && metadata.businessName.trim()) ||
      "Your business";

    await ensureBusinessRow({
      userId: user.id,
      businessName: fallbackBusinessName
    });

    business = await getOwnedBusinessAccess(user.id);
  }

  if (business?.access_approved || business?.launch_access) {
    redirect("/dashboard");
  }

  if (business?.onboarding_submitted) {
    redirect("/onboarding/pending");
  }

  const onboardingData =
    business?.onboarding_data && typeof business.onboarding_data === "object" && !Array.isArray(business.onboarding_data)
      ? (business.onboarding_data as Record<string, unknown>)
      : {};

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <OnboardingForm
          initialValues={{
            businessName: business?.business_name?.trim() || "",
            industry:
              (business?.industry?.trim() ||
                (typeof onboardingData.industry === "string" ? onboardingData.industry : "")).trim() ||
              "other",
            description: typeof onboardingData.description === "string" ? onboardingData.description : "",
            website:
              business?.website_url?.trim() ||
              (typeof onboardingData.website === "string" ? onboardingData.website : ""),
            phone:
              business?.phone?.trim() || (typeof onboardingData.phone === "string" ? onboardingData.phone : ""),
            city:
              business?.city?.trim() || (typeof onboardingData.city === "string" ? onboardingData.city : "")
          }}
        />
      </div>
    </div>
  );
}
