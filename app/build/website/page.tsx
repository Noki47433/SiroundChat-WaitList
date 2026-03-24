import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const WEBSITE_DESTINATION = "/dashboard/builder/new";
const WEBSITE_STEPS = [
  "Enter your business basics and brand details.",
  "Choose layout and section preferences.",
  "Generate your initial website draft.",
  "Review and refine in the builder editor."
];
const WEBSITE_BENEFITS = [
  "Faster launch with fewer setup bottlenecks.",
  "Consistent brand presentation across pages.",
  "Built-in path to connect chatbot and lead capture.",
  "Simple workflow for updates after launch."
];
const WEBSITE_STATS = [
  {
    id: "credibility",
    badge: "75%",
    value: "of users judge a company's credibility based on its website design.",
    sourceLabel: "Stanford Web Credibility Research",
    sourceHref: "https://credibility.stanford.edu/"
  },
  {
    id: "design-comment",
    badge: "46.1%",
    value: "of credibility comments in Stanford's web credibility study referenced the site's design look.",
    sourceLabel: "Stanford Web Credibility Study",
    sourceHref: "https://credibility.stanford.edu/"
  }
];

export default async function BuildWebsitePage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const ctaHref = user
    ? WEBSITE_DESTINATION
    : `/auth?next=${encodeURIComponent(WEBSITE_DESTINATION)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7D507] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[42%] w-full bg-gradient-to-t from-white/30 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-[34%] bg-white/20 [clip-path:polygon(24%_0,100%_0,100%_100%,0_100%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-[38px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.14)] lg:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-14 -top-10 h-44 w-44 rounded-full bg-amber-200/55 blur-3xl" />
          </div>
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-600">Build / Website</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Generate a production-ready business website
              </h1>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                Go from idea to live draft quickly with guided setup, brand inputs, and editable sections.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href={ctaHref}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-7 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30"
                >
                  Generate Now
                </Link>
                <p className="text-sm text-slate-500">No long setup. Launch your first draft in minutes.</p>
              </div>
            </div>

            <div className="rounded-[30px] border border-amber-100/80 bg-[#FFF4C8]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_18px_40px_rgba(15,23,42,0.1)]">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-2 text-xs text-slate-500">
                <span>Site draft</span>
                <span>Ready in 2m</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Hero</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">New website for your business</p>
                  <p className="mt-1 text-xs text-slate-500">Brand text, colors, and CTA auto-generated.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">Sections</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">8</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">Edit time</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">~15m</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[34px] border border-white/80 bg-[#FFF7DF]/95 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-8">
          <h2 className="text-3xl font-semibold text-slate-900">How it works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {WEBSITE_STEPS.map((step, index) => (
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
            {WEBSITE_BENEFITS.map((benefit) => (
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
            {WEBSITE_STATS.map((stat) => (
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
          <h2 className="text-3xl font-semibold text-slate-900">Start your website draft</h2>
          <p className="mt-3 text-base text-slate-600">Generate your first version and iterate from the dashboard.</p>
          <Link
            href={ctaHref}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-8 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30"
          >
            Generate Now
          </Link>
        </section>
      </div>
    </main>
  );
}
