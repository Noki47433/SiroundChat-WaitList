'use client';

import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { NoWebsiteSection } from "./NoWebsiteSection";
import { ShowcaseRail } from "./ShowcaseRail";
import { useSectionObserver } from "../hooks/useSectionObserver";
import { ChatbotLandingSection } from "@/app/components/chatbot/ChatbotLandingSection";
import { useAuth } from "@/hooks/useAuth";

type HomeContentProps = {
  isLoggedIn?: boolean;
};

const businessBenefits = [
  "Answer customer questions quickly and reduce missed leads.",
  "Launch and update your website without a long dev cycle.",
  "Manage website and chatbot workflows from one dashboard."
];

const stats = [
  {
    id: "credibility",
    badge: "75%",
    metric: "75%",
    statement: "of users judge a company's credibility based on its website design.",
    sourceLabel: "Stanford Web Credibility Research",
    sourceHref: "https://credibility.stanford.edu/",
    accent: "from-sky-500 to-indigo-500"
  },
  {
    id: "mobile-speed",
    badge: "46.1%",
    metric: "46.1%",
    statement: "of credibility comments in Stanford's web credibility study referenced the site's design look.",
    sourceLabel: "Stanford Web Credibility Study",
    sourceHref: "https://credibility.stanford.edu/",
    accent: "from-amber-500 to-yellow-500"
  },
  {
    id: "chatbot-savings",
    badge: "$11B",
    metric: "$11B",
    statement: "Chatbots were projected to deliver $11B in annual cost savings by 2023.",
    sourceLabel: "Juniper Research press release",
    sourceHref: "https://www.juniperresearch.com/press/chatbots-to-deliver-11bn-cost-savings-2023/",
    accent: "from-violet-500 to-fuchsia-500"
  }
];

const trackedSections = [
  "hero",
  "no-website",
  "chatbot",
  "features",
  "analytics"
] as const;

const SectionAnchor = ({ id }: { id: (typeof trackedSections)[number] }) => (
  <div data-section-id={id} aria-hidden className="section-anchor h-px -mt-24" />
);

export function HomeContent({ isLoggedIn }: HomeContentProps) {
  const { user } = useAuth();
  const { activeSection } = useSectionObserver(trackedSections);
  const resolvedIsLoggedIn = isLoggedIn ?? Boolean(user);

  return (
    <>
      <Navbar isLoggedIn={resolvedIsLoggedIn} />
      <div className="px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1480px] md:pr-[360px] lg:pr-[560px] xl:pr-[620px]">
          <main className="space-y-16 lg:min-w-0 lg:max-w-[860px]">
              <SectionAnchor id="hero" />
              <Hero isLoggedIn={resolvedIsLoggedIn} />

              <SectionAnchor id="no-website" />
              <div id="website-builder">
                <NoWebsiteSection />
              </div>

              <SectionAnchor id="chatbot" />
              <div id="chatbot">
                <ChatbotLandingSection />
              </div>

              <SectionAnchor id="features" />
              <section
                id="business-value"
                className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[#F5F1E2]/95 p-6 text-brand-dark shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8"
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-14 top-8 h-44 w-44 rounded-full bg-amber-200/35 blur-3xl" />
                  <div className="absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-indigo-100/50 blur-3xl" />
                </div>
                <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-amber-500">What&apos;s in it for your business</p>
                    <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Why this helps your business grow faster</h2>
                    <ul className="mt-7 space-y-3">
                      {businessBenefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/65 px-4 py-3 text-base text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_28px_rgba(15,23,42,0.06)]"
                        >
                          <span className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[32px] border border-white/80 bg-[#ECECEC]/90 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_40px_rgba(15,23,42,0.1)]">
                    <p className="text-sm text-slate-500">Budget</p>
                    <p className="mt-1 text-5xl font-semibold tracking-tight text-slate-900">$30.739</p>
                    <div className="mt-3 inline-flex items-center rounded-full border border-white/80 bg-white/75 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                      + $317
                    </div>
                    <div className="mt-6 rounded-2xl border border-white/70 bg-gradient-to-b from-white/95 to-[#EEF0F5] p-4">
                      <div className="relative h-28 overflow-hidden rounded-xl bg-[#EEF2FA]">
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-indigo-500/45 via-indigo-400/25 to-transparent" />
                        <svg
                          viewBox="0 0 280 112"
                          aria-hidden
                          className="absolute inset-0 h-full w-full"
                          preserveAspectRatio="none"
                        >
                          <path d="M0 92 L38 92 L72 66 L104 66 L136 38 L170 48 L202 42 L238 50 L280 18" fill="none" stroke="#3156E0" strokeWidth="3" />
                        </svg>
                        <div className="absolute left-[48%] top-[37%] h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-white shadow-[0_0_16px_rgba(49,86,224,0.65)]" />
                        <div className="absolute left-[43%] top-[14%] rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_12px_22px_rgba(79,70,229,0.35)]">
                          $750
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-7 text-center text-xs text-slate-500">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <SectionAnchor id="analytics" />
              <section
                id="statistics"
                className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[#F5F1E2]/95 p-6 text-brand-dark shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8"
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-amber-100/40 blur-3xl" />
                </div>
                <div className="relative">
                  <p className="text-sm font-semibold uppercase tracking-wide text-amber-500">Real statistics</p>
                  <div className="mt-5 space-y-4">
                    {stats.map((stat) => (
                      <article
                        key={stat.id}
                        className="rounded-[28px] border border-white/80 bg-[#EEF0F4]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_16px_36px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div
                            className={`inline-flex h-11 shrink-0 items-center rounded-2xl bg-gradient-to-r px-4 text-sm font-semibold text-white shadow-md ${stat.accent}`}
                          >
                            {stat.badge}
                          </div>
                          <div>
                            {stat.metric ? (
                              <p className="text-[2rem] leading-none text-slate-800 sm:text-[2.4rem]">{stat.metric}</p>
                            ) : null}
                            <p className={`${stat.metric ? "mt-1" : "mt-0.5"} text-2xl font-medium leading-snug text-slate-800`}>
                              {stat.statement}
                            </p>
                            <p className="mt-3 text-[13px] text-slate-500">
                              Source:{" "}
                              <a href={stat.sourceHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                {stat.sourceLabel}
                              </a>
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
          </main>

          <Footer />
        </div>
      </div>
      <div className="pointer-events-none fixed right-4 top-24 z-30 hidden w-[340px] md:block lg:right-8 lg:w-[460px] xl:right-10 xl:w-[500px]">
        <div className="pointer-events-auto">
          <ShowcaseRail activeSection={activeSection} />
        </div>
      </div>
    </>
  );
}
