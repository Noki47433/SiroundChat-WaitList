"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, ChevronDown, Search, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TopbarProps = {
  fullName?: string | null;
};

const titleMap: Record<string, string> = {
  "/admin/overview": "Overview",
  "/admin/live": "Live",
  "/admin/businesses": "Businesses",
  "/admin/conversations": "Conversations",
  "/admin/feedback": "Feedback",
  "/admin/revenue": "Revenue",
  "/admin/costs": "Costs"
};

const rangeOptions = ["7d", "30d", "90d"] as const;

export function Topbar({ fullName }: TopbarProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/admin/overview";
  const searchParams = useSearchParams();
  const currentRange = searchParams?.get("range") ?? "30d";

  const title = useMemo(() => {
    for (const [path, value] of Object.entries(titleMap)) {
      if (currentPath.startsWith(path)) return value;
    }
    return "Admin";
  }, [currentPath]);

  const now = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      }).format(new Date()),
    []
  );

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--adm-border)] bg-[#0b1119]/75 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Dashboards / {title}</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--adm-text)]">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {rangeOptions.map((range) => {
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            params.set("range", range);
            return (
              <Link
                key={range}
                href={`${currentPath}?${params.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  currentRange === range
                    ? "bg-[#55FF95]/20 text-[#c7ffdf]"
                    : "border border-white/10 text-white/70 hover:text-white"
                }`}
              >
                {range}
              </Link>
            );
          })}
          <Badge variant="success" className="hidden sm:inline-flex">
            <span className="mr-1 h-2 w-2 rounded-full bg-[#55FF95] admin-live-dot" />
            LIVE
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search businesses, conversations, events"
            className="h-10 border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/35"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 md:block">
            {now}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/85">
              <Sparkles className="h-4 w-4 text-[#7CFF9D]" />
              <span className="max-w-[140px] truncate">{fullName ?? "Founder"}</span>
              <ChevronDown className="h-4 w-4 text-white/50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Admin settings</DropdownMenuItem>
              <DropdownMenuItem>Team access</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
