'use client';

import { Hero } from "./Hero";
import { Navbar } from "./Navbar";
import { LogoStrip } from "./LogoStrip";
import { FeatureMatrix } from "./FeatureMatrix";
import { SectionSplit } from "./SectionSplit";
import { UseCasesCarousel } from "./UseCasesCarousel";
import { DeveloperSection } from "./DeveloperSection";
import { PricingTeaser } from "./PricingTeaser";
import { StartupsSection } from "./StartupsSection";
import { Footer } from "./Footer";
import { ShowcaseRail } from "./ShowcaseRail";
import { useSectionObserver } from "../hooks/useSectionObserver";
import { NoWebsiteSection } from "./NoWebsiteSection";
import { ChatbotLandingSection } from "@/app/components/chatbot/ChatbotLandingSection";

const trackedSections = [
  "hero",
  "no-website",
  "chatbot",
  "features",
  "docs",
  "global-support",
  "analytics",
  "use-cases",
  "developers",
  "pricing",
  "startups"
] as const;

type SectionId = (typeof trackedSections)[number];

const SectionAnchor = ({ id }: { id: SectionId }) => (
  <div data-section-id={id} aria-hidden className="section-anchor h-px -mt-24" />
);

type HomeContentProps = {
  isLoggedIn?: boolean;
};

export function HomeContent({ isLoggedIn }: HomeContentProps) {
  const { activeSection } = useSectionObserver(trackedSections);

  return (
    <>
      <Navbar isLoggedIn={isLoggedIn} />
      <div className="px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl lg:max-w-7xl">
          <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)] lg:gap-14">
            <main className="space-y-24 lg:space-y-32">
              <SectionAnchor id="hero" />
              <Hero isLoggedIn={isLoggedIn} />
              <SectionAnchor id="no-website" />
              <NoWebsiteSection />
              <SectionAnchor id="chatbot" />
              <ChatbotLandingSection />
              <LogoStrip />
              <SectionAnchor id="features" />
              <FeatureMatrix />
              <SectionAnchor id="docs" />
              <SectionSplit
                id="docs"
                eyebrow="Train SiroundChat in minutes"
                title="Onboard your knowledge without the busywork."
                body="Upload files, connect knowledge bases, and sync historic tickets. SiroundChat understands your product instantly and keeps learning without extra tagging."
                primaryCta={{ label: "Connect data", href: "#get-started" }}
                secondaryCta={{ label: "See integrations", href: "#docs" }}
              />
              <SectionAnchor id="global-support" />
              <SectionSplit
                id="global-support"
                eyebrow="Accept & optimize requests globally"
                title="Route every conversation to the right brain - human or AI."
                body="SiroundChat triages every channel, hands off gracefully, and shares transcripts with perfect context so no customer waits for a human handoff."
                primaryCta={{ label: "Automate routing", href: "#get-started" }}
                secondaryCta={{ label: "See it live", href: "#demo" }}
              />
              <SectionAnchor id="analytics" />
              <SectionSplit
                id="analytics"
                eyebrow="Capture recurring value"
                title="Turn conversations into insights, automations, and revenue."
                body="Roll up every customer moment into dashboards that highlight trends, CSAT shifts, and automation wins so your team keeps improving."
                primaryCta={{ label: "Explore analytics", href: "#get-started" }}
                secondaryCta={{ label: "Download sample report", href: "#docs" }}
              />
              <SectionAnchor id="use-cases" />
              <UseCasesCarousel />
              <section className="rounded-3xl border border-white/10 bg-white/80 p-8 text-brand-dark shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-500">How SiroundChat works</p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight">
                  1) Create an account. 2) Pick a template. 3) Launch your AI chat + website in minutes.
                </h2>
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  {[
                    {
                      title: "Create account",
                      body: "Tell us your business name and we auto-create your dashboard."
                    },
                    {
                      title: "Generate website",
                      body: "Choose a Kosovo / Albania friendly template with Albanian text included."
                    },
                    {
                      title: "Chat goes live",
                      body: "We give you a link + auto-install option so you never copy code."
                    }
                  ].map((step) => (
                    <div key={step.title} className="rounded-2xl bg-white p-4 shadow-inner">
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm text-muted">{step.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-dashed border-amber-400/50 p-4 text-sm">
                  <p className="font-semibold">For Kosovo & Albania</p>
                  <p className="text-muted">
                    Most owners say &quot;po po&quot; when they are unsure. SiroundChat removes the stress by letting us install
                    everything for you. We can even create the whole site if you send a WhatsApp voice note.
                  </p>
                </div>
              </section>
              <SectionAnchor id="developers" />
              <DeveloperSection />
              <SectionAnchor id="pricing" />
              <PricingTeaser />
              <SectionAnchor id="startups" />
              <StartupsSection />
              <section className="rounded-3xl border border-white/10 bg-white/80 p-8 text-brand-dark">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-500">FAQ</p>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      q: "Do I need to know coding?",
                      a: "No. SiroundChat installs the website and chat widget for you. We can even jump on a WhatsApp call and do it live."
                    },
                    {
                      q: "Can you create the website for me?",
                      a: 'Yes. Choose "We create it for you" during onboarding and our team will build and publish it.'
                    },
                    {
                      q: "Can I cancel anytime?",
                      a: "Of course. You can stay on the free plan forever or upgrade when you see the value."
                    }
                  ].map((item) => (
                    <div key={item.q} className="rounded-2xl bg-white p-5 shadow-soft">
                      <p className="text-lg font-semibold">{item.q}</p>
                      <p className="mt-2 text-sm text-muted">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            </main>

            <ShowcaseRail activeSection={activeSection} />
          </div>

          <Footer />
        </div>
      </div>
    </>
  );
}
