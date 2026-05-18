"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type ConversationStatus = "bot" | "human" | "closed";
type InboxChannel = "whatsapp" | "instagram";

type ConversationRow = {
  id: string;
  channel_type: InboxChannel;
  customer_display_name: string | null;
  external_customer_id: string | null;
  status: ConversationStatus;
  intent: string | null;
  reservation_draft: Record<string, unknown> | null;
  linked_reservation_id: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
};

type ReservationRow = {
  id: string;
  status: string;
  start_at: string;
  party_size: number;
  customer_name: string;
  customer_phone: string | null;
  source: string;
  source_conversation_id: string | null;
  notes: string | null;
  special_request: string | null;
  created_at: string;
};

type ConversationDetailResponse = {
  conversation: ConversationRow;
  messages: MessageRow[];
  linkedReservation: ReservationRow | null;
};

type ReplyResponse = {
  ok: true;
  providerMessageId: string | null;
  message: MessageRow;
  conversation: Pick<ConversationRow, "id" | "status" | "last_message_preview" | "last_message_at">;
};

const STATUS_FILTERS: Array<{ value: "all" | ConversationStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "bot", label: "Bot active" },
  { value: "human", label: "Human takeover" },
  { value: "closed", label: "Closed" }
];

const CHANNEL_FILTERS: Array<{ value: "all" | InboxChannel; label: string }> = [
  { value: "all", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" }
];

const statusVariant: Record<ConversationStatus, "info" | "warning" | "default"> = {
  bot: "info",
  human: "warning",
  closed: "default"
};

const reservationStatusVariant: Record<string, "warning" | "success" | "default" | "info"> = {
  pending: "warning",
  confirmed: "success",
  completed: "default",
  canceled: "default",
  seated: "info",
  no_show: "warning"
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const getDraftValue = (draft: Record<string, unknown> | null | undefined, key: string) => {
  if (!draft || typeof draft[key] === "undefined" || draft[key] === null) return null;
  return draft[key];
};

const buildMissingFields = (draft: Record<string, unknown> | null | undefined) => {
  const missing: string[] = [];
  if (!getDraftValue(draft, "name")) missing.push("Name");
  if (!getDraftValue(draft, "phone")) missing.push("Phone");
  if (!getDraftValue(draft, "date")) missing.push("Date");
  if (!getDraftValue(draft, "time")) missing.push("Time");
  if (!getDraftValue(draft, "party_size")) missing.push("Guests");
  return missing;
};

export function InboxDashboard({
  initialConversationId,
  showHeader = true
}: {
  initialConversationId?: string;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingStatus, setSavingStatus] = useState<ConversationStatus | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ConversationStatus>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | InboxChannel>("all");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [replyText, setReplyText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = threadViewportRef.current;
    if (!viewport) return;

    window.requestAnimationFrame(() => {
      if (bottomAnchorRef.current) {
        bottomAnchorRef.current.scrollIntoView({ behavior, block: "end" });
        return;
      }

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior
      });
    });
  }, []);

  const upsertConversation = useCallback((updater: (current: ConversationRow) => ConversationRow | null) => {
    setConversations((current) => {
      const next = current
        .map((conversation) => updater(conversation))
        .filter((conversation): conversation is ConversationRow => Boolean(conversation));

      next.sort((left, right) => {
        const leftTime = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
        const rightTime = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
        return rightTime - leftTime;
      });

      return next;
    });
  }, []);

  const loadConversations = async (
    nextStatus = statusFilter,
    nextSearch = search,
    nextChannel = channelFilter
  ) => {
    setLoadingConversations(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextChannel !== "all") params.set("channel", nextChannel);

      const response = await fetch(`/api/inbox/conversations?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load conversations");
      }

      const rows = (payload.conversations ?? []) as ConversationRow[];
      setConversations(rows);

      const nextSelected =
        (selectedConversationId && rows.find((row) => row.id === selectedConversationId)?.id) ||
        (initialConversationId && rows.find((row) => row.id === initialConversationId)?.id) ||
        rows[0]?.id ||
        null;

      setSelectedConversationId(nextSelected);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load conversations";
      setErrorMessage(message);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load conversation");
      }
      setDetail(payload as ConversationDetailResponse);
    } catch (error) {
      push({
        title: "Conversation load failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [push]);

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadConversations(statusFilter, search, channelFilter);
    }, 200);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter, statusFilter, search]);

  useEffect(() => {
    if (!selectedConversationId) {
      setDetail(null);
      return;
    }
    void loadConversationDetail(selectedConversationId);
  }, [loadConversationDetail, selectedConversationId]);

  useEffect(() => {
    const conversationId = detail?.conversation.id;
    const messageCount = detail?.messages.length ?? 0;

    if (!conversationId || messageCount === 0) return;
    scrollThreadToBottom(messageCount > 4 ? "auto" : "smooth");
  }, [detail?.conversation.id, detail?.messages.length, scrollThreadToBottom]);

  const draftFields = detail?.conversation?.reservation_draft ?? null;
  const missingDraftFields = buildMissingFields(draftFields);
  const inboxShellHeightClass = showHeader ? "xl:h-[calc(100dvh-8rem)]" : "xl:h-[calc(100dvh-10rem)]";

  const updateConversationStatus = async (status: ConversationStatus) => {
    if (!selectedConversationId || !detail?.conversation) return;

    const previousStatus = detail.conversation.status;
    if (previousStatus === status) return;

    setSavingStatus(status);
    setDetail((current) =>
      current
        ? {
            ...current,
            conversation: {
              ...current.conversation,
              status
            }
          }
        : current
    );
    upsertConversation((conversation) =>
      conversation.id === selectedConversationId ? { ...conversation, status } : conversation
    );

    try {
      const response = await fetch(`/api/inbox/conversations/${selectedConversationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update conversation");
      }
      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                status: payload?.conversation?.status ?? status
              }
            }
          : current
      );
    } catch (error) {
      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                status: previousStatus
              }
            }
          : current
      );
      upsertConversation((conversation) =>
        conversation.id === selectedConversationId ? { ...conversation, status: previousStatus } : conversation
      );
      push({
        title: "Status update failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSavingStatus(null);
    }
  };

  const sendReply = async () => {
    if (!selectedConversationId || !replyText.trim()) return;

    const trimmedReply = replyText.trim();
    setSendingReply(true);
    try {
      const response = await fetch(`/api/inbox/conversations/${selectedConversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmedReply })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send reply");
      }

      setReplyText("");
      const reply = payload as ReplyResponse;

      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                status: reply.conversation.status,
                last_message_preview: reply.conversation.last_message_preview,
                last_message_at: reply.conversation.last_message_at
              },
              messages: [...current.messages, reply.message]
            }
          : current
      );
      upsertConversation((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              status: reply.conversation.status,
              last_message_preview: reply.conversation.last_message_preview,
              last_message_at: reply.conversation.last_message_at
            }
          : conversation
      );
      scrollThreadToBottom();
    } catch (error) {
      push({
        title: "Reply failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendReply();
  };

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Inbox</p>
          <h2 className="dashboard-heading mt-2 text-3xl font-semibold text-white">Customer conversations</h2>
          <p className="mt-2 text-sm text-white/60">
            Manage customer conversations from WhatsApp and your AI assistant.
          </p>
        </div>
      ) : null}

      <div className={`grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] ${inboxShellHeightClass}`}>
        <Card className="dashboard-surface flex min-h-[620px] flex-col overflow-hidden p-0 xl:min-h-0">
          <div className="border-b border-white/10 px-5 py-5">
            <div>
              <h3 className="dashboard-heading text-lg font-semibold text-white">Inbox</h3>
              <p className="mt-1 text-sm text-white/55">Clean visibility across WhatsApp reservations and handoffs.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === filter.value
                      ? "border-[#ffd87266] bg-[#ffd8721f] text-white"
                      : "border-white/10 text-white/65 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHANNEL_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setChannelFilter(filter.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    channelFilter === filter.value
                      ? "border-[#52d9c766] bg-[#52d9c71a] text-white"
                      : "border-white/10 text-white/65 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search phone, name, or preview"
              className="mt-4"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 xl:min-h-0">
            {loadingConversations ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : errorMessage ? (
              <div className="m-2 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : conversations.length === 0 ? (
              <div className="m-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                <p className="text-sm font-medium text-white">No conversations yet.</p>
                <p className="mt-2 text-sm text-white/55">Incoming WhatsApp threads will appear here automatically.</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const active = conversation.id === selectedConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`mb-2 w-full rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-[#ffd87266] bg-[#ffd87212]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {conversation.customer_display_name || conversation.external_customer_id || "WhatsApp contact"}
                        </p>
                        <p className="mt-1 truncate text-xs text-white/55">{conversation.external_customer_id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={conversation.channel_type === "instagram" ? "warning" : "success"}
                          className={
                            conversation.channel_type === "instagram"
                              ? "bg-amber-500/15 text-amber-100"
                              : "bg-emerald-500/15 text-emerald-100"
                          }
                        >
                          {conversation.channel_type === "instagram" ? "Instagram" : "WhatsApp"}
                        </Badge>
                        <Badge variant={statusVariant[conversation.status]} className="capitalize">
                          {conversation.status === "bot"
                            ? "Bot active"
                            : conversation.status === "human"
                              ? "Human"
                              : "Closed"}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-white/70">
                      {conversation.last_message_preview || "No messages yet."}
                    </p>
                    <p className="mt-3 text-xs text-white/45">{formatDateTime(conversation.last_message_at)}</p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="dashboard-surface min-h-[620px] overflow-hidden p-0 xl:min-h-0">
          {!selectedConversationId ? (
            <div className="flex h-full min-h-[620px] items-center justify-center p-8 text-center xl:min-h-0">
              <div className="max-w-sm space-y-3">
                <p className="text-lg font-semibold text-white">Select a conversation to view messages.</p>
                <p className="text-sm text-white/55">
                  The full thread, reservation draft, and manual reply controls will appear here.
                </p>
              </div>
            </div>
          ) : loadingDetail || !detail ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-20 rounded-3xl" />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <Skeleton className="h-[520px] rounded-3xl" />
                <Skeleton className="h-[520px] rounded-3xl" />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="dashboard-heading text-2xl font-semibold text-white">
                        {detail.conversation.customer_display_name || detail.conversation.external_customer_id}
                      </h3>
                      <Badge
                        variant={detail.conversation.channel_type === "instagram" ? "warning" : "success"}
                        className={
                          detail.conversation.channel_type === "instagram"
                            ? "bg-amber-500/15 text-amber-100"
                            : "bg-emerald-500/15 text-emerald-100"
                        }
                      >
                        {detail.conversation.channel_type === "instagram" ? "Instagram" : "WhatsApp"}
                      </Badge>
                      <Badge variant={statusVariant[detail.conversation.status]} className="capitalize">
                        {detail.conversation.status === "bot"
                          ? "Bot active"
                          : detail.conversation.status === "human"
                            ? "Human takeover"
                            : "Closed"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-white/55">{detail.conversation.external_customer_id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={detail.conversation.status === "bot" ? "primary" : "secondary"}
                      size="sm"
                      type="button"
                      onClick={() => void updateConversationStatus("bot")}
                      disabled={savingStatus !== null}
                    >
                      Bot active
                    </Button>
                    <Button
                      variant={detail.conversation.status === "human" ? "primary" : "secondary"}
                      size="sm"
                      type="button"
                      onClick={() => void updateConversationStatus("human")}
                      disabled={savingStatus !== null}
                    >
                      Human takeover
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => void updateConversationStatus("closed")}
                      disabled={savingStatus !== null}
                    >
                      Mark closed
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 min-h-0 gap-6 overflow-hidden p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-h-0 flex-col overflow-hidden xl:items-center xl:justify-center">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-[#ffd87224] bg-[#08101b]/96 shadow-[0_28px_80px_rgba(0,0,0,0.42)] xl:h-full xl:max-h-[760px] xl:w-auto xl:max-w-full xl:flex-none xl:self-center xl:aspect-[9/16]">
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.24em] text-white/40">
                      <span>Conversation preview</span>
                      <span>{detail.conversation.channel_type === "instagram" ? "Instagram" : "WhatsApp"}</span>
                    </div>

                    <div
                      ref={threadViewportRef}
                      className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth xl:min-h-0"
                    >
                      <div className="space-y-3 pb-24">
                        {detail.messages.map((message) => {
                          const inbound = message.direction === "inbound";
                          return (
                            <div key={message.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`flex max-w-[min(84%,42rem)] flex-col ${inbound ? "items-start" : "items-end"}`}
                              >
                                <div className="mb-1 flex items-center gap-2 text-[11px] text-white/45">
                                  <span>{inbound ? "Customer" : "SiroundChat"}</span>
                                  <span>{formatDateTime(message.created_at)}</span>
                                </div>
                                <div
                                  className={`rounded-3xl px-4 py-3 text-sm leading-6 ${
                                    inbound
                                      ? "bg-white text-neutral-900"
                                      : "bg-[#102038] text-white shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                                  }`}
                                >
                                  {message.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={bottomAnchorRef} />
                      </div>
                    </div>

                    <form
                      onSubmit={(event) => void handleReplySubmit(event)}
                      className="sticky bottom-0 shrink-0 border-t border-white/10 bg-[#0b1627]/96 p-4 shadow-[0_-12px_32px_rgba(0,0,0,0.28)] backdrop-blur"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Manual reply</p>
                          <p className="text-xs text-white/50">
                            Sending a manual reply keeps the thread in human takeover.
                          </p>
                        </div>
                        {sendingReply ? <p className="text-xs text-[#ffe08a]">Sending message...</p> : null}
                      </div>
                      <Textarea
                        rows={2}
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Type your reply here"
                      />
                      <div className="mt-3 flex justify-end">
                        <Button type="submit" disabled={sendingReply || !replyText.trim()}>
                          {sendingReply ? "Sending..." : "Send reply"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto xl:min-h-0 xl:pr-1">
                  {detail.linkedReservation ? (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Reservation created</p>
                          <p className="mt-1 text-xs text-white/50">
                            Linked to this WhatsApp conversation.
                          </p>
                        </div>
                        <Badge
                          variant={reservationStatusVariant[detail.linkedReservation.status] ?? "default"}
                          className="capitalize"
                        >
                          {detail.linkedReservation.status}
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-white/75">
                        <p>Customer: {detail.linkedReservation.customer_name}</p>
                        <p>Phone: {detail.linkedReservation.customer_phone || "—"}</p>
                        <p>Guests: {detail.linkedReservation.party_size}</p>
                        <p>When: {formatDateTime(detail.linkedReservation.start_at)}</p>
                        <p>
                          Special request:{" "}
                          {detail.linkedReservation.special_request || detail.linkedReservation.notes || "—"}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() =>
                            router.push(`/dashboard/reservations?reservationId=${detail.linkedReservation?.id}`)
                          }
                        >
                          Open reservation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-semibold text-white">Reservation draft</p>
                      <p className="mt-1 text-xs text-white/50">
                        The bot is still collecting details for the reservation request.
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-white/75">
                        <p>Name: {String(getDraftValue(draftFields, "name") ?? "—")}</p>
                        <p>Phone: {String(getDraftValue(draftFields, "phone") ?? "—")}</p>
                        <p>Date: {String(getDraftValue(draftFields, "date") ?? "—")}</p>
                        <p>Time: {String(getDraftValue(draftFields, "time") ?? "—")}</p>
                        <p>Guests: {String(getDraftValue(draftFields, "party_size") ?? "—")}</p>
                        <p>Special request: {String(getDraftValue(draftFields, "notes") ?? "—")}</p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Status</p>
                        <p className="mt-2 text-sm text-white">Collecting details</p>
                        <p className="mt-3 text-xs text-white/55">
                          Missing fields: {missingDraftFields.length ? missingDraftFields.join(", ") : "None"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Conversation context</p>
                    <div className="mt-3 space-y-2 text-sm text-white/70">
                      <p>Intent: {detail.conversation.intent || "General inquiry"}</p>
                      <p>Started: {formatDateTime(detail.conversation.created_at)}</p>
                      <p>Last activity: {formatDateTime(detail.conversation.last_message_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
