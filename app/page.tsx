import { Suspense } from "react";
import BenefitPitch from "./(public)/components/BenefitPitch";
import Footer from "./(public)/components/Footer";
import HeroWaitlist from "./(public)/components/HeroWaitlist";
import HowItWorksFAQ from "./(public)/components/HowItWorksFAQ";

export default function Page() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-[#fffef8] via-[#fffdf4] to-[#fff8e8] text-slate-900">
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
        <Footer />
      </div>
    </main>
  );
}
