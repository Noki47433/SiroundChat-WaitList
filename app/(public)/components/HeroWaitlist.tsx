"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

type WaitlistResponse = {
  ok?: boolean;
  error?: string;
};

export default function HeroWaitlist() {
  const searchParams = useSearchParams();
  const isBlocked = searchParams.get("blocked") === "1";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await response.json().catch(() => null)) as WaitlistResponse | null;

      if (response.ok && data?.ok) {
        setSuccess(true);
        setEmail("");
        return;
      }

      setError(data?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-[92vh] items-center px-6 pb-10 pt-16 sm:px-8 sm:pt-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[20%] top-8 h-40 rounded-full bg-amber-300/35 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/2 h-36 w-[65%] -translate-x-1/2 rounded-full bg-yellow-200/70 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl">
        {isBlocked ? (
          <div className="mb-6 rounded-2xl border border-amber-300/45 bg-white/80 px-4 py-3 text-sm text-amber-800 backdrop-blur-xl">
            This area isn&apos;t public yet &mdash; join the waitlist.
          </div>
        ) : null}
        <div className="overflow-hidden rounded-[2rem] border border-amber-300/35 bg-white/75 shadow-[0_28px_60px_-40px_rgba(217,119,6,0.65)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-amber-200/35 bg-white/70 px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <Image
                alt="SiroundChat logo"
                src="/images-logo/SiroundChatLogo.png"
                width={34}
                height={34}
                className="h-8 w-8 rounded-full object-contain shadow-[0_0_18px_rgba(245,158,11,0.45)]"
              />
              <p className="text-xl font-semibold tracking-tight text-amber-700">SiroundChat</p>
            </div>
            <div className="hidden items-center gap-8 text-sm text-amber-700/80 md:flex">
              <span>Early Access</span>
              <span>Waitlist</span>
            </div>
            <button
              type="button"
              className="h-9 rounded-xl border border-amber-300/45 bg-white/75 px-3 text-xs font-medium text-amber-700"
            >
              Menu
            </button>
          </div>

          <div className="relative px-5 pb-8 pt-12 sm:px-8 sm:pb-10 sm:pt-14 md:px-12 md:pt-16">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">Get early access</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Turn missed messages into booked customers.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">
              SiroundChat answers questions, captures leads, and takes bookings &mdash; automatically.
            </p>

            <div className="mt-6 grid max-w-2xl gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <p className="flex items-center gap-2 rounded-full border border-amber-300/35 bg-white/80 px-3 py-2 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Faster first replies
              </p>
              <p className="flex items-center gap-2 rounded-full border border-amber-300/35 bg-white/80 px-3 py-2 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Better lead capture
              </p>
            </div>

            <form className="mt-10 max-w-3xl" onSubmit={handleSubmit}>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="waitlist-email">
                Email address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="waitlist-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="h-12 w-full rounded-2xl border border-amber-300/45 bg-white/90 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/35"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-400 to-yellow-300 px-6 text-sm font-semibold text-amber-900 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(245,158,11,0.9)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Joining..." : "Join the waitlist"}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-600">No spam. Early-access invites only.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <p
                  aria-live="polite"
                  className="min-h-11 rounded-2xl border border-emerald-300/45 bg-white/80 px-4 py-3 text-sm text-emerald-700 backdrop-blur"
                >
                  {success ? "You are on the list. We will reach out soon." : ""}
                </p>
                <p
                  aria-live="polite"
                  className="min-h-11 rounded-2xl border border-rose-300/45 bg-white/80 px-4 py-3 text-sm text-rose-700 backdrop-blur"
                >
                  {error}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
