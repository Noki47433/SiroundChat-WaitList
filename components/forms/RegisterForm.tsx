"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveRedirectPath } from "@/lib/utils/redirect";

type RegisterFormProps = {
  redirect?: string;
};

export default function RegisterForm({ redirect }: RegisterFormProps) {
  const router = useRouter();
  const redirectPath = resolveRedirectPath(redirect, "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect: redirectPath })
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
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold">Create your account</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-white text-black py-2 font-semibold disabled:opacity-60"
          type="submit"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
