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
  info: "bg-[#74b8ff]",
  success: "bg-[#4cd48b]",
  warning: "bg-[#f4c85d]",
  critical: "bg-[#ff7d89]",
  celebration: "bg-[#f8d36d]"
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
        "dashboard-inset rounded-2xl border p-3 transition",
        isUnread
          ? "border-[#ffd8725a] bg-[linear-gradient(160deg,rgba(48,34,11,0.32),rgba(15,22,35,0.9))] shadow-[0_0_0_1px_rgba(255,216,109,0.18)]"
          : "border-white/10 opacity-90"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", severityStyles[notification.severity])} />
          <p className={cn("text-sm font-semibold", isUnread ? "text-white" : "text-white/80")}>
            {notification.title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onArchive(notification.id)}
          className="dashboard-pill rounded-lg p-1 text-white/50 transition hover:text-white"
          aria-label="Archive notification"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-[#dfd0a6]">{notification.body}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#a58f5a]">
        <span>{timeAgo}</span>
        {notification.cta_label && notification.cta_url ? (
          <Link
            href={notification.cta_url}
            className="dashboard-pill rounded-full border border-[#ffd87266] px-3 py-1 text-[11px] text-[#ecd9a8] transition hover:text-white"
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
