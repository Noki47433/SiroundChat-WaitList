"use client";

import {
  FileText,
  Image,
  LayoutGrid,
  Palette,
  Plus,
  Settings,
  Shapes,
  Sparkles
} from "lucide-react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import type { LeftTool } from "@/lib/website-builder/editor/types";

const TOOL_BUTTONS: Array<{ id: LeftTool; label: string; icon: typeof Plus; tone: string }> = [
  { id: "elements", label: "Add Elements", icon: Shapes, tone: "bg-[#e9f0ff] text-[#3557f6]" },
  { id: "add", label: "Add Section", icon: Plus, tone: "bg-[#f5ebff] text-[#7c3aed]" },
  { id: "pages", label: "Pages & Menu", icon: FileText, tone: "bg-[#e7f7f0] text-[#0f766e]" },
  { id: "structure", label: "Structure", icon: LayoutGrid, tone: "bg-[#fdf4e7] text-[#b45309]" },
  { id: "theme", label: "Site Design", icon: Palette, tone: "bg-[#eaf3ff] text-[#2563eb]" },
  { id: "ai", label: "AI Tools", icon: Sparkles, tone: "bg-[#fff7e6] text-[#d97706]" },
  { id: "media", label: "Media", icon: Image, tone: "bg-[#f0f4ff] text-[#4338ca]" },
  { id: "settings", label: "My Business", icon: Settings, tone: "bg-[#f2f2f2] text-[#525252]" }
];

export function LeftRail() {
  const state = useEditorState();
  const { setLeftTool, setLeftPanelOpen } = useEditorActions();

  return (
    <aside className="relative flex w-[92px] shrink-0 flex-col items-center gap-3 border-r border-sc-border bg-[#faf7f2] px-3 py-5 overflow-visible">
      {TOOL_BUTTONS.map((tool) => {
        const Icon = tool.icon;
        const isActive = state.leftTool === tool.id && state.isLeftPanelOpen;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              if (state.leftTool === tool.id) {
                setLeftPanelOpen(!state.isLeftPanelOpen);
                return;
              }
              setLeftTool(tool.id);
              setLeftPanelOpen(true);
            }}
            className="group relative flex items-center justify-center"
            aria-label={tool.label}
            title={tool.label}
          >
            <span
              className={`relative flex h-12 w-12 items-center justify-center rounded-[18px] border transition duration-200 ${
                isActive
                  ? "border-[#d9ceb8] bg-white shadow-[0_12px_30px_rgba(54,39,16,0.08)]"
                  : "border-transparent bg-white/72 hover:border-[#e8dfcf] hover:bg-white"
              } ${tool.tone}`}
            >
              <Icon className="h-5 w-5" />
              {isActive ? <span className="absolute -right-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-sc-yellow" /> : null}
            </span>
            <span
              className={`pointer-events-none absolute left-14 whitespace-nowrap rounded-xl border border-[#e5e1d8] bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 shadow-sm transition ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            >
              {tool.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
