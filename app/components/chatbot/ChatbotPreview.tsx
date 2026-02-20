'use client';
// Summary: Core preview widget that mirrors launcher + window behavior from builder settings.

import { useEffect, useState } from "react"; // useEffect reports open/close state to the embed host
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ChatbotConfig } from "./chatbotTypes";
import { ChatbotConversationWindow } from "./ChatbotConversationWindow";
import { ICON_LIBRARY } from "./ChatbotIconLibrary";

type ChatbotPreviewProps = {
  config: ChatbotConfig;
  interactive?: boolean;
  autoPlayDemo?: boolean;
  showChrome?: boolean;
  startCollapsed?: boolean;
  autoOpen?: boolean; // Opens the preview by default while still showing "Back to launcher"
  onOpenChange?: (open: boolean) => void; // Notifies the embed host when open/close toggles
};

export function ChatbotPreview({
  config,
  interactive = true,
  autoPlayDemo = false,
  showChrome = false,
  startCollapsed = false,
  autoOpen = false,
  onOpenChange
}: ChatbotPreviewProps) {
  const IconEntry = config.iconId ? ICON_LIBRARY.find((entry) => entry.id === config.iconId) : undefined;
  // Tracks whether preview window is open; removing state would stop the launcher toggle demo.
  const [isOpen, setIsOpen] = useState(!startCollapsed || autoOpen); // Default open when autoOpen is enabled

  useEffect(() => {
    onOpenChange?.(isOpen); // Report open state so the iframe can resize around the widget
  }, [isOpen, onOpenChange]); // Re-run whenever open state changes

  const launcherShape =
    config.launcherShape === "square" ? "rounded-xl" : config.launcherShape === "pill" ? "rounded-[18px]" : "rounded-full";
  const isIconOnly = (config.launcherVariant ?? "iconWithLabel") === "icon";
  const launcherStyles: CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor || config.theme.primaryColor})`
  };

  return (
    <div
      className="relative"
      style={
        {
          "--chat-primary": config.theme.primaryColor,
          "--chat-accent": config.theme.accentColor,
          "--chat-bg": config.theme.backgroundColor,
          "--chat-text": config.theme.textColor
        } as CSSProperties
      }
    >
      {startCollapsed && !isOpen ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsOpen(true)} // Open the preview when the launcher is clicked
          aria-label={`Open ${config.businessName} chat preview`}
          className={`absolute right-4 top-4 inline-flex items-center ${isIconOnly ? "gap-0 p-3" : "gap-2 px-4 py-3"} text-sm font-semibold text-white shadow-lg shadow-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-white ${launcherShape}`}
          style={launcherStyles}
        >
          <span className={`flex items-center justify-center rounded-full bg-white/20 ${isIconOnly ? "h-7 w-7" : "h-5 w-5"}`}>
            {config.logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.logoUrl}
                  alt="logo"
                  className={`${isIconOnly ? "h-7 w-7" : "h-5 w-5"} rounded-full object-cover`}
                />
              </>
            ) : IconEntry ? (
              <IconEntry.Icon className={`${isIconOnly ? "h-5 w-5" : "h-4 w-4"} text-white`} />
            ) : (
              <span className="text-[10px] font-bold">{config.businessName[0] || "S"}</span>
            )}
          </span>
          {isIconOnly ? <span className="sr-only">Chat</span> : "Chat"}
        </motion.button>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        animate={isOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full rounded-[30px] border bg-white/10 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop-blur-xl"
        style={{
          backgroundColor: config.theme.backgroundColor,
          color: config.theme.textColor,
          display: isOpen ? "block" : "none",
          borderColor: config.theme.primaryColor + "33"
        }}
      >
        {startCollapsed ? (
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsOpen(false)} // Close back to the launcher state
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-white"
            >
              Back to launcher
            </button>
            <span className="text-[11px] font-semibold text-slate-600">Preview open</span>
          </div>
        ) : null}
        {showChrome ? (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-black/10 px-3 py-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
        ) : null}

        <div
          className="rounded-2xl border border-white/10 px-4 py-3 shadow-inner"
          style={{
            background: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor || config.theme.primaryColor})`,
            color: "#ffffff"
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-inner">
              {config.logoUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={config.logoUrl} alt={`${config.businessName} logo`} className="h-full w-full object-cover" />
                </>
              ) : IconEntry ? (
                <IconEntry.Icon className="h-6 w-6 text-white" />
              ) : (
                <span className="text-lg font-semibold text-white">{config.businessName?.[0] ?? "S"}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{config.businessName}</p>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Online
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 h-[440px] overflow-hidden rounded-2xl border border-white/10 bg-black/10 shadow-inner">
          <ChatbotConversationWindow config={config} interactive={interactive} autoPlayDemo={autoPlayDemo} />
        </div>
      </motion.div>
    </div>
  );
}
