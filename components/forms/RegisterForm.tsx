"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveRedirectPath } from "@/lib/utils/redirect";

type RegisterFormProps = {
  redirect?: string;
  variant?: "dark" | "light";
  compact?: boolean;
};

export default function RegisterForm({ redirect, variant = "dark", compact = false }: RegisterFormProps) {
  const router = useRouter();
  const redirectPath = resolveRedirectPath(redirect, "/dashboard");
  const isLight = variant === "light";

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          email,
          password,
          redirect: redirectPath
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Registration failed.";
        setErrorMsg(message);
        return;
      }

      const next = resolveRedirectPath(payload?.redirect, redirectPath);
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "" : "mx-auto w-full max-w-md px-6 py-10"}>
      <h1 className={`text-2xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>Create your account</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className={`text-sm ${isLight ? "text-slate-600" : "text-white/80"}`}>Business name</label>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              isLight
                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-amber-400/70"
                : "border-white/10 bg-black/30 text-white placeholder:text-white/40 focus:ring-[#00A3FF]/70"
            }`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            autoComplete="organization"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={`text-sm ${isLight ? "text-slate-600" : "text-white/80"}`}>Email</label>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              isLight
                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-amber-400/70"
                : "border-white/10 bg-black/30 text-white placeholder:text-white/40 focus:ring-[#00A3FF]/70"
            }`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={`text-sm ${isLight ? "text-slate-600" : "text-white/80"}`}>Password</label>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              isLight
                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-amber-400/70"
                : "border-white/10 bg-black/30 text-white placeholder:text-white/40 focus:ring-[#00A3FF]/70"
            }`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={`text-sm ${isLight ? "text-slate-600" : "text-white/80"}`}>Confirm password</label>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              isLight
                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-amber-400/70"
                : "border-white/10 bg-black/30 text-white placeholder:text-white/40 focus:ring-[#00A3FF]/70"
            }`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {errorMsg ? <p className={`text-sm ${isLight ? "text-red-500" : "text-red-400"}`}>{errorMsg}</p> : null}

        <button
          disabled={loading}
          className={`w-full py-2 font-semibold disabled:opacity-60 ${
            isLight
              ? "rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-lg shadow-amber-500/25 hover:from-yellow-500 hover:to-amber-500"
              : "rounded-lg bg-white text-black"
          }`}
          type="submit"
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <p className={`text-sm ${isLight ? "text-slate-500" : "text-white/60"}`}>
          Already have an account?{" "}
          <Link href="/login" className={`font-semibold ${isLight ? "text-amber-600 hover:text-amber-700" : "text-white hover:text-white/80"}`}>
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
