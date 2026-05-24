"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  BrainCog,
  Mic,
  Paperclip,
  Square,
  X,
  type LucideIcon
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

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
  onSend?: (
    message: string,
    files?: File[],
    options?: { thinkMode: boolean }
  ) => boolean | void | Promise<boolean | void>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  submitLabel?: string;
  disabled?: boolean;
  helperText?: string;
  variant?: "editor" | "dashboard" | "chat";
  showMicWhenEmpty?: boolean;
  showAttachments?: boolean;
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
  thinkEnabled?: boolean;
  onThinkEnabledChange?: (value: boolean) => void;
};

const MAX_FILES = 3;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const isImageFile = (file: File) => ACCEPTED_TYPES.has(file.type);

const Divider = () => (
  <div className="mx-1 h-7 w-px rounded-full bg-[linear-gradient(180deg,rgba(139,92,246,0),rgba(139,92,246,0.88),rgba(139,92,246,0))]" />
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
  showMicWhenEmpty = false,
  showAttachments = true,
  quickActions,
  colors,
  thinkEnabled,
  onThinkEnabledChange
}: PromptInputBoxProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [internalThinkEnabled, setInternalThinkEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewsRef = useRef<Record<string, string>>({});

  const isEditor = variant === "editor";
  const allowAttachments = showAttachments || isEditor;
  const currentValue = value ?? internalValue;
  const currentThinkEnabled = thinkEnabled ?? internalThinkEnabled;
  const hasContent = currentValue.trim().length > 0 || files.length > 0;
  const isDisabled = disabled || isLoading;

  const palette = {
    panel: colors?.panel ?? (variant === "chat" ? "#1F2023" : "#111319"),
    border:
      colors?.border ??
      (variant === "chat" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"),
    text: colors?.text ?? "#ffffff",
    muted: colors?.muted ?? "rgba(255,255,255,0.58)",
    placeholder: colors?.placeholder ?? "rgba(255,255,255,0.38)",
    sendButton: colors?.sendButton ?? "#ffffff",
    sendIcon: colors?.sendIcon ?? "#18181b"
  };

  const previewEntries = files.map((file) => ({
    file,
    key: `${file.name}-${file.size}-${file.lastModified}`,
    preview: previews[`${file.name}-${file.size}-${file.lastModified}`] ?? null
  }));

  const setCurrentValue = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  const setThinkMode = (next: boolean) => {
    setInternalThinkEnabled(next);
    onThinkEnabledChange?.(next);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = isEditor ? 210 : variant === "chat" ? 180 : 220;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [currentValue, isEditor, variant]);

  useEffect(() => {
    setPreviews((current) => {
      const next: Record<string, string> = {};

      files.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        next[key] = current[key] ?? URL.createObjectURL(file);
      });

      Object.entries(current).forEach(([key, url]) => {
        if (!(key in next)) {
          URL.revokeObjectURL(url);
        }
      });

      const nextKeys = Object.keys(next);
      const currentKeys = Object.keys(current);
      const unchanged =
        nextKeys.length === currentKeys.length &&
        nextKeys.every((key) => current[key] === next[key]);

      return unchanged ? current : next;
    });
  }, [files]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const mergeFiles = useCallback((incoming: File[]) => {
    if (!allowAttachments) return;
    const valid = incoming.filter(
      (file) => isImageFile(file) && file.size <= MAX_FILE_SIZE
    );
    if (!valid.length) return;
    setFiles((current) => {
      const next = [...current];
      valid.forEach((file) => {
        if (next.length >= MAX_FILES) return;
        if (
          next.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size &&
              existing.lastModified === file.lastModified
          )
        ) {
          return;
        }
        next.push(file);
      });
      return next;
    });
  }, [allowAttachments]);

  useEffect(() => {
    if (!allowAttachments) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (isDisabled) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
      if (!pastedFiles.length) return;
      event.preventDefault();
      mergeFiles(pastedFiles);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [allowAttachments, isDisabled, mergeFiles]);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    mergeFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  };

  const removeFile = (target: File) => {
    const key = `${target.name}-${target.size}-${target.lastModified}`;
    setFiles((current) => current.filter((file) => file !== target));
    setPreviews((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (selectedPreview === previews[key]) {
      setSelectedPreview(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!allowAttachments) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (isDisabled) return;
    mergeFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const submit = async () => {
    if (!hasContent || isDisabled) return;
    const result = await onSend?.(currentValue.trim(), files, {
      thinkMode: currentThinkEnabled
    });
    if (result === false) return;
    setCurrentValue("");
    setFiles([]);
    setPreviews({});
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const rootClassName = isEditor
    ? "rounded-[38px] border border-white/12 bg-[#212124] px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-colors duration-300"
    : variant === "chat"
      ? "rounded-[28px] border px-3 py-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.16)]"
      : "rounded-[28px] border p-3 shadow-[0_24px_60px_rgba(0,0,0,0.34)]";

  return (
    <>
      <motion.div
        layout
        className={cn(
          rootClassName,
          dragging &&
            (isEditor
              ? "border-[#8b5cf6]/70 shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_20px_60px_rgba(0,0,0,0.35)]"
              : "ring-2 ring-[#21B2F5]/50"),
          className
        )}
        style={isEditor ? undefined : { background: palette.panel, borderColor: palette.border }}
        onDragOver={(event) => {
          if (!allowAttachments) return;
          event.preventDefault();
          event.stopPropagation();
          if (!isDisabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!allowAttachments) return;
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <AnimatePresence initial={false}>
          {previewEntries.length ? (
            isEditor ? (
              <motion.div
                key="editor-previews"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex flex-wrap gap-3"
              >
                {previewEntries.map(({ file, key, preview }) => (
                  <motion.div
                    key={key}
                    layout
                    whileHover={{ y: -2 }}
                    onClick={() => preview && setSelectedPreview(preview)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#17171a]"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={file.name}
                        className="h-16 w-16 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center text-xs text-white/45">
                        {file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFile(file);
                      }}
                      className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white/80 opacity-0 transition group-hover:opacity-100"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="shared-previews"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3 flex flex-wrap gap-2"
              >
                {previewEntries.map(({ file, key }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                    style={{
                      borderColor: palette.border,
                      color: palette.muted,
                      background: "rgba(255,255,255,0.04)"
                    }}
                  >
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      className="transition hover:text-white"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </motion.div>
            )
          ) : null}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={currentValue}
          onChange={(event) => setCurrentValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isDisabled}
          placeholder={placeholder}
          className={cn(
            "w-full resize-none border-0 bg-transparent outline-none",
            isEditor
              ? "min-h-[78px] p-0 text-[17px] leading-9 tracking-[-0.01em] text-[#eef2ff] placeholder:text-[#b8bcc8]"
              : variant === "chat"
                ? "min-h-[40px] px-2 py-1 text-[15px] leading-6"
                : "min-h-[120px] px-2 py-2 text-[15px] leading-7"
          )}
          style={
            isEditor
              ? undefined
              : {
                  color: palette.text,
                  caretColor: palette.text,
                  ["--placeholder-color" as string]: palette.placeholder
                }
          }
        />

        {!isEditor ? (
          <style jsx>{`
            textarea::placeholder {
              color: var(--placeholder-color);
            }
            textarea::-webkit-scrollbar {
              width: 6px;
            }
            textarea::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.16);
              border-radius: 999px;
            }
          `}</style>
        ) : null}

        <div
          className={cn(
            isEditor ? "mt-4 flex items-center justify-between gap-4" : "mt-2 flex items-center justify-between gap-3",
            variant === "chat" ? "pt-0.5" : ""
          )}
        >
          <div
            className={cn(
              isEditor
                ? "flex min-w-0 items-center gap-1"
                : "flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
          >
            {allowAttachments ? (
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isDisabled}
                className={cn(
                  isEditor
                    ? "inline-flex h-10 w-10 items-center justify-center rounded-full text-[#b8bcc8] transition hover:bg-white/5 hover:text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-full transition"
                )}
                style={isEditor ? undefined : { color: palette.muted }}
                aria-label={isEditor ? "Attach screenshot" : "Attach file"}
              >
                <Paperclip className={isEditor ? "h-5 w-5" : "h-4.5 w-4.5"} />
              </button>
            ) : null}

            {isEditor ? (
              <>
                <Divider />
                <button
                  type="button"
                  onClick={() => setThinkMode(!currentThinkEnabled)}
                  disabled={isDisabled}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 overflow-hidden rounded-full border px-2.5 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50",
                    currentThinkEnabled
                      ? "border-[#8b5cf6] bg-[#8b5cf6]/15 text-[#b998ff]"
                      : "border-transparent bg-transparent text-[#b8bcc8] hover:bg-white/5 hover:text-white"
                  )}
                  aria-pressed={currentThinkEnabled}
                >
                  <motion.div
                    animate={{
                      rotate: currentThinkEnabled ? 180 : 0,
                      scale: currentThinkEnabled ? 1.06 : 1
                    }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <BrainCog className="h-[18px] w-[18px]" />
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {currentThinkEnabled ? (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        Think
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              </>
            ) : quickActions?.length ? (
              quickActions.map((action, index) => {
                const Icon = action.Icon;
                const accent = action.accent ?? palette.text;
                return (
                  <div key={action.id} className="flex items-center">
                    {index > 0 ? <Divider /> : null}
                    <button
                      type="button"
                      onClick={() => void onSend?.(action.value, [])}
                      disabled={isDisabled}
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
                      {Icon ? (
                        <Icon className={variant === "chat" ? "h-3.5 w-3.5" : "h-4 w-4"} />
                      ) : null}
                      <span>{action.label}</span>
                    </button>
                  </div>
                );
              })
            ) : helperText ? (
              <p className="truncate text-xs" style={{ color: palette.muted }}>
                {helperText}
              </p>
            ) : null}
          </div>

          {isEditor ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (hasContent) {
                  void submit();
                  return;
                }
                textareaRef.current?.focus();
              }}
              disabled={isDisabled}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-[#18181b] shadow-[0_12px_30px_rgba(255,255,255,0.12)] transition hover:bg-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={hasContent ? "Send edit" : "Voice input"}
            >
              {isLoading ? (
                <Square className="h-[18px] w-[18px] fill-current" />
              ) : hasContent ? (
                <ArrowUp className="h-5 w-5" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </motion.button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isDisabled}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                variant === "chat" ? "h-9 w-9" : "h-11 gap-2 px-4"
              )}
              style={{ background: palette.sendButton, color: palette.sendIcon }}
              aria-label={hasContent ? submitLabel : showMicWhenEmpty ? "Voice input" : submitLabel}
            >
              {variant === "chat" ? (
                hasContent || !showMicWhenEmpty ? (
                  <ArrowUp className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )
              ) : (
                <>
                  <span>{isLoading ? "Extracting..." : submitLabel}</span>
                  <ArrowUp className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </motion.div>

      {isEditor ? (
        <Dialog
          open={Boolean(selectedPreview)}
          onClose={() => setSelectedPreview(null)}
          panelClassName="max-w-3xl border-white/10 bg-[#111113] p-0"
          contentClassName="p-0"
        >
          {selectedPreview ? (
            <img
              src={selectedPreview}
              alt="Attached reference"
              className="max-h-[80vh] w-full rounded-[28px] object-contain"
            />
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
