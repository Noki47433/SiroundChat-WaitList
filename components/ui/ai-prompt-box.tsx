"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BrainCog, FolderCode, Globe, Mic, Paperclip, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PromptMode = "search" | "think" | "canvas";

type PromptQuickAction = {
  id: string;
  label: string;
  value: string;
  accent?: string;
  Icon?: LucideIcon;
};

type PromptInputBoxProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSend?: (message: string, files?: File[]) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  submitLabel?: string;
  disabled?: boolean;
  helperText?: string;
  variant?: "dashboard" | "chat";
  showModes?: boolean;
  modeBehavior?: "visual" | "prefix";
  showMicWhenEmpty?: boolean;
  showAttachments?: boolean;
  modeOrder?: PromptMode[];
  quickActions?: PromptQuickAction[];
  colors?: {
    panel?: string;
    border?: string;
    text?: string;
    muted?: string;
    placeholder?: string;
    sendButton?: string;
    sendIcon?: string;
  };
};

const MODE_CONFIG: Record<PromptMode, { label: string; placeholder: string; accent: string; Icon: typeof Globe }> = {
  search: {
    label: "Search",
    placeholder: "Search the web...",
    accent: "#21B2F5",
    Icon: Globe
  },
  think: {
    label: "Think",
    placeholder: "Think deeply...",
    accent: "#8B5CF6",
    Icon: BrainCog
  },
  canvas: {
    label: "Canvas",
    placeholder: "Create on canvas...",
    accent: "#F97316",
    Icon: FolderCode
  }
};

const Divider = () => (
  <div className="mx-1 h-6 w-px rounded-full bg-[linear-gradient(180deg,rgba(139,92,246,0),rgba(139,92,246,0.9),rgba(139,92,246,0))]" />
);

