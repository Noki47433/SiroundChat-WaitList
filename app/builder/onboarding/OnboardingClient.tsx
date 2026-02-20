"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/db/schema";

export default function OnboardingClient() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClientComponentClient<Database>(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const next = searchParams?.get("next") ?? "/builder/onboarding";

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    setLoading(false);
    if (error) alert(error.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    setLoading(false);

    if (error) alert(error.message);
    else alert("Check your email for the sign-in link");
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Website Builder</h1>
      <p className="mt-2 text-sm text-neutral-600">Sign in to continue.</p>

      <div className="mt-6 space-y-4">
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="h-11 w-full rounded-xl border px-4"
        >
          Continue with Google
        </button>

        <form onSubmit={signInWithEmail} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border px-3"
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="h-11 w-full rounded-xl bg-black text-white"
          >
            Send magic link
          </button>
        </form>
      </div>
    </div>
  );
}
