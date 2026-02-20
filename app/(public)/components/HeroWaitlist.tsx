"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { track } from "@/src/lib/analytics/ga";

type WaitlistResponse = {
  ok?: boolean;
  error?: string;
};

type ConfettiPiece = {
  id: number;
  left: number;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  color: string;
  opacity: number;
};

const createConfettiPieces = (): ConfettiPiece[] => {
  const colors = ["#f59e0b", "#fbbf24", "#fcd34d", "#f97316", "#fde68a"];
  return Array.from({ length: 30 }, (_, index) => ({
    id: Date.now() + index,
    left: Math.random() * 100,
    size: 5 + Math.random() * 5,
    rotation: Math.random() * 160,
    delay: Math.random() * 0.25,
    duration: 1.2 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 0.45 + Math.random() * 0.45
  }));
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function HeroWaitlist() {
  const searchParams = useSearchParams();
  const isBlocked = searchParams?.get("blocked") === "1";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const hasTrackedFormStart = useRef(false);
  const logoClicksRef = useRef<number[]>([]);
  const logoResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const founderModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (logoResetTimeoutRef.current) {
        clearTimeout(logoResetTimeoutRef.current);
      }
      if (founderModalTimeoutRef.current) {
        clearTimeout(founderModalTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showFounderModal || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showFounderModal]);

  const handleFormStart = () => {
    if (hasTrackedFormStart.current) {
      return;
    }

    hasTrackedFormStart.current = true;
    track("form_start", { form: "waitlist", field: "email" });
  };

  const handleLogoClick = () => {
    const now = Date.now();
    const recentClicks = [...logoClicksRef.current.filter((timestamp) => now - timestamp <= 4000), now];
    logoClicksRef.current = recentClicks;

    if (logoResetTimeoutRef.current) {
      clearTimeout(logoResetTimeoutRef.current);
    }
    logoResetTimeoutRef.current = setTimeout(() => {
      logoClicksRef.current = [];
    }, 4000);

    if (recentClicks.length < 5) {
      return;
    }

    logoClicksRef.current = [];
    if (logoResetTimeoutRef.current) {
      clearTimeout(logoResetTimeoutRef.current);
      logoResetTimeoutRef.current = null;
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([20, 40, 20]);
    }

    setConfettiPieces(createConfettiPieces());
    setShowFounderModal(true);

    if (founderModalTimeoutRef.current) {
      clearTimeout(founderModalTimeoutRef.current);
    }
    founderModalTimeoutRef.current = setTimeout(() => {
      setShowFounderModal(false);
    }, 4000);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError("");
    setAnalysisMessage("🤖 Analyzing business growth potential...");

    await wait(1200);
    setAnalysisMessage("📊 Founder probability: 87%");
    await wait(800);
    setAnalysisMessage("🚀 Early adopter detected.");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(20);
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await response.json().catch(() => null)) as WaitlistResponse | null;

      if (response.ok && data?.ok) {
        track("waitlist_submit", { method: "email" });
        setSuccess(true);
        setEmail("");
        return;
      }

      setError(data?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setAnalysisMessage("");
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
            <div
              className="flex cursor-pointer items-center gap-3 select-none"
              onClick={handleLogoClick}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleLogoClick();
                }
              }}
              role="button"
              tabIndex={0}
            >
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
                  onFocus={handleFormStart}
                  onChange={(event) => {
                    handleFormStart();
                    setEmail(event.target.value);
                  }}
                  placeholder="you@company.com"
                  className="h-12 w-full rounded-2xl border border-amber-300/45 bg-white/90 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/35"
                />
                <button
                  type="submit"
                  disabled={loading}
                  onClick={() => track("button_click", { id: "primary_cta", text: "Join the waitlist" })}
                  className="h-12 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-400 to-yellow-300 px-6 text-sm font-semibold text-amber-900 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(245,158,11,0.9)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Joining..." : "Join the waitlist"}
                </button>
              </div>
              <p
                aria-live="polite"
                className={`min-h-6 text-sm text-amber-700 transition-opacity duration-300 ${loading && analysisMessage ? "opacity-100" : "opacity-0"}`}
              >
                {loading && analysisMessage ? (
                  <span key={analysisMessage} className="inline-block" style={{ animation: "waitlistStatusFade 240ms ease" }}>
                    {analysisMessage}
                  </span>
                ) : null}
              </p>
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
      {showFounderModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 px-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className="absolute top-[-8%] rounded-[2px]"
                style={{
                  left: `${piece.left}%`,
                  width: `${piece.size}px`,
                  height: `${piece.size * 1.8}px`,
                  backgroundColor: piece.color,
                  opacity: piece.opacity,
                  transform: `rotate(${piece.rotation}deg)`,
                  animation: `founderConfetti ${piece.duration}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
                  animationDelay: `${piece.delay}s`
                }}
              />
            ))}
          </div>
          <div className="relative w-full max-w-md rounded-3xl border border-amber-200/50 bg-white/95 px-8 py-9 text-center shadow-[0_35px_90px_-50px_rgba(217,119,6,0.7)] backdrop-blur-xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">You&apos;re persistent.</h2>
            <p className="mt-3 text-base text-slate-700">That&apos;s how real founders win.</p>
            <p className="mt-6 text-xs uppercase tracking-[0.16em] text-amber-700/75">Screenshot this. You earned it.</p>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        @keyframes waitlistStatusFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes founderConfetti {
          0% {
            opacity: 0;
            transform: translateY(-12px) rotate(0deg);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(115vh) rotate(420deg);
          }
        }
      `}</style>
    </section>
  );
}
