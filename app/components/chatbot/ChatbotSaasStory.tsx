'use client';
// Summary: Secondary narrative section describing the SaaS chatbot story; mostly static.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Link2, Database, Bot } from "lucide-react";

const cards = [
  {
    title: "OpenAI integration",
    icon: Bot,
    body:
      "We sanitize every message, enforce rate limits, and call GPT-4o/GPT-4o-mini with your business persona so replies stay short, on-brand, and safe."
  },
  {
    title: "RAG on your data",
    icon: Database,
    body:
      "Upload FAQs, docs, menus, or policies. We chunk, embed, and store vectors per tenant, then retrieve top snippets for grounded answers—no hallucinations."
  },
  {
    title: "Embeddable widget",
    icon: Link2,
    body:
      "Drop one snippet on any site/app to launch the SiroundChat bubble. Streams responses in real time, inherits your theme, and captures leads automatically."
  },
  {
    title: "Safety & isolation",
    icon: ShieldCheck,
    body:
      "Per-tenant namespaces, misuse filters, token/QPS limits, and explicit refusal patterns for sensitive asks. Your data never bleeds across clients."
  }
];

const steps = [
  {
    label: "1) Connect OpenAI",
    detail:
      "Keep the API key server-side only. We proxy chat calls, log token usage, and back off/retry gracefully if OpenAI is busy."
  },
  {
    label: "2) Feed business data",
    detail:
      "Chunk content, generate embeddings, store vectors, and fetch top-k per tenant. The retrieved snippets ride along with the user prompt."
  },
  {
    label: "3) Embed the widget",
    detail:
      "Use the loader snippet to inject /embed/[key]. The widget opens a WebSocket/HTTP stream to your `/api/chat/send` pipeline."
  },
  {
    label: "4) Publish fast",
    detail:
      "Serve the assistant on your domain or the client’s. Add custom domains later; SSL can be automated with Let’s Encrypt once mapped."
  }
];

export function ChatbotSaasStory() {
  const router = useRouter();

  const handleBuilderCta = () => {
    router.push("/build/chatbot");
  };

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">SiroundChat Chatbot SaaS</p>
          <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
            From prompt to deployed chatbot—grounded in your business data.
          </h2>
          <p className="text-lg text-slate-200/80">
            Build once, embed anywhere. We integrate OpenAI securely, layer RAG for business-specific answers, and ship a
            polished widget that lives on every page. Multi-tenant by default, safety-first by design.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBuilderCta}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02]"
            >
              Go to the builder
            </button>
            <button
              onClick={handleBuilderCta}
              className="rounded-full border border-cyan-200/30 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:text-white"
            >
              Watch it in action
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.05 }}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/70 to-indigo-500/80 text-slate-950 shadow-lg shadow-cyan-400/30">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-200/80">{card.body}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-cyan-900/40 p-6 shadow-[0_30px_70px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-cyan-200">How it ships</p>
              <h3 className="text-2xl font-semibold text-white">Pipeline from user message to grounded answer</h3>
              <p className="text-slate-200/80">
                Requests hit `/api/chat/send`, are rate-limited, vector-searched per tenant, and streamed back to the widget.
                Safety rails reject sensitive asks; if context is missing, the bot prompts for clarification.
              </p>
            </div>
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
              {steps.map((step, idx) => (
                <div
                  key={step.label}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-3 shadow-inner shadow-slate-900/40"
                >
                  <div className="mt-0.5 h-6 min-w-[1.5rem] rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 px-2 text-center text-xs font-bold text-slate-950">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{step.label}</p>
                    <p className="text-slate-200/80">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.3)] backdrop-blur">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-cyan-200">Publishing & hosting</p>
              <h3 className="text-2xl font-semibold text-white">Serve it anywhere</h3>
              <p className="text-slate-200/80">
                Host the widget and RAG backend on your stack (Vercel/Netlify/Render/VM). Add custom domains later; SSL is
                automated. The widget defaults to your SiroundChat subdomain until DNS is connected.
              </p>
              <div className="flex gap-3">
                <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100">Multi-tenant</span>
                <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-100">Lead capture</span>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">Streaming</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200 shadow-inner shadow-cyan-500/10">
              <p className="font-semibold text-white">Embed snippet</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/60 p-3 text-xs text-cyan-100">
{`<script src="/api/widget/loader?key=YOUR_WIDGET_KEY" async></script>
<div id="siroundchat-chat"></div>`}
              </pre>
              <p className="mt-3 text-slate-300">
                The loader injects an iframe (`/embed/[key]`) that streams replies from your API. Theme + logo come from the tenant config.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
