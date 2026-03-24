"use client";

import { useState } from "react";

export default function ChannelsComingSoonClient() {
  const [notified, setNotified] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#ffd87245] bg-[#060c16] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,210,110,0.2),transparent_42%),radial-gradient(circle_at_86%_8%,rgba(255,192,80,0.16),transparent_40%),linear-gradient(180deg,rgba(8,15,28,0.9)_0%,rgba(6,12,22,0.96)_100%)]" />

      <div className="pointer-events-none absolute -left-8 top-24 hidden h-52 w-72 rotate-[-14deg] rounded-[30px] border border-white/10 bg-white/[0.06] shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur-[2px] md:block" />
      <div className="pointer-events-none absolute right-0 top-8 hidden h-48 w-64 rotate-[18deg] rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_18px_40px_rgba(0,0,0,0.3)] md:block" />
      <div className="pointer-events-none absolute -bottom-16 right-14 hidden h-44 w-60 rotate-[11deg] rounded-[26px] border border-white/10 bg-white/[0.03] shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:block" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.24em] text-[#b9a77a]">Channels</p>

        <div className="mt-5 leading-[0.86]">
          <p className="dashboard-heading text-[60px] font-semibold text-white sm:text-[86px] lg:text-[108px]">COMING</p>
          <p className="dashboard-heading text-[60px] font-semibold text-white sm:text-[86px] lg:text-[108px]">SOON</p>
        </div>

        <p className="mt-5 max-w-2xl text-sm text-[#d8c89c] sm:text-base">
          WhatsApp and Instagram inboxes are planned for a later release. For v1, this page is intentionally held while
          we focus on billing, website, and chatbot core flows.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setNotified(true)}
            disabled={notified}
            className={[
              "dashboard-pill inline-flex h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold transition",
              notified
                ? "cursor-default border-[#ffd8724a] text-[#b9aa7f]"
                : "border-[#ffd87280] text-[#f6df9f] hover:text-white"
            ].join(" ")}
          >
            {notified ? "You’re on the list" : "Notify Me"}
          </button>

          {notified ? (
            <p className="text-sm text-[#e9d79f]">You’ll be notified when this feature drops.</p>
          ) : (
            <p className="text-sm text-[#b6a374]">No action needed now. We’ll announce it here first.</p>
          )}
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="dashboard-inset rounded-2xl border border-[#ffd87233] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#a8925f]">Planned</p>
            <p className="mt-2 text-sm text-white">Unified social inbox</p>
          </div>
          <div className="dashboard-inset rounded-2xl border border-[#ffd87233] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#a8925f]">Planned</p>
            <p className="mt-2 text-sm text-white">One-click reply workflows</p>
          </div>
          <div className="dashboard-inset rounded-2xl border border-[#ffd87233] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#a8925f]">Planned</p>
            <p className="mt-2 text-sm text-white">Cross-channel lead sync</p>
          </div>
        </div>
      </div>
    </section>
  );
}
