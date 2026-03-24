"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" }
];

export function FeedbackFilters({
  range,
  siteId,
  sites
}: {
  range: string;
  siteId: string | null;
  sites: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (nextRange: string, nextSite: string | null) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("range", nextRange);
    if (nextSite) {
      params.set("site", nextSite);
    } else {
      params.delete("site");
    }
    const query = params.toString();
    router.push(query ? `/dashboard/feedback?${query}` : "/dashboard/feedback");
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Range</p>
        <Select
          value={range}
          onChange={(event) => updateParams(event.target.value, siteId)}
          className="mt-2"
          data-tutorial-target="feedback-range"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Site</p>
        <Select
          value={siteId ?? "all"}
          onChange={(event) => updateParams(range, event.target.value === "all" ? null : event.target.value)}
          className="mt-2"
        >
          <option value="all">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
