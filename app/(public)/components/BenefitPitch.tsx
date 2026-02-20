const proofCards = [
  {
    stat: "82%",
    text: "82% want issues solved immediately, and 78% prefer self-service support.",
    source: "HubSpot State of Service"
  },
  {
    stat: "23.5%",
    text: "23.5% lower cost per contact with about 4% revenue uplift.",
    source: "IBM Think"
  },
  {
    stat: "88%",
    text: "88% say good service makes them more likely to buy again.",
    source: "Salesforce"
  },
  {
    stat: "$11B",
    text: "Projected annual cost savings from chatbots.",
    source: "Juniper"
  }
];

export default function BenefitPitch() {
  return (
    <section className="relative px-6 py-16 sm:px-8 sm:py-20">
      <div className="pointer-events-none absolute left-1/2 top-2 h-20 w-[65%] -translate-x-1/2 rounded-full bg-amber-200/60 blur-3xl" />
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-amber-300/40 bg-white/80 p-6 shadow-[0_20px_44px_-34px_rgba(245,158,11,0.7)] backdrop-blur-2xl sm:p-8 md:p-10">
        <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          What&apos;s in it for your business?
        </h2>
        <p className="mt-5 max-w-3xl text-slate-700">
          Buyers expect fast answers before they commit. When they do not hear back quickly, they move on to the
          next option.
        </p>
        <p className="mt-4 max-w-3xl text-slate-700">
          SiroundChat helps you stay available around the clock by handling repeat questions and collecting intent
          while your team focuses on closing.
        </p>
        <p className="mt-4 max-w-3xl text-slate-700">
          That means more opportunities captured with less day-to-day support pressure.
        </p>

        <ul className="mt-6 grid gap-3 text-sm text-slate-800 sm:grid-cols-2">
          <li className="rounded-2xl border border-amber-300/35 bg-white/75 px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50">
            more bookings
          </li>
          <li className="rounded-2xl border border-amber-300/35 bg-white/75 px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50">
            more leads
          </li>
          <li className="rounded-2xl border border-amber-300/35 bg-white/75 px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50">
            faster replies
          </li>
          <li className="rounded-2xl border border-amber-300/35 bg-white/75 px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-amber-50">
            less workload
          </li>
        </ul>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {proofCards.map((card) => (
            <article
              key={card.stat}
              className="rounded-2xl border border-amber-300/35 bg-white/80 p-6 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/55 hover:shadow-[0_18px_40px_-24px_rgba(245,158,11,0.9)]"
            >
              <p className="text-4xl font-semibold text-amber-600">{card.stat}</p>
              <p className="mt-2 text-sm text-slate-700">{card.text}</p>
              <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">{card.source}</p>
            </article>
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-500">Benchmarks from industry research; results vary.</p>
      </div>
    </section>
  );
}
