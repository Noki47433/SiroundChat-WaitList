import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data?.user) {
    redirect("/dashboard/builder");
  }

  return <OnboardingClient />;
}
