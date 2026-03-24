import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CHATBOT_DESTINATION = "/dashboard/chatbot/sales";
const CHATBOT_STEPS = [
  "Set your business context and FAQ answers.",
  "Define lead capture and booking prompts.",
  "Activate chatbot sales rules.",
  "Monitor conversations from your dashboard."
];
const CHATBOT_BENEFITS = [
  "Faster replies, even outside business hours.",
  "More consistent lead capture from web visitors.",
  "Clear handoff path for high-value conversations.",
  "Central place to tune answers and sales prompts."
];
const CHATBOT_STATS = [
  {
    id: "chatbot-savings",
    badge: "$11B",
    value: "in annual cost savings was projected for chatbots by 2023.",
    sourceLabel: "Juniper Research press release",
    sourceHref:
      "https://www.juniperresearch.com/press/chatbots-to-deliver-11bn-cost-savings-2023/"
  }
];

export default async function BuildChatbotPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const ctaHref = user
    ? CHATBOT_DESTINATION
    : `/auth?next=${encodeURIComponent(CHATBOT_DESTINATION)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7D507] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-14 h-72 w-72 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[44%] w-full bg-gradient-to-t from-white/30 to-transparent" />
        <div className="absolute left-0 top-0 h-full w-[30%] bg-white/20 [clip-path:polygon(0_0,100%_0,68%_100%,0_100%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-[38px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.14)] lg:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 -top-10 h-44 w-44 rounded-full bg-amber-200/50 blur-3xl" />
          </div>
          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-600">Build / Chatbot</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Launch an AI chatbot for your business
              </h1>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                Answer customer questions instantly, capture leads, and route high-intent chats to your team.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href={ctaHref}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-7 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30"
                >
                  Get Started
                </Link>
                <p className="text-sm text-slate-500">Deploy quickly with your own tone and FAQ logic.</p>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-900/10 bg-[#131625] p-4 shadow-[0_20px_46px_rgba(15,23,42,0.32)]">
              <div className="mb-3 flex items-center gap-2 rounded-[16px] bg-black/20 px-3 py-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="rounded-[20px] border border-white/10 bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-3 text-slate-900">
                <p className="text-sm font-semibold">Luna Bistro</p>
                <p className="text-xs">Online</p>
              </div>
              <div className="mt-4 space-y-3 rounded-[24px] border border-white/10 bg-[#0D1329] p-4">
                <div className="w-[78%] rounded-2xl bg-white/15 px-3 py-2 text-sm text-slate-100">Hi! How can I help today?</div>
                <div className="ml-auto w-[72%] rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-right text-sm text-slate-900">
                  Do you take reservations?
                </div>
                <div className="w-[82%] rounded-2xl bg-white/15 px-3 py-2 text-sm text-slate-100">
                  Yes, reserve online anytime using our booking form.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[34px] border border-white/80 bg-[#FFF7DF]/95 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-8">
          <h2 className="text-3xl font-semibold text-slate-900">How it works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {CHATBOT_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-white/90 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.07)]"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-slate-900">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[34px] border border-slate-900/10 bg-[#141726] p-7 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] sm:p-8">
          <h2 className="text-3xl font-semibold">What&apos;s in it for your business</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {CHATBOT_BENEFITS.map((benefit) => (
              <div
                key={benefit}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 px-4 py-3 text-sm text-slate-200"
              >
                {benefit}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-white/80 bg-[#FFF7DF]/95 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-8">
          <h2 className="text-3xl font-semibold text-slate-900">Real statistics</h2>
          <div className="mt-5 space-y-4">
            {CHATBOT_STATS.map((stat) => (
              <article
                key={stat.id}
                className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.09)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="inline-flex w-fit rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-slate-900">
                    {stat.badge}
                  </span>
                  <p className="text-xl font-medium leading-snug text-slate-800">{stat.value}</p>
                </div>
                <p className="mt-3 text-[13px] text-slate-500">
                  Source:{" "}
                  <a href={stat.sourceHref} target="_blank" rel="noreferrer" className="underline">
                    {stat.sourceLabel}
                  </a>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-white/80 bg-white/95 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.11)]">
          <h2 className="text-3xl font-semibold text-slate-900">Ready to set up your chatbot?</h2>
          <p className="mt-3 text-base text-slate-600">Start from your dashboard and go live quickly.</p>
          <Link
            href={ctaHref}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-8 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30"
          >
            Get Started
          </Link>
        </section>
      </div>
    </main>
  );
}
