"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyState({ onPreviewHref }: { onPreviewHref: string }) {
  return (
    <Card className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-xl font-semibold text-white">Your Website Insights will appear here</h3>
      <p className="mt-2 text-sm text-white/60">
        Once your site starts getting traffic, we&apos;ll translate it into business outcomes - not raw metrics.
      </p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        {["Share your site", "Get visitors", "See insights"].map((step, index) => (
          <div key={step} className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Step {index + 1}</p>
            <p className="mt-2 text-sm font-semibold text-white">{step}</p>
          </div>
        ))}
      </div>
      <Button
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-500/90 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
        onClick={() => {
          if (typeof window !== "undefined") window.location.href = onPreviewHref;
        }}
      >
        Preview tracking setup
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}
