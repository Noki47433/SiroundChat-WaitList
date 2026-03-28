"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type AccessRequestItem = {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  business_type: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  invite_code: string | null;
  invite_expires_at: string | null;
  invite_is_active: boolean | null;
};

type ManualInviteItem = {
  id: string;
  code: string;
  assigned_email: string | null;
  assigned_business_name: string | null;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type Props = {
  initialRequests: AccessRequestItem[];
  initialManualInvites: ManualInviteItem[];
};

const STATUS_LABELS: Array<AccessRequestItem["status"] | "all"> = ["all", "pending", "approved", "rejected"];

const badgeVariant = (status: AccessRequestItem["status"]) => {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-300";
    case "rejected":
      return "bg-rose-500/15 text-rose-300";
    default:
      return "bg-amber-500/15 text-amber-200";
  }
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

export function AccessRequestsClient({ initialRequests, initialManualInvites }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [manualInvites, setManualInvites] = useState(initialManualInvites);
  const [statusFilter, setStatusFilter] = useState<AccessRequestItem["status"] | "all">("pending");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    assignedEmail: "",
    assignedBusinessName: "",
    maxUses: "1",
    expiresAt: ""
  });
  const [creatingManual, setCreatingManual] = useState(false);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const updateRequest = (requestId: string, patch: Partial<AccessRequestItem>) => {
    setRequests((current) =>
      current.map((request) => (request.id === requestId ? { ...request, ...patch } : request))
    );
  };

  const handleRequestAction = async (requestId: string, action: "approve" | "reject") => {
    setLoadingId(requestId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/access-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            invite?: {
              code: string;
              expires_at: string | null;
            };
          }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update access request.");
        return;
      }

      if (action === "approve") {
        updateRequest(requestId, {
          status: "approved",
          invite_code: payload?.invite?.code ?? null,
          invite_expires_at: payload?.invite?.expires_at ?? null,
          invite_is_active: true
        });
        setMessage(payload?.invite?.code ? `Invite code ready: ${payload.invite.code}` : "Request approved.");
        return;
      }

      updateRequest(requestId, {
        status: "rejected",
        invite_is_active: false
      });
      setMessage("Request rejected.");
    } catch {
      setError("Unable to update access request.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleManualInviteCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingManual(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedEmail: manualForm.assignedEmail,
          assignedBusinessName: manualForm.assignedBusinessName,
          maxUses: manualForm.maxUses,
          expiresAt: manualForm.expiresAt
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; invite?: ManualInviteItem }
        | null;

      if (!response.ok || !payload?.invite) {
        setError(payload?.error ?? "Unable to create invite code.");
        return;
      }

      setManualInvites((current) => [payload.invite as ManualInviteItem, ...current].slice(0, 10));
      setManualForm({
        assignedEmail: "",
        assignedBusinessName: "",
        maxUses: "1",
        expiresAt: ""
      });
      setMessage(`Manual invite created: ${payload.invite.code}`);
    } catch {
      setError("Unable to create invite code.");
    } finally {
      setCreatingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Launch Access</p>
        <h1 className="text-3xl font-semibold text-white">Access requests</h1>
        <p className="text-sm text-white/60">
          Review inbound requests, approve businesses, and create outbound invite codes.
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
            <p className="text-sm font-semibold text-white">Inbound requests</p>
            <p className="text-sm text-white/55">Approved requests get a server-generated invite code.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_LABELS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === status
                    ? "bg-white text-slate-900"
                    : "border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Presence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invite</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-white/45">
                  No requests in this view.
                </TableCell>
              </TableRow>
            ) : null}

            {filteredRequests.map((request) => {
              const isLoading = loadingId === request.id;
              const canApprove = request.status !== "approved";
              const canReject = request.status !== "rejected";

              return (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold text-white">{request.business_name}</p>
                      {request.business_type ? (
                        <p className="text-xs text-white/45">{request.business_type}</p>
                      ) : null}
                      {request.note ? (
                        <p className="max-w-sm text-xs text-white/55">{request.note}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-white/75">
                      <p>{request.email}</p>
                      {request.owner_name ? <p className="text-xs text-white/45">{request.owner_name}</p> : null}
                      {request.phone ? <p className="text-xs text-white/45">{request.phone}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs text-white/55">
                      {request.website_url ? (
                        <a href={request.website_url} target="_blank" rel="noreferrer" className="block hover:text-white">
                          Website
                        </a>
                      ) : null}
                      {request.instagram_url ? (
                        <a href={request.instagram_url} target="_blank" rel="noreferrer" className="block hover:text-white">
                          Instagram
                        </a>
                      ) : null}
                      {!request.website_url && !request.instagram_url ? "—" : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={badgeVariant(request.status)}>{request.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {request.invite_code ? (
                      <div className="space-y-2">
                        <div className="font-mono text-sm text-[#f6db94]">{request.invite_code}</div>
                        <div className="flex items-center gap-2">
                          <CopyButton value={request.invite_code} size="sm" variant="outline">
                            Copy
                          </CopyButton>
                          {request.invite_expires_at ? (
                            <span className="text-xs text-white/45">Expires {formatDate(request.invite_expires_at)}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-white/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-white/45">{formatDate(request.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isLoading || !canApprove}
                        onClick={() => handleRequestAction(request.id, "approve")}
                      >
                        {isLoading && canApprove ? "Saving..." : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isLoading || !canReject}
                        onClick={() => handleRequestAction(request.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold text-white">Manual outbound invite</p>
            <p className="text-sm text-white/55">Create a code for a business you contacted directly.</p>
          </div>

          <form onSubmit={handleManualInviteCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/65">Assigned email</label>
              <input
                value={manualForm.assignedEmail}
                onChange={(event) => setManualForm((current) => ({ ...current, assignedEmail: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#ffd87266] focus:outline-none"
                placeholder="owner@business.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/65">Assigned business</label>
              <input
                value={manualForm.assignedBusinessName}
                onChange={(event) => setManualForm((current) => ({ ...current, assignedBusinessName: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#ffd87266] focus:outline-none"
                placeholder="Acme Studio"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-white/65">Max uses</label>
                <input
                  value={manualForm.maxUses}
                  onChange={(event) => setManualForm((current) => ({ ...current, maxUses: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#ffd87266] focus:outline-none"
                  type="number"
                  min={1}
                  max={100}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/65">Expiry</label>
                <input
                  value={manualForm.expiresAt}
                  onChange={(event) => setManualForm((current) => ({ ...current, expiresAt: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#ffd87266] focus:outline-none"
                  type="datetime-local"
                />
              </div>
            </div>

            <Button type="submit" disabled={creatingManual}>
              {creatingManual ? "Creating..." : "Create invite code"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold text-white">Recent manual codes</p>
            <p className="text-sm text-white/55">Latest outbound codes for copy/paste follow-up.</p>
          </div>

          <div className="space-y-3">
            {manualInvites.length === 0 ? (
              <p className="text-sm text-white/45">No manual invite codes created yet.</p>
            ) : null}

            {manualInvites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-lg text-[#f6db94]">{invite.code}</p>
                    <p className="text-sm text-white/75">
                      {invite.assigned_business_name || "Unassigned business"}
                    </p>
                    <p className="text-xs text-white/45">{invite.assigned_email || "Any approved email"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <CopyButton value={invite.code} size="sm" variant="outline">
                      Copy
                    </CopyButton>
                    <Badge className={invite.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/55"}>
                      {invite.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/45">
                  <span>
                    Uses: {invite.uses_count}/{invite.max_uses}
                  </span>
                  <span>Created: {formatDate(invite.created_at)}</span>
                  <span>Expires: {formatDate(invite.expires_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
