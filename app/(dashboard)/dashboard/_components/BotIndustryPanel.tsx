"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Globe,
  GripVertical,
  Instagram,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useBotSettingsSave } from "@/app/(dashboard)/dashboard/bot-settings/BotSettingsLayout";
import { useToast } from "@/components/ui/toast";
import { QUICK_BUTTON_ICON_MAP, QUICK_BUTTON_ICON_OPTIONS } from "@/lib/config/quick-button-icons";
import {
  INDUSTRY_PRESETS,
  BOT_BUSINESS_TYPES,
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  resolveBotConfig,
  type BotBusinessType,
  type ActionType,
  type QuickButton,
  type BotConfig,
} from "@/lib/config/industry-presets";

/* Re-export for backwards compatibility */
export { QUICK_BUTTON_ICON_MAP as ICON_MAP };

/* ── Types ─────────────────────────────────────────────────────────────── */

type ApiResponse = {
  botConfig?: {
    businessType: BotBusinessType;
    actionType: ActionType;
    bookingsEnabled: boolean;
    quickButtons: QuickButton[];
  };
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

const nanoid = (len = 8) => Math.random().toString(36).slice(2, 2 + len);

const BUSINESS_TYPE_ICONS: Record<BotBusinessType, string> = {
  restaurant: "🍽️",
  dental_clinic: "🦷",
  barber_shop: "✂️",
  beauty_salon: "💅",
  car_dealership: "🚗",
  real_estate_agency: "🏠",
  hotel: "🏨",
  gym: "💪",
  law_office: "⚖️",
  other: "🏢",
};

const ACTION_TYPE_ICONS: Record<ActionType, string> = {
  none: "🚫",
  restaurant_reservation: "📅",
  appointment: "📋",
  test_drive: "🚗",
  property_tour: "🏠",
  room_inquiry: "🛏️",
  consultation: "💬",
  custom: "✨",
};

const LABEL_MAX = 24;
const PROMPT_MAX = 160;

/* ── Component ──────────────────────────────────────────────────────────── */

export function BotIndustryPanel() {
  const { push } = useToast();
  const { registerSave, unregisterSave } = useBotSettingsSave();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [businessType, setBusinessType] = useState<BotBusinessType>("restaurant");
  const [actionType, setActionType] = useState<ActionType>("restaurant_reservation");
  const [bookingsEnabled, setBookingsEnabled] = useState(true);
  const [quickButtons, setQuickButtons] = useState<QuickButton[]>([]);

  const hasCustomButtons = useRef(false);

  /* ── Load ─────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch("/api/bot-settings", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!res.ok || !data) throw new Error("Failed to load bot settings");
        return data;
      })
      .then((data) => {
        if (!active) return;
        const config = resolveBotConfig(data.botConfig ?? null);
        setBusinessType(config.businessType);
        setActionType(config.actionType);
        setBookingsEnabled(config.bookingsEnabled);
        setQuickButtons(config.quickButtons);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Failed to load bot settings";
        setLoadError(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Save registration ────────────────────────────────────────────────── */

  // Keep a stable ref to current state for the save fn
  const stateRef = useRef({ businessType, actionType, bookingsEnabled, quickButtons });
  stateRef.current = { businessType, actionType, bookingsEnabled, quickButtons };

  useEffect(() => {
    const saveFn = async () => {
      const { businessType, actionType, bookingsEnabled, quickButtons } = stateRef.current;

      // Validate quick buttons before saving
      const valid = quickButtons.every(
        (btn) => btn.label.trim().length > 0 && btn.prompt.trim().length > 0
      );
      if (!valid) throw new Error("Some quick buttons have empty label or prompt.");

      const payload: BotConfig = {
        businessType,
        actionType,
        bookingsEnabled,
        quickButtons: quickButtons
          .map((btn) => ({
            ...btn,
            label: btn.label.trim().slice(0, LABEL_MAX),
            prompt: btn.prompt.trim().slice(0, PROMPT_MAX),
          }))
          .slice(0, 8),
      };

      const res = await fetch("/api/bot-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botConfig: payload }),
      });
      if (!res.ok) throw new Error("Failed to save industry settings");
    };

    registerSave("industry", saveFn);
    return () => unregisterSave("industry");
  }, [registerSave, unregisterSave]);

  /* ── Business type change ─────────────────────────────────────────────── */

  const handleBusinessTypeChange = (next: BotBusinessType) => {
    const preset = INDUSTRY_PRESETS[next];
    setBusinessType(next);
    setActionType(preset.defaultActionType);
    setBookingsEnabled(preset.defaultBookingsEnabled);
    if (!hasCustomButtons.current) {
      setQuickButtons(preset.defaultQuickButtons.map((btn) => ({ ...btn })));
    }
  };

  const handleResetToDefaults = () => {
    const preset = INDUSTRY_PRESETS[businessType];
    setQuickButtons(preset.defaultQuickButtons.map((btn) => ({ ...btn })));
    hasCustomButtons.current = false;
    push({ title: "Buttons reset", message: "Quick buttons restored to industry defaults.", variant: "success" });
  };

  /* ── Quick button CRUD ────────────────────────────────────────────────── */

  const addButton = () => {
    if (quickButtons.length >= 8) {
      push({ title: "Limit reached", message: "You can have up to 8 quick buttons.", variant: "error" });
      return;
    }
    const newBtn: QuickButton = {
      id: nanoid(),
      label: "",
      prompt: "",
      icon: undefined,
      enabled: true,
      order: quickButtons.length,
    };
    setQuickButtons((prev) => [...prev, newBtn]);
    hasCustomButtons.current = true;
  };

  const updateButton = (id: string, patch: Partial<QuickButton>) => {
    setQuickButtons((prev) => prev.map((btn) => (btn.id === id ? { ...btn, ...patch } : btn)));
    hasCustomButtons.current = true;
  };

  const removeButton = (id: string) => {
    setQuickButtons((prev) =>
      prev.filter((btn) => btn.id !== id).map((btn, idx) => ({ ...btn, order: idx }))
    );
    hasCustomButtons.current = true;
  };

  const moveButton = (id: string, direction: "up" | "down") => {
    setQuickButtons((prev) => {
      const idx = prev.findIndex((btn) => btn.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((btn, i) => ({ ...btn, order: i }));
    });
    hasCustomButtons.current = true;
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-8 text-center">
        <p className="text-sm text-red-400">{loadError}</p>
      </div>
    );
  }

  const currentPreset = INDUSTRY_PRESETS[businessType];
  const enabledActionTypes: ActionType[] =
    businessType === "restaurant"
      ? ACTION_TYPES.filter((t) => t !== "none")
      : ACTION_TYPES.filter((t) => t !== "restaurant_reservation");

  return (
    <div className="space-y-4">

      {/* ── Business Type ──────────────────────────────────────────────────── */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Business Type"
        description="Shapes wording, default actions, and quick buttons for your AI assistant."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {BOT_BUSINESS_TYPES.map((type) => {
            const preset = INDUSTRY_PRESETS[type];
            const isActive = businessType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleBusinessTypeChange(type)}
                className={cn(
                  "group relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-all duration-150",
                  isActive
                    ? "border-sky-500/60 bg-sky-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <span className="text-xl leading-none">{BUSINESS_TYPE_ICONS[type]}</span>
                <span className="text-[11px] font-medium leading-tight">{preset.label}</span>
                {isActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sky-400" />}
              </button>
            );
          })}
        </div>
        {currentPreset && <p className="mt-3 text-xs text-white/40">{currentPreset.description}</p>}
      </Section>

      {/* ── Customer Action ────────────────────────────────────────────────── */}
      <Section
        icon={<Sparkles className="h-4 w-4" />}
        title="Customer Action"
        description="Control whether customers can book, request, or only ask questions."
      >
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Enable bookings &amp; requests</p>
            <p className="text-xs text-white/40">When off, the assistant only answers questions.</p>
          </div>
          <button
            type="button"
            onClick={() => setBookingsEnabled((v) => !v)}
            className="shrink-0 text-white/60 transition-colors hover:text-white"
            aria-label="Toggle bookings"
          >
            {bookingsEnabled ? (
              <ToggleRight className="h-8 w-8 text-sky-400" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-white/30" />
            )}
          </button>
        </div>

        {bookingsEnabled && (
          <div className="mt-3">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/50">
              Action Type
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {enabledActionTypes.map((type) => {
                const isActive = actionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActionType(type)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium transition-all duration-150",
                      isActive
                        ? "border-sky-500/60 bg-sky-500/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    <span className="text-base leading-none">{ACTION_TYPE_ICONS[type]}</span>
                    <span className="leading-snug">{ACTION_TYPE_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ── Quick Buttons ──────────────────────────────────────────────────── */}
      <Section
        icon={<MessageSquare className="h-4 w-4" />}
        title="Chatbot Quick Buttons"
        description="Shortcuts shown above the chat input. Customers click to instantly send these prompts."
        headerRight={
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        }
      >
        <div className="space-y-2">
          {quickButtons.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/30">
              No buttons configured. Add one below.
            </div>
          )}

          {quickButtons.map((btn, idx) => (
            <QuickButtonRow
              key={btn.id}
              button={btn}
              index={idx}
              total={quickButtons.length}
              onChange={(patch) => updateButton(btn.id, patch)}
              onRemove={() => removeButton(btn.id)}
              onMove={(dir) => moveButton(btn.id, dir)}
            />
          ))}
        </div>

        {quickButtons.length < 8 && (
          <button
            type="button"
            onClick={addButton}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-sm text-white/40 transition hover:border-sky-500/40 hover:text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add button
          </button>
        )}

        <p className="mt-2 text-[11px] text-white/30">
          Up to 8 buttons · Labels max {LABEL_MAX} chars · Prompts max {PROMPT_MAX} chars
        </p>
      </Section>

      {/* ── Channel Behavior ───────────────────────────────────────────────── */}
      <Section
        icon={<Globe className="h-4 w-4" />}
        title="Channel Behavior"
        description="This configuration powers your AI across all connected channels."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { icon: <Globe className="h-4 w-4" />, label: "Website Chatbot", status: "Active" },
            { icon: <MessageSquare className="h-4 w-4" />, label: "WhatsApp", status: "Uses same config" },
            { icon: <Instagram className="h-4 w-4" />, label: "Instagram", status: "Uses same config" },
          ].map((channel) => (
            <div
              key={channel.label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <span className="shrink-0 text-sky-400">{channel.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{channel.label}</p>
                <p className="text-xs text-white/40">{channel.status}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  description,
  children,
  headerRight,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-sky-400">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-white/40">{description}</p>}
          </div>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Quick button row ───────────────────────────────────────────────────── */

function QuickButtonRow({
  button,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  button: QuickButton;
  index: number;
  total: number;
  onChange: (patch: Partial<QuickButton>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [expanded, setExpanded] = useState(!button.label && !button.prompt);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const SelectedIcon = button.icon ? QUICK_BUTTON_ICON_MAP[button.icon] : null;

  const labelError = button.label.trim().length === 0 ? "Label is required" : null;
  const promptError = button.prompt.trim().length === 0 ? "Prompt is required" : null;
  const hasError = labelError || promptError;

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        hasError
          ? "border-red-500/30 bg-red-500/5"
          : button.enabled
            ? "border-white/10 bg-white/[0.03]"
            : "border-white/5 bg-white/[0.015] opacity-60"
      )}
    >
      {/* Collapsed row header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-white/20" />

        {/* Order controls */}
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="h-4 w-4 text-white/30 transition hover:text-white disabled:opacity-20"
            aria-label="Move up"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            className="h-4 w-4 text-white/30 transition hover:text-white disabled:opacity-20"
            aria-label="Move down"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Icon preview chip */}
        <button
          type="button"
          onClick={() => {
            setIconPickerOpen((v) => !v);
            if (!expanded) setExpanded(true);
          }}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition",
            button.icon
              ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
              : "border-white/10 bg-white/5 text-white/25 hover:border-white/20 hover:text-white/50"
          )}
          aria-label="Choose icon"
          title="Choose icon"
        >
          {SelectedIcon ? <SelectedIcon className="h-3.5 w-3.5" /> : <span className="text-[10px]">+</span>}
        </button>

        {/* Label preview */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={cn("truncate text-sm", button.label ? "text-white" : "text-white/30")}>
            {button.label || "Untitled button"}
          </span>
          {button.prompt && (
            <span className="hidden truncate text-xs text-white/30 sm:block">
              — {button.prompt.slice(0, 35)}{button.prompt.length > 35 ? "…" : ""}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 shrink-0 text-white/30 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>

        {/* Enable toggle */}
        <button
          type="button"
          onClick={() => onChange({ enabled: !button.enabled })}
          className="shrink-0 text-white/40 transition hover:text-white"
          aria-label={button.enabled ? "Disable button" : "Enable button"}
        >
          {button.enabled ? (
            <ToggleRight className="h-5 w-5 text-sky-400" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-white/25" />
          )}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-white/20 transition hover:text-red-400"
          aria-label="Remove button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-3">
          {/* Icon picker */}
          {iconPickerOpen && (
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">
                Button icon
              </label>
              <div className="grid grid-cols-10 gap-1">
                {/* No icon option */}
                <button
                  type="button"
                  onClick={() => {
                    onChange({ icon: undefined });
                    setIconPickerOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] text-white/30 transition",
                    !button.icon
                      ? "border-sky-500/60 bg-sky-500/10 text-sky-400"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                  title="No icon"
                  aria-label="No icon"
                >
                  —
                </button>
                {QUICK_BUTTON_ICON_OPTIONS.map(({ key, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange({ icon: key });
                      setIconPickerOpen(false);
                    }}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border transition",
                      button.icon === key
                        ? "border-sky-500/60 bg-sky-500/10 text-sky-400"
                        : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white"
                    )}
                    title={key}
                    aria-label={key}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Label */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">Label</label>
              <span
                className={cn(
                  "text-[10px]",
                  button.label.length >= LABEL_MAX ? "text-amber-400" : "text-white/20"
                )}
              >
                {button.label.length}/{LABEL_MAX}
              </span>
            </div>
            <input
              type="text"
              value={button.label}
              onChange={(e) => onChange({ label: e.target.value.slice(0, LABEL_MAX) })}
              placeholder="e.g. Book Appointment"
              maxLength={LABEL_MAX}
              className={cn(
                "w-full rounded-lg border bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none transition focus:ring-1",
                labelError
                  ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
                  : "border-white/10 focus:border-sky-500/50 focus:ring-sky-500/30"
              )}
            />
            {labelError && <p className="mt-1 text-[11px] text-red-400">{labelError}</p>}
            <p className="mt-0.5 text-[10px] text-white/25">Shown on the chatbot button. Keep it short.</p>
          </div>

          {/* Prompt */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Prompt sent when clicked
              </label>
              <span
                className={cn(
                  "text-[10px]",
                  button.prompt.length >= PROMPT_MAX ? "text-amber-400" : "text-white/20"
                )}
              >
                {button.prompt.length}/{PROMPT_MAX}
              </span>
            </div>
            <textarea
              value={button.prompt}
              onChange={(e) => onChange({ prompt: e.target.value.slice(0, PROMPT_MAX) })}
              placeholder="e.g. I'd like to book an appointment"
              maxLength={PROMPT_MAX}
              rows={2}
              className={cn(
                "w-full resize-none rounded-lg border bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none transition focus:ring-1",
                promptError
                  ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
                  : "border-white/10 focus:border-sky-500/50 focus:ring-sky-500/30"
              )}
            />
            {promptError && <p className="mt-1 text-[11px] text-red-400">{promptError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
