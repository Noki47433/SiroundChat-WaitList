"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";

interface StickyCtaProps {
  data: {
    locationLabel: string;
    locationDetail: string;
    buttonLabel: string;
    buttonHref: string;
  };
}

export function StickyCta({ data }: StickyCtaProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-4 shadow-2xl" style={{ borderColor: "var(--ft-accent)", background: "var(--ft-primary)" }}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2 text-[var(--site-primary-foreground)]">
          <MapPin className="h-4 w-4" />
          <div className={`${styles.body} flex items-center gap-2 text-sm`}>
            <span className="font-bold">{data.locationLabel}</span>
            <span className="hidden sm:inline">• {data.locationDetail}</span>
          </div>
        </div>

        <a
          href={data.buttonHref}
          data-editor-button="true"
          className={`${styles.display} inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-black uppercase tracking-[0.16em] transition-transform hover:scale-105`}
          style={{ background: "var(--ft-bg)", color: "var(--ft-primary)" }}
        >
          <Phone className="h-4 w-4" />
          {data.buttonLabel}
        </a>
      </div>
    </div>
  );
}
