"use client";

import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type PreviewDevice = "desktop" | "mobile";

type DeviceSwitchProps = {
  value: PreviewDevice;
  onChange: (value: PreviewDevice) => void;
};

export function DeviceSwitch({ value, onChange }: DeviceSwitchProps) {
  return (
    <div
      className="relative inline-flex h-11 items-center rounded-full border border-white/10 bg-[#17171b] p-1"
      role="tablist"
      aria-label="Preview device"
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-1 h-9 w-[52px] rounded-full bg-[#ffd34d] shadow-[0_12px_30px_rgba(255,211,77,0.28)] transition-transform duration-300 ease-out",
          value === "desktop" ? "translate-x-0" : "translate-x-[52px]"
        )}
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "desktop"}
        aria-label="Desktop preview"
        onClick={() => onChange("desktop")}
        className={cn(
          "relative z-10 inline-flex h-9 w-[52px] items-center justify-center rounded-full transition-colors",
          value === "desktop" ? "text-[#111113]" : "text-white/65 hover:text-white"
        )}
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "mobile"}
        aria-label="iPhone preview"
        onClick={() => onChange("mobile")}
        className={cn(
          "relative z-10 inline-flex h-9 w-[52px] items-center justify-center rounded-full transition-colors",
          value === "mobile" ? "text-[#111113]" : "text-white/65 hover:text-white"
        )}
      >
        <Smartphone className="h-4 w-4" />
      </button>
    </div>
  );
}
