const steps = [
  {
    icon: "🧾",
    title: "Connect your business info",
    description: "Share your services, FAQs, and availability so replies match your business."
  },
  {
    icon: "🔌",
    title: "Add SiroundChat to your site + inbox",
    description: "Place the assistant where customers already reach out."
  },
  {
    icon: "📈",
    title: "Watch bookings + leads come in",
    description: "Track captured leads and appointments as responses happen in real time."
  }
];

const faqs = [
  {
    question: "Will it replace my staff?",
    answer: "No. It handles repetitive first-response work so your team can focus on higher-value conversations."
  },
  {
    question: "Can I control what it says?",
    answer: "Yes. You can define business details, preferred responses, and guardrails for tone and content."
  },
  {
    question: "Do I need a website?",
    answer: "A website helps, but you can also use SiroundChat through connected inbox channels."
  },
  {
    question: "What languages?",
    answer: "English is supported first, with multilingual support rolling out in early-access phases."
  },
  {
    question: "How fast can I launch?",
    answer: "You can create an account, connect your business details, and start onboarding right away."
  }
];

export default function HowItWorksFAQ() {
  return (
    <section className="relative px-6 py-16 sm:px-8 sm:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-2 h-20 bg-[radial-gradient(circle,rgba(251,191,36,0.25),transparent_72%)]" />
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-amber-300/40 bg-white/80 shadow-[0_20px_44px_-34px_rgba(245,158,11,0.7)] backdrop-blur-2xl">
        <div className="grid lg:grid-cols-[1.06fr_0.94fr]">
          <div className="border-b border-amber-300/30 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">How it works</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-amber-300/35 bg-white/80 p-5 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-amber-500/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/45 bg-amber-100 text-sm font-semibold text-amber-700">
                      {index + 1}
                    </span>
                    <p className="text-xl" aria-hidden="true">
                      {step.icon}
                    </p>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-700">{step.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Frequently Asked Questions</h2>
            <div className="mt-6 space-y-3">
              {faqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-amber-300/35 bg-white/80 p-5 backdrop-blur transition duration-300 hover:border-amber-500/50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-slate-900 marker:content-none">
                    <span>{item.question}</span>
                    <span className="text-amber-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-700">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
