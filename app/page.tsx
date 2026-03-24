import { getSupabaseServerClient } from "@/lib/supabase/server";
import { HomeContent } from "@/components/HomeContent";
import HeroShaderGradient from "./_components/HeroShaderGradient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-[#fffef8] via-[#fffdf4] to-[#fff8e8] text-slate-900">
      <HeroShaderGradient />
      <div className="relative z-10">
        <HomeContent isLoggedIn={Boolean(user)} />
      </div>
    </main>
  );
}
