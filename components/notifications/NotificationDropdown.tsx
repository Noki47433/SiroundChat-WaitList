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
    <div className="dashboard-surface absolute right-0 z-[220] mt-3 w-[min(420px,calc(100vw-1rem))] rounded-3xl border border-[#ffd87255] bg-[#070d17]/95 p-3 shadow-[0_30px_75px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <p className="dashboard-heading text-base font-semibold text-white">Notifications</p>
        {unreadCount > 0 ? (
          <button
            className="dashboard-pill rounded-full border border-[#ffd87255] px-3 py-1 text-[11px] font-medium text-[#e8d7a7] transition hover:text-white"
            onClick={onMarkAllRead}
            type="button"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {pushPromptVisible ? (
        <div className="dashboard-inset mt-3 rounded-2xl border border-[#ffd8723d] p-3 text-xs text-[#dccb99]">
          <p className="font-semibold text-white">Enable push notifications for important alerts</p>
          <p className="mt-1 text-[#ccb98f]">Get critical and celebration updates even when the tab is closed.</p>
          <Button
            variant="secondary"
            size="sm"
            className="dashboard-pill mt-2 w-full border border-[#ffd87266] text-[#f3db9b] hover:text-white"
            onClick={onEnablePush}
            type="button"
          >
            Enable push
          </Button>
        </div>
      ) : null}

      <BadgesPreview badges={latestBadges} />

      <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1 text-xs text-[#d8c79a]">
        {loading ? <p className="dashboard-inset rounded-2xl p-3 text-xs">Loading updates...</p> : null}
        {!loading && notifications.length === 0 ? (
          <p className="dashboard-inset rounded-2xl p-3 text-xs">
            No notifications yet. You’ll see important insights as customers interact.
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
