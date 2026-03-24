"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Search, Settings } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils/cn";

type ResultType = "navigation" | "conversation" | "lead" | "reservation";

type QuickSearchItem = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
  timestamp?: string | null;
};

type QuickSearchResponse = {
  query: string;
  groups: {
    navigation: QuickSearchItem[];
    conversations: QuickSearchItem[];
    leads: QuickSearchItem[];
    reservations: QuickSearchItem[];
  };
};

type OverviewHeaderProps = {
  title: string;
  subtitle: string;
  businessId?: string;
};

const EMPTY_GROUPS: QuickSearchResponse["groups"] = {
  navigation: [],
  conversations: [],
  leads: [],
  reservations: []
};

const GROUP_LABELS: Record<keyof QuickSearchResponse["groups"], string> = {
  navigation: "Quick actions",
  conversations: "Conversations",
  leads: "Leads",
  reservations: "Reservations"
};

const TYPE_LABELS: Record<ResultType, string> = {
  navigation: "Page",
  conversation: "Conversation",
  lead: "Lead",
  reservation: "Reservation"
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export function OverviewHeader({ title, subtitle, businessId }: OverviewHeaderProps) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [groups, setGroups] = useState<QuickSearchResponse["groups"]>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    if (!paletteOpen) return;

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "5");
        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }

        const response = await fetch(`/api/dashboard/quick-search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          setGroups(EMPTY_GROUPS);
          return;
        }

        const payload = (await response.json()) as QuickSearchResponse;
        setGroups(payload.groups ?? EMPTY_GROUPS);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setGroups(EMPTY_GROUPS);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [debouncedQuery, paletteOpen]);

  const flatResults = useMemo(
    () => [
      ...groups.navigation,
      ...groups.conversations,
      ...groups.leads,
      ...groups.reservations
    ],
    [groups]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, flatResults.length]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setPaletteOpen(true);
      }

      if (event.key === "Escape" && paletteOpen) {
        event.preventDefault();
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [paletteOpen]);

  const handleOpenPalette = () => {
    setQuery("");
    setPaletteOpen(true);
  };

  const navigateToResult = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (!flatResults.length) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (!flatResults.length) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
      return;
    }

    if (event.key === "Enter") {
      if (!flatResults.length) return;
      event.preventDefault();
      const target = flatResults[activeIndex];
      if (target?.href) {
        navigateToResult(target.href);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setPaletteOpen(false);
    }
  };

  const hasResults = flatResults.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Overview</p>
          <h2 className="dashboard-heading mt-1 text-4xl font-semibold text-white sm:text-5xl">{title}</h2>
          <p className="max-w-[60ch] text-[15px] text-[#a6bbd4]">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenPalette}
            className="dashboard-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[#e0d0a2] transition hover:text-white"
            aria-label="Open quick search"
          >
            <Search className="h-4 w-4 text-[#f7d56b]" />
            <span>Search anything...</span>
            <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-white/50">
              ⌘K
            </span>
          </button>

          <div className="dashboard-pill flex items-center gap-2 rounded-full px-3 py-2 text-xs text-white/70">
            <NotificationBell businessId={businessId} variant="icon" />

            <Link
              href="/dashboard/conversations?filter=open&focus=search"
              className="dashboard-chip inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffd87266] text-[#f7d56b] transition hover:bg-white/10 hover:text-white"
              aria-label="Open conversations inbox"
            >
              <MessageSquare className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/settings"
              className="dashboard-chip inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffd87266] text-[#f7d56b] transition hover:bg-white/10 hover:text-white"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {paletteOpen ? (
        <div className="fixed inset-0 z-[180] flex items-start justify-center px-4 py-10 sm:py-14">
          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close quick search"
          />

          <div className="dashboard-surface relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 p-4 shadow-2xl">
            <div className="dashboard-inset flex items-center gap-3 rounded-2xl px-3 py-2">
              <Search className="h-4 w-4 text-[#f7d56b]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search pages, leads, conversations, reservations..."
                className="h-9 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/50"
                aria-label="Quick search"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="rounded-xl border border-white/15 px-2 py-1 text-xs text-white/60 transition hover:text-white"
              >
                Esc
              </button>
            </div>

            <div className="mt-4 max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {loading ? <p className="px-1 text-xs text-white/60">Searching...</p> : null}

              {!loading && !hasResults ? (
                <div className="dashboard-inset rounded-2xl p-3 text-sm text-white/65">No matches</div>
              ) : null}

              {(Object.keys(groups) as Array<keyof QuickSearchResponse["groups"]>).map((groupKey) => {
                const items = groups[groupKey];
                if (!items.length) return null;

                return (
                  <div key={groupKey} className="space-y-2">
                    <p className="px-1 text-[11px] uppercase tracking-[0.2em] text-white/45">{GROUP_LABELS[groupKey]}</p>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const index = flatResults.findIndex((result) => result.id === item.id);
                        const active = index === activeIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateToResult(item.href)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              "w-full rounded-2xl border p-3 text-left transition",
                              active
                                ? "dashboard-chip border-[#ffd87266] text-white"
                                : "border-white/10 bg-white/[0.03] text-white/85 hover:border-white/25"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-white/65">
                                {TYPE_LABELS[item.type]}
                              </span>
                              {item.timestamp ? (
                                <span className="text-[11px] text-white/45">{formatTimestamp(item.timestamp)}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-white">{item.title}</p>
                            <p className="mt-1 text-xs text-white/60">{item.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
