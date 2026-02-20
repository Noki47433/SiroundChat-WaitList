"use client";

import { ICON_LIBRARY } from "@/app/components/chatbot/ChatbotIconLibrary"; // Reuse the builder icon set for embed parity

interface WidgetLauncherProps {
  onClick: () => void;
  open: boolean;
  primaryColor: string;
  accentColor?: string;
  shape?: "rounded" | "pill" | "square";
  variant?: "icon" | "iconWithLabel";
  logoUrl?: string;
  iconId?: string;
  fallbackInitial?: string;
}

export function WidgetLauncher({
  onClick,
  open,
  primaryColor,
  accentColor,
  logoUrl,
  iconId,
  fallbackInitial
}: WidgetLauncherProps) {
  const radiusClass = "rounded-full"; // Force a circular launcher so it matches the icon-only design
  const gradient = `linear-gradient(135deg, ${primaryColor}, ${accentColor ?? primaryColor})`; // Match builder gradient for launcher background
  const isIconOnly = true; // Always show icon-only (no pill label) in the embedded widget
  const iconEntry = iconId ? ICON_LIBRARY.find((entry) => entry.id === iconId) : undefined; // Resolve icon from saved id

  // Decide what appears inside the launcher: logo image, icon, or fallback initial.
  const renderMark = () => {
    if (logoUrl) {
      return (
  <div className="flex h-full w-full items-center justify-center p-0">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={logoUrl}
      alt="logo"
      className="h-full w-full rounded-full object-contain"
      draggable={false}
    />
  </div>
);
 // Logo sized to match builder
    }
    if (iconEntry) {
      const Icon = iconEntry.Icon; // Icon component for the selected library entry
      return <Icon className={`${isIconOnly ? "h-5 w-5" : "h-4 w-4"} text-white`} />; // Render selected icon
    }
    return <span className="text-[10px] font-bold">{fallbackInitial ?? "P"}</span>; // Fallback initial when no logo/icon
  };

  return (
    <button
      data-widget-launcher="true"
      className={`absolute bottom-0 right-0 z-50 inline-flex h-14 w-14 items-center justify-center overflow-hidden text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition ${radiusClass}`} // Fixed size circle for the launcher icon
      style={{ backgroundImage: gradient }} // Apply brand gradient to the launcher
      onClick={onClick}
    >
      {open ? ( // Swap icon to a close "X" when the chat is open
        <span className="text-xl font-semibold text-white">×</span> // Close icon inside the launcher
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full"> {/* Inner bubble matches builder */}
          {renderMark()}
        </span>
      )}
    </button>
  );
}
