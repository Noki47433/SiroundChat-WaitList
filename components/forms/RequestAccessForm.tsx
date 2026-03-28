"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type RequestAccessFormProps = {
  initialEmail?: string;
};

type FormState = {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  websiteUrl: string;
  instagramUrl: string;
  businessType: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  businessName: "",
  ownerName: "",
  email: "",
  phone: "",
  websiteUrl: "",
  instagramUrl: "",
  businessType: "",
  note: ""
};

export default function RequestAccessForm({ initialEmail = "" }: RequestAccessFormProps) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, email: initialEmail });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(form.businessName.trim() && form.email.trim() && (form.websiteUrl.trim() || form.instagramUrl.trim())),
    [form]
  );

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Unable to submit your request right now.");
        return;
      }

      setSuccessMessage(payload?.message ?? "Your request is in review.");
      setForm((current) => ({ ...EMPTY_FORM, email: current.email }));
    } catch {
      setErrorMessage("Unable to submit your request right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Business name</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.businessName}
            onChange={(event) => updateField("businessName", event.target.value)}
            placeholder="Acme Studio"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Owner name</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.ownerName}
            onChange={(event) => updateField("ownerName", event.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Business email</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="hello@business.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Phone</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            autoComplete="tel"
            placeholder="+383 44 000 000"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Website</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.websiteUrl}
            onChange={(event) => updateField("websiteUrl", event.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Instagram</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.instagramUrl}
            onChange={(event) => updateField("instagramUrl", event.target.value)}
            placeholder="https://instagram.com/yourbusiness"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Business type</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.businessType}
            onChange={(event) => updateField("businessType", event.target.value)}
            placeholder="Restaurant, clinic, salon..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600">Why do you want access?</label>
          <textarea
            className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={form.note}
            onChange={(event) => updateField("note", event.target.value)}
            placeholder="Share a bit about your business and what you want to launch first."
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Early access is currently limited to selected businesses. Approved businesses receive an invite code for signup.
      </div>

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Already approved?{" "}
          <Link href="/signup" className="font-semibold text-amber-600 hover:text-amber-700">
            Sign up with your invite code
          </Link>
        </p>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Request access"}
        </button>
      </div>
    </form>
  );
}