export function PromptInputBox({
  value,
  onValueChange,
  onSend,
  isLoading = false,
  placeholder = "Type your message here...",
  className,
  submitLabel = "Send",
  disabled = false,
  helperText,
  variant = "dashboard",
  showModes = false,
  modeBehavior = "visual",
  showMicWhenEmpty = false,
  showAttachments = true,
  modeOrder = ["search", "think", "canvas"],
  quickActions,
  colors
}: PromptInputBoxProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [activeMode, setActiveMode] = useState<PromptMode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const currentValue = value ?? internalValue;
  const palette = {
    panel: colors?.panel ?? (variant === "chat" ? "#1F2023" : "#111319"),
    border: colors?.border ?? (variant === "chat" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"),
    text: colors?.text ?? "#ffffff",
    muted: colors?.muted ?? "rgba(255,255,255,0.58)",
    placeholder: colors?.placeholder ?? "rgba(255,255,255,0.38)",
    sendButton: colors?.sendButton ?? "#ffffff",
    sendIcon: colors?.sendIcon ?? "#18181b"
  };

  const setCurrentValue = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, variant === "chat" ? 180 : 220)}px`;
  }, [currentValue, variant]);

  const hasContent = useMemo(() => currentValue.trim().length > 0 || files.length > 0, [currentValue, files.length]);

  const resolvedPlaceholder = activeMode ? MODE_CONFIG[activeMode].placeholder : placeholder;

  const submit = async () => {
    if (!hasContent || isLoading || disabled) return;
    const outgoing = currentValue.trim();
    const prefixed = activeMode && modeBehavior === "prefix" ? `[${MODE_CONFIG[activeMode].label}: ${outgoing}]` : outgoing;
    await onSend?.(prefixed, files);
    setCurrentValue("");
    setFiles([]);
    if (variant !== "chat") {
      setActiveMode(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    setFiles(Array.from(incoming).slice(0, 3));
  };

  const toggleMode = (mode: PromptMode) => {
    setActiveMode((prev) => (prev === mode ? null : mode));
    textareaRef.current?.focus();
  };

  const primaryAction = async () => {
    if (hasContent) {
      await submit();
      return;
    }
    textareaRef.current?.focus();
  };

  return (
    <div
      className={cn(
        variant === "chat"
          ? "rounded-[28px] border px-3 py-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.16)]"
          : "rounded-[28px] border p-3 shadow-[0_24px_60px_rgba(0,0,0,0.34)]",
        dragging && "ring-2 ring-[#21B2F5]/50",
        className
      )}
      style={{ background: palette.panel, borderColor: palette.border }}
      onDragOver={(event) => {
        if (!showAttachments) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!showAttachments) return;
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!showAttachments) return;
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <AnimatePresence initial={false}>
        {files.length ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 flex flex-wrap gap-2"
          >
            {files.map((file) => (
              <span
                key={`${file.name}-${file.size}`}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: palette.border, color: palette.muted, background: "rgba(255,255,255,0.04)" }}
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}
                  className="transition hover:text-white"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={(event) => setCurrentValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled || isLoading}
        placeholder={resolvedPlaceholder}
        className={cn(
          "w-full resize-none border-0 bg-transparent focus:outline-none",
          variant === "chat" ? "min-h-[40px] px-2 py-1 text-[15px] leading-6" : "min-h-[120px] px-2 py-2 text-[15px] leading-7"
        )}
        style={{ color: palette.text, caretColor: palette.text, ['--placeholder-color' as any]: palette.placeholder }}
      />

      <style jsx>{`
        textarea::placeholder {
          color: var(--placeholder-color);
        }
        textarea::-webkit-scrollbar {
          width: 6px;
        }
        textarea::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.16);
          border-radius: 999px;
        }
      `}</style>

      <div className={cn("mt-2 flex items-center justify-between gap-3", variant === "chat" ? "pt-0.5" : "") }>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {showAttachments ? (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={disabled || isLoading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: palette.muted }}
              aria-label="Attach file"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
          ) : null}

          {quickActions?.length
            ? quickActions.map((action, index) => {
                const Icon = action.Icon;
                const accent = action.accent ?? palette.text;
                return (
                  <div key={action.id} className="flex items-center">
                    {index > 0 ? <Divider /> : null}
                    <button
                      type="button"
                      onClick={() => void onSend?.(action.value, [])}
                      disabled={disabled || isLoading}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                        variant === "chat" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-sm"
                      )}
                      style={{
                        color: accent,
                        borderColor: `${accent}88`,
                        background: `${accent}14`
                      }}
                    >
                      {Icon ? <Icon className={variant === "chat" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}
                      <span>{action.label}</span>
                    </button>
                  </div>
                );
              })
            : showModes
            ? modeOrder.map((mode, index) => {
                const config = MODE_CONFIG[mode];
                const active = activeMode === mode;
                const Icon = config.Icon;
                return (
                  <div key={mode} className="flex items-center">
                    {index > 0 ? <Divider /> : null}
                    <button
                      type="button"
                      onClick={() => toggleMode(mode)}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
                        active ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]" : "border-transparent"
                      )}
                      style={{
                        color: active ? config.accent : palette.muted,
                        borderColor: active ? `${config.accent}` : "transparent",
                        background: active ? `${config.accent}18` : "transparent"
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      {active ? <span>{config.label}</span> : null}
                    </button>
                  </div>
                );
              })
            : helperText
              ? <p className="truncate text-xs" style={{ color: palette.muted }}>{helperText}</p>
              : null}
        </div>

        <button
          type="button"
          onClick={() => void primaryAction()}
          disabled={disabled || isLoading}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
            variant === "chat" ? "h-9 w-9" : "h-11 gap-2 px-4"
          )}
          style={{ background: palette.sendButton, color: palette.sendIcon }}
          aria-label={hasContent ? submitLabel : showMicWhenEmpty ? "Voice input" : submitLabel}
        >
          {variant === "chat" ? (
            hasContent || !showMicWhenEmpty ? <ArrowUp className="h-5 w-5" /> : <Mic className="h-5 w-5" />
          ) : (
            <>
              <span>{isLoading ? "Extracting..." : submitLabel}</span>
              <ArrowUp className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
