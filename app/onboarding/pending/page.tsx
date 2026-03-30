import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getOwnedBusinessAccess } from "@/lib/server/launch-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPendingPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth?next=%2Fonboarding%2Fpending");
  }

  const business = await getOwnedBusinessAccess(user.id);

  if (business?.access_approved) {
    redirect("/dashboard");
  }

  if (!business?.onboarding_submitted) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center justify-center">
        <Card className="w-full rounded-[32px] border-white/10 bg-[#0f131a] p-8 text-center sm:p-10">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Application received</p>
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            You&apos;re on the waitlist
          </h1>
          <p className="mt-4 text-base text-white/65">
            We&apos;re reviewing your business. You&apos;ll be activated shortly.
          </p>
        </Card>
      </div>
    </div>
  );
}
