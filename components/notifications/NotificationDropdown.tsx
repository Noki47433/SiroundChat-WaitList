"use client";

import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { BadgesPreview } from "@/components/badges/BadgesPreview";

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

type BadgeSummary = {
  key: string;
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earned_at: string;
};

type NotificationDropdownProps = {
  notifications: Notification[];
  unreadCount: number;
  latestBadges: BadgeSummary[];
  loading?: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onClose: () => void;
  pushPromptVisible?: boolean;
  onEnablePush?: () => void;
};

export function NotificationDropdown({
  notifications,
  unreadCount,
  latestBadges,
  loading,
  onMarkAllRead,
  onMarkRead,
  onArchive,
  onClose,
  pushPromptVisible,
  onEnablePush
}: NotificationDropdownProps) {
  return (
    <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border border-white/10 bg-neutral-950 p-3 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Notifications</p>
        {unreadCount > 0 ? (
          <button className="text-xs text-white/60 hover:text-white" onClick={onMarkAllRead} type="button">
            Mark all read
          </button>
        ) : null}
      </div>

      {pushPromptVisible ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <p className="font-semibold text-white">Enable push notifications for important alerts</p>
          <p className="mt-1 text-white/60">Get critical and celebration updates even when the tab is closed.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={onEnablePush}
            type="button"
          >
            Enable push
          </Button>
        </div>
      ) : null}

      <BadgesPreview badges={latestBadges} />

      <div className="mt-3 space-y-2 text-xs text-white/70">
        {loading ? <p className="rounded-xl border border-white/5 bg-white/5 p-3 text-xs">Loading updates...</p> : null}
        {!loading && notifications.length === 0 ? (
          <p className="rounded-xl border border-white/5 bg-white/5 p-3 text-xs">
            No notifications yet — you’ll see important insights as customers interact.
          </p>
        ) : null}
        {notifications.map((item) => (
          <NotificationItem
            key={item.id}
            notification={item}
            onMarkRead={onMarkRead}
            onArchive={onArchive}
            onNavigate={onClose}
          />
        ))}
      </div>
    </div>
  );
}
