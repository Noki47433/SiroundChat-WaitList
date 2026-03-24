"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ConversationSummary } from "@/lib/types";
import { getConversations } from "@/lib/api";

const filters = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "lead", label: "Lead" }
];
const FILTER_VALUES = new Set(filters.map((filter) => filter.value));

export function ConversationsTable({
  initialConversations,
  initialSearch = "",
  initialFilter = "all",
  autoFocusSearch = false
}: {
  initialConversations: ConversationSummary[];
  initialSearch?: string;
  initialFilter?: string;
  autoFocusSearch?: boolean;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState(FILTER_VALUES.has(initialFilter) ? initialFilter : "all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setFilter(FILTER_VALUES.has(initialFilter) ? initialFilter : "all");
  }, [initialFilter]);

  useEffect(() => {
    if (!autoFocusSearch) return;
    const timeout = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [autoFocusSearch]);

  useEffect(() => {
    let active = true;
    getConversations().then((stored) => {
      if (active) setConversations(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return conversations.filter((conversation) => {
      const matchesSearch =
        conversation.visitorId.toLowerCase().includes(term) ||
        conversation.id.toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "lead" && conversation.tags.includes("lead")) ||
        conversation.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [conversations, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by visitor ID"
          data-tutorial-target="conversations-search"
        />
        <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filters.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Visitor</th>
              <th className="px-4 py-3">Start time</th>
              <th className="px-4 py-3">Last message</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.map((conversation) => (
              <tr
                key={conversation.id}
                className="cursor-pointer bg-neutral-950/20 transition hover:bg-white/5"
                onClick={() => router.push(`/dashboard/conversations/${conversation.id}`)}
                data-tutorial-target={filtered[0]?.id === conversation.id ? "conversations-first-row" : undefined}
              >
                <td className="px-4 py-3 font-semibold">{conversation.visitorId}</td>
                <td className="px-4 py-3 text-white/70">{conversation.startedAt}</td>
                <td className="px-4 py-3 text-white/70">{conversation.lastMessageAt}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {conversation.tags.map((tag) => (
                      <Badge key={tag} variant={tag === "lead" ? "success" : "default"}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={conversation.status === "open" ? "info" : "warning"}>
                    {conversation.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/50">
                  No conversations match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
