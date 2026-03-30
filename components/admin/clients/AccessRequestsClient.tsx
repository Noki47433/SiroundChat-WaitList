"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AccessRequestItem = {
  id: string;
  business_name: string | null;
  industry: string | null;
  phone: string | null;
  city: string | null;
  website_url: string | null;
  onboarding_data: Record<string, unknown> | null;
  created_at: string;
};

type Props = {
  initialRequests: AccessRequestItem[];
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const formatIndustry = (value: string | null | undefined) => {
  if (!value) return "Other";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const toOnboardingData = (value: AccessRequestItem["onboarding_data"]) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export function AccessRequestsClient({ initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = requests.length;

  const enrichedRequests = useMemo(
    () =>
      requests.map((request) => {
        const onboardingData = toOnboardingData(request.onboarding_data);
        return {
          ...request,
          description: readString(onboardingData.description),
          website: readString(onboardingData.website) ?? request.website_url,
          phone: readString(onboardingData.phone) ?? request.phone,
          city: readString(onboardingData.city) ?? request.city
        };
      }),
    [requests]
  );

  const handleApprove = async (businessId: string) => {
    setLoadingId(businessId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/access-requests/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to approve business.");
        return;
      }

      setRequests((current) => current.filter((request) => request.id !== businessId));
      setMessage("Business approved.");
    } catch {
      setError("Unable to approve business.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Onboarding Access</p>
        <h1 className="text-3xl font-semibold text-white">Business approvals</h1>
        <p className="text-sm text-white/60">
          Review submitted business details and approve accounts for dashboard access.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Pending reviews</p>
            <p className="text-sm text-white/55">
              Accounts stay locked until you approve the submitted business details.
            </p>
          </div>

          <Badge variant={pendingCount > 0 ? "warning" : "default"}>
            {pendingCount} pending
          </Badge>
        </div>

        <div className="space-y-4">
          {enrichedRequests.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-white/45">
              No pending onboarding submissions.
            </div>
          ) : null}

          {enrichedRequests.map((request) => {
            const isLoading = loadingId === request.id;

            return (
              <div
                key={request.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">
                          {request.business_name?.trim() || "Unnamed business"}
                        </p>
                        <Badge variant="info">{formatIndustry(request.industry)}</Badge>
                      </div>
                      <p className="text-xs text-white/45">
                        Submitted {formatDate(request.created_at)}
                      </p>
                    </div>

                    {request.description ? (
                      <p className="max-w-3xl text-sm leading-6 text-white/70">
                        {request.description}
                      </p>
                    ) : null}

                    <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Phone
                        </p>
                        <p className="mt-2 break-words">{request.phone ?? "—"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          City / location
                        </p>
                        <p className="mt-2 break-words">{request.city ?? "—"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Website
                        </p>
                        <p className="mt-2 break-all">{request.website ?? "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? "Approving..." : "Approve"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
