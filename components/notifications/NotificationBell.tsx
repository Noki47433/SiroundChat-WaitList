"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { fireConfetti } from "@/components/notifications/confetti";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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

type NotificationSettings = {
  deliver_in_app: boolean;
  deliver_push: boolean;
  min_severity_to_toast: "info" | "success" | "warning" | "critical" | "celebration";
  currency: string;
  avg_order_value: number | null;
  close_rate: number | null;
};

const severityRank: Record<Notification["severity"], number> = {
  info: 0,
  success: 1,
  warning: 2,
  critical: 3,
  celebration: 4
};

const toastVariant: Record<Notification["severity"], "default" | "success" | "error" | "info"> = {
  info: "info",
  success: "success",
  warning: "info",
  critical: "error",
  celebration: "success"
};

const shouldFireConfetti = (notification: Notification) => {
  const data = notification.data ?? {};
  return notification.severity === "celebration" || data.confetti === true;
};

const shouldPush = (notification: Notification) =>
  notification.severity === "critical" || notification.severity === "celebration";

export function NotificationBell({ businessId: initialBusinessId }: { businessId?: string }) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(initialBusinessId ?? null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestBadges, setLatestBadges] = useState<BadgeSummary[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushPromptVisible, setPushPromptVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadBusinessId = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await (supabase as any)
      .from("businesses")
      .select("id")
      .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`)
      .maybeSingle();

    if (data?.id) {
      // TODO: support multi-business switching in the dashboard.
      setBusinessId(data.id);
    }
  }, []);

  useEffect(() => {
    if (businessId) return;
    void loadBusinessId();
  }, [businessId, loadBusinessId]);

  useEffect(() => {
    if (initialBusinessId) {
      setBusinessId(initialBusinessId);
    }
  }, [initialBusinessId]);

  const fetchNotifications = useCallback(
    async (targetBusinessId: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications/list?business_id=${targetBusinessId}&limit=20`);
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload) {
          return;
        }
        setNotifications(payload.notifications ?? []);
        setUnreadCount(payload.unread_count ?? 0);
        setLatestBadges(payload.latest_badges ?? []);
        setSettings(payload.settings ?? null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!businessId) return;
    void fetchNotifications(businessId);
  }, [businessId, fetchNotifications]);

  useEffect(() => {
    if (settings?.deliver_push === false) {
      setPushPromptVisible(false);
    }
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${businessId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `business_id=eq.${businessId}` },
        (payload) => {
          const incoming = payload.new as Notification;
          setNotifications((prev) => [incoming, ...prev.filter((item) => item.id !== incoming.id)].slice(0, 50));

          if (!incoming.read_at && !incoming.archived_at) {
            setUnreadCount((prev) => prev + 1);
          }

          if (settings?.deliver_in_app !== false) {
            const threshold = settings?.min_severity_to_toast ?? "success";
            if (severityRank[incoming.severity] >= severityRank[threshold]) {
              push({
                title: incoming.title,
                message: incoming.body,
                variant: toastVariant[incoming.severity]
              });
            }
          }

          if (shouldFireConfetti(incoming)) {
            fireConfetti(incoming.id);
          }

          if (settings?.deliver_push !== false && shouldPush(incoming) && typeof window !== "undefined") {
            if ("Notification" in window) {
              if (Notification.permission === "granted") {
                new Notification(incoming.title, { body: incoming.body });
              } else if (Notification.permission === "default") {
                setPushPromptVisible(true);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, push, settings]);

  const markAllRead = async () => {
    if (!businessId) return;
    await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: businessId })
    });
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id })
    });
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item))
    );
    if (target && !target.read_at) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const archive = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    await fetch("/api/notifications/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id })
    });
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (target && !target.read_at) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const enablePush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPromptVisible(false);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushPromptVisible(false);
      return;
    }
    setPushPromptVisible(false);
    push({ title: "Push enabled", message: "You will receive critical alerts instantly.", variant: "success" });
  };

  const badgeCount = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
      >
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#00A3FF] px-1 text-[11px] text-white">
            {badgeCount}
          </span>
        ) : null}
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alerts
        </span>
      </button>
      {open ? (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          latestBadges={latestBadges}
          loading={loading}
          onMarkAllRead={markAllRead}
          onMarkRead={markRead}
          onArchive={archive}
          onClose={() => setOpen(false)}
          pushPromptVisible={pushPromptVisible}
          onEnablePush={enablePush}
        />
      ) : null}
    </div>
  );
}
