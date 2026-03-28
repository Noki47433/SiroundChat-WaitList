import { Suspense } from "react";
import Link from "next/link";
import BenefitPitch from "./(public)/components/BenefitPitch";
import Footer from "./(public)/components/Footer";
import HeroWaitlist from "./(public)/components/HeroWaitlist";
import HowItWorksFAQ from "./(public)/components/HowItWorksFAQ";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#fffef8] via-[#fffdf4] to-[#fff8e8] text-slate-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_20%,rgba(251,191,36,0.1),transparent_34%)]" />
        </div>
        <div className="relative">
          <Suspense fallback={null}>
            <HeroWaitlist />
          </Suspense>
          <BenefitPitch />
          <HowItWorksFAQ />
          <section className="px-6 py-12 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
              <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur sm:p-10">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                      For Serious Businesses
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                      Need direct onboarding access?
                    </h2>
                    <p className="mt-3 text-base text-slate-600 sm:text-lg">
                      Early access is limited to selected businesses. Request access to be reviewed for an invite code.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/request-access"
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Request Access
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="px-6 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Simple, transparent pricing
                </h2>
                <p className="mt-4 text-base text-slate-600 sm:text-lg">
                  Choose the setup that fits your business today.
                </p>
              </div>

              <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      Chatbot Plan
                    </h3>
                    <p className="mt-4 text-3xl font-bold text-slate-900">
                      €19
                      <span className="text-base font-medium text-slate-500">
                        /month
                      </span>
                    </p>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    <li>AI chatbot for leads</li>
                    <li>Basic analytics</li>
                    <li>Website integration</li>
                  </ul>
                  <a
                    href="/api/paysera/create-payment?plan=chatbot"
                    className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                  >
                    Start Free Trial
                  </a>
                </div>

                <div className="rounded-xl border-2 border-slate-900 bg-white p-8 shadow-md md:scale-[1.02]">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold text-slate-900">
                      Website + Chatbot
                    </h3>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      Most Popular
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-bold text-slate-900">
                    €29
                    <span className="text-base font-medium text-slate-500">
                      /month
                    </span>
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    <li>Everything in chatbot</li>
                    <li>Website builder</li>
                    <li>Reservations system</li>
                  </ul>
                  <a
                    href="/api/paysera/create-payment?plan=pro"
                    className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Start Free Trial
                  </a>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm md:col-span-2 lg:col-span-1">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      Enterprise
                    </h3>
                    <p className="mt-4 text-3xl font-bold text-slate-900">
                      Custom
                      <span className="ml-2 text-base font-medium text-slate-500">
                        pricing
                      </span>
                    </p>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    <li>Custom pricing</li>
                    <li>Advanced features</li>
                  </ul>
                  <a
                    href="#"
                    className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                  >
                    Contact Us
                  </a>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center mt-6">
                Secure payments powered by Paysera
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
