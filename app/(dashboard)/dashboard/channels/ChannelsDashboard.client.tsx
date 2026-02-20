"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Inbox = {
  id: string;
  channel: "whatsapp" | "instagram";
  external_account_id: string;
  status: "connected" | "disconnected" | "pending";
};

type Thread = {
  key: string;
  inboxId: string;
  customerId: string | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  lastMessage: { body: string; direction: "in" | "out"; created_at: string };
  count: number;
};

export default function ChannelsDashboardClient() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({
    channel: "whatsapp",
    externalAccountId: "",
    token: ""
  });

  const inboxMap = useMemo(() => new Map(inboxes.map((inbox) => [inbox.id, inbox])), [inboxes]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inboxesRes, threadsRes] = await Promise.all([
        fetch("/api/channels/inboxes", { cache: "no-store" }),
        fetch("/api/channels/messages", { cache: "no-store" })
      ]);

      const inboxesPayload = await inboxesRes.json();
      const threadsPayload = await threadsRes.json();

      if (!inboxesRes.ok) throw new Error(inboxesPayload?.error ?? "Failed to load inboxes");
      if (!threadsRes.ok) throw new Error(threadsPayload?.error ?? "Failed to load messages");

      setInboxes(inboxesPayload.inboxes ?? []);
      setThreads(threadsPayload.threads ?? []);
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (thread: Thread) => {
    setSelectedThread(thread);
    try {
      const response = await fetch(
        `/api/channels/messages?inboxId=${encodeURIComponent(thread.inboxId)}&customerId=${encodeURIComponent(thread.customerId ?? "__null__")}`,
        { cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load thread");
      }
      setThreadMessages(payload.thread ?? []);
    } catch (error) {
      push({ title: "Load thread failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
      setThreadMessages([]);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveInbox = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/channels/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectForm)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to connect channel");
      }
      push({ title: "Connected", message: "Channel inbox saved", variant: "success" });
      setConnectOpen(false);
      setConnectForm({ channel: "whatsapp", externalAccountId: "", token: "" });
      await loadData();
    } catch (error) {
      push({ title: "Connect failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    const inbox = inboxMap.get(selectedThread.inboxId);
    if (!inbox) return;

    const to = selectedThread.customer?.phone ?? selectedThread.customer?.email;
    if (!to) {
      push({ title: "Missing recipient", message: "Selected thread has no contact identifier", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/channels/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxId: selectedThread.inboxId,
          customerId: selectedThread.customerId,
          to,
          body: replyText
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to queue reply");
      }

      push({ title: "Queued", message: "Reply was queued for delivery", variant: "success" });
      setReplyText("");
      await loadThread(selectedThread);
      await loadData();
    } catch (error) {
      push({ title: "Reply failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-white/70">Loading channels...</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Connected Channels</h3>
          <p className="text-sm text-white/60">WhatsApp and Instagram DM inboxes (integration-ready).</p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>Connect channel</Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="space-y-3">
          <h4 className="text-sm uppercase tracking-[0.2em] text-white/50">Threads</h4>
          {threads.length ? (
            threads.map((thread) => {
              const active = selectedThread?.key === thread.key;
              const label =
                thread.customer?.name ?? thread.customer?.phone ?? thread.customer?.email ?? "Unknown customer";

              return (
                <button
                  key={thread.key}
                  type="button"
                  onClick={() => void loadThread(thread)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-white/60">{thread.lastMessage.body}</p>
                  <p className="mt-1 text-[11px] text-white/50">
                    {new Date(thread.lastMessage.created_at).toLocaleString()} • {thread.count} messages
                  </p>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-white/60">No channel messages yet.</p>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold">Inbox Thread</h4>
              {selectedThread ? (
                <p className="text-xs text-white/60">
                  {selectedThread.customer?.name ?? selectedThread.customer?.phone ?? selectedThread.customer?.email ?? "Unknown customer"}
                </p>
              ) : (
                <p className="text-xs text-white/60">Select a thread to view messages</p>
              )}
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
            {threadMessages.length ? (
              threadMessages.map((message) => (
                <div key={message.id} className="rounded-xl border border-white/10 bg-white/5 p-2 text-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    {message.direction === "in" ? "Incoming" : "Outgoing"}
                  </p>
                  <p className="mt-1 text-white/90">{message.body}</p>
                  <p className="mt-1 text-[11px] text-white/50">{new Date(message.created_at).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">No messages for this thread.</p>
            )}
          </div>

          <div className="space-y-2">
            <Textarea
              rows={4}
              placeholder="Type a reply"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
            />
            <Button onClick={sendReply} disabled={saving || !selectedThread || !replyText.trim()}>
              Send reply
            </Button>
          </div>
        </Card>
      </div>

      <Card className="space-y-2">
        <h4 className="text-sm uppercase tracking-[0.2em] text-white/50">Inbox Connections</h4>
        {inboxes.length ? (
          inboxes.map((inbox) => (
            <div key={inbox.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium">{inbox.channel.toUpperCase()}</p>
              <p className="text-xs text-white/60">External account: {inbox.external_account_id}</p>
              <p className="text-xs text-white/60">Status: {inbox.status}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/60">No channels connected yet.</p>
        )}
      </Card>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect channel"
        footer={
          <>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveInbox} disabled={saving || !connectForm.externalAccountId.trim()}>
              Save connection
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">Channel</span>
            <select
              value={connectForm.channel}
              onChange={(event) => setConnectForm((prev) => ({ ...prev, channel: event.target.value }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <Input
            placeholder="External account ID"
            value={connectForm.externalAccountId}
            onChange={(event) => setConnectForm((prev) => ({ ...prev, externalAccountId: event.target.value }))}
          />
          <Input
            placeholder="Access token (optional in demo)"
            value={connectForm.token}
            onChange={(event) => setConnectForm((prev) => ({ ...prev, token: event.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
