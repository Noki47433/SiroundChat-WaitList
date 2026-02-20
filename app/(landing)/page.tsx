// Summary: Simple landing page entry that renders the main marketing content. Secondary—understand lightly unless changing landing UI routing.
import Script from "next/script";
import { HomeContent } from "@/components/HomeContent";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import LandingShader from "./_components/LandingShader.client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const authDisabled = isAuthDisabled();
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isLoggedIn = authDisabled || !!user;

  return (
    <>
      <LandingShader />
      <HomeContent isLoggedIn={isLoggedIn} />
      <Script src="http://localhost:3000/api/widget/loader?key=b23a1a09-e0b2-476a-9b47-3f37de15e7c2" strategy="afterInteractive" />
    </>
  );
}
