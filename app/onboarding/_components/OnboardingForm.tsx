"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRY_OPTIONS } from "@/lib/validation/auth";

type OnboardingFormProps = {
  initialValues: {
    businessName: string;
    industry: string;
    description: string;
    website: string;
    phone: string;
    city: string;
  };
};

const resolveErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Unable to submit your setup right now.";
  }

  const candidate = payload as {
    error?: unknown;
    fieldErrors?: Record<string, string[] | undefined>;
  };

  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error;
  }

  if (candidate.fieldErrors && typeof candidate.fieldErrors === "object") {
    for (const value of Object.values(candidate.fieldErrors)) {
      const firstFieldError = value?.find(Boolean);
      if (firstFieldError) return firstFieldError;
    }
  }

  return "Unable to submit your setup right now.";
};

export function OnboardingForm({ initialValues }: OnboardingFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setError(resolveErrorMessage(payload));
        return;
      }

      router.push("/onboarding/pending");
      router.refresh();
    } catch {
      setError("Unable to submit your setup right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl rounded-[32px] border-white/10 bg-[#0f131a] p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-white/45">Onboarding</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Complete your setup to activate your account
        </h1>
        <p className="text-sm text-white/60">
          Tell us about your business so the team can review and activate your dashboard access.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-white/70">Business name</label>
            <Input
              value={form.businessName}
              onChange={(event) => updateField("businessName", event.target.value)}
              placeholder="Your business"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Industry</label>
            <select
              value={form.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              className="flex h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-4 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3FF]/70"
              required
            >
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option} value={option} className="bg-neutral-950 text-white">
                  {option.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/70">Description</label>
          <Textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Tell us what your business does and how you plan to use SiroundChat."
            rows={5}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-white/70">Website</label>
            <Input
              value={form.website}
              onChange={(event) => updateField("website", event.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Phone number</label>
            <Input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="+383 44 000 000"
              autoComplete="tel"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/70">City / location</label>
          <Input
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Prishtina"
            required
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Submitting..." : "Submit for review"}
        </Button>
      </form>
    </Card>
  );
}
