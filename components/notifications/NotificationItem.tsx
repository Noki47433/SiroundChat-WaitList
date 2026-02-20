"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Archive } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Notification = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical" | "celebration";
  category: "revenue" | "growth" | "ops" | "quality" | "product" | "insight";
  cta_label?: string | null;
  cta_url?: string | null;
  created_at: string;
  read_at?: string | null;
  archived_at?: string | null;
  data?: Record<string, unknown> | null;
};

type NotificationItemProps = {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigate?: () => void;
};

const severityStyles: Record<Notification["severity"], string> = {
  info: "bg-sky-500/20 text-sky-200",
  success: "bg-emerald-500/20 text-emerald-200",
  warning: "bg-amber-500/20 text-amber-100",
  critical: "bg-red-500/20 text-red-200",
  celebration: "bg-fuchsia-500/20 text-fuchsia-200"
};

const formatTimeAgo = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDistanceToNow(date, { addSuffix: true });
};

export function NotificationItem({ notification, onMarkRead, onArchive, onNavigate }: NotificationItemProps) {
  const timeAgo = formatTimeAgo(notification.created_at);
  const isUnread = !notification.read_at;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-white/5 p-3 transition",
        isUnread ? "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" : "opacity-80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", severityStyles[notification.severity])} />
          <p className={cn("text-sm font-semibold", isUnread ? "text-white" : "text-white/70")}>
            {notification.title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onArchive(notification.id)}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Archive notification"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-white/70">{notification.body}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/40">
        <span>{timeAgo}</span>
        {notification.cta_label && notification.cta_url ? (
          <Link
            href={notification.cta_url}
            className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => {
              onMarkRead(notification.id);
              onNavigate?.();
            }}
          >
            {notification.cta_label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
