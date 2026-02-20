"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resolveRedirectPath } from "@/lib/utils/redirect";

type LoginFormProps = {
  redirect?: string;
};

export function LoginForm({ redirect }: LoginFormProps) {
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectPath = resolveRedirectPath(redirect, "/");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          redirect: redirectPath
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Login failed. Check your details.";
        setError(message);
        push({ title: "Login failed", message, variant: "error" });
        return;
      }

      const next = resolveRedirectPath(payload?.redirect, redirectPath);
      push({ title: "Welcome back", message: "Redirecting you now.", variant: "success" });
      router.push(next);
    } catch (err) {
      console.error(err);
      setError("Login failed. Double-check your details.");
      push({ title: "Login failed", message: "Please double-check your details.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-white/60">Email</label>
        <Input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
      </div>
      <div>
        <label className="text-sm text-white/60">Password</label>
        <Input
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in..." : "Login"}
      </Button>
    </form>
  );
}
