'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Pricing", href: "#pricing" },
  { label: "Developers", href: "#developers" },
  { label: "Docs", href: "#docs" }
];

type NavbarProps = {
  isLoggedIn?: boolean;
};

export function Navbar({ isLoggedIn }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`sticky top-0 z-40 w-full transition-all ${
        isScrolled
          ? "border-b border-border-subtle bg-white/80 backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 text-sm sm:px-6 lg:max-w-7xl lg:px-10">
        <Link href="/" className="flex items-center gap-1 h-10 w-auto">
          <Image src="/images-logo/SiroundChatLogo.png" alt="Promp" width={44} height={32} priority />
          <span className="text-lg font-semibold tracking-tight text-brand-dark">SiroundChat</span>
        </Link>

        <div className="hidden items-center gap-10 lg:flex">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted transition hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-amber-600"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-amber-600"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full border border-border-subtle bg-white/70 p-2 text-ink lg:hidden"
          aria-label="Toggle navigation"
        >
          <div className="h-5 w-5">
            {isMenuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-full w-full">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-full w-full">
                <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-t border-border-subtle bg-white/90 backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 text-base font-medium text-ink sm:px-6 lg:max-w-7xl lg:px-10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 transition hover:bg-brand-soft/70"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-2xl bg-brand px-3 py-3 text-center text-white shadow-soft transition hover:bg-amber-600"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl px-3 py-2 text-muted transition hover:bg-brand-soft/70"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-2xl bg-brand px-3 py-3 text-center text-white shadow-soft transition hover:bg-amber-600"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
