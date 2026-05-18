import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Data Deletion" }
];

export function LegalPageLayout({ title, subtitle, children }: LegalPageLayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,_#fffdf7_0%,_#fff7e8_45%,_#fff3dc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 rounded-[2rem] border border-amber-200/70 bg-white/85 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950 transition hover:text-amber-700">
            <Image
              src="/images-logo/SiroundChatLogo.png"
              alt="SiroundChat"
              width={44}
              height={44}
              priority
              className="h-11 w-auto"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-700">SiroundChat</p>
              <p className="text-xs text-slate-500">AI Chat, WhatsApp, reservations, and business messaging</p>
            </div>
          </Link>

          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Legal</p>
            <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{subtitle}</p>
          </div>
        </header>

        <section className="flex-1 rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_26px_70px_-46px_rgba(15,23,42,0.4)] backdrop-blur sm:p-8 lg:p-10">
          <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-7 prose-li:leading-7">
            {children}
          </div>
        </section>

        <footer className="mt-8 rounded-[1.75rem] border border-amber-200/70 bg-white/80 px-5 py-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">&copy; {currentYear} SiroundChat. Public legal information.</p>
            <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-700">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="transition hover:text-amber-700">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
