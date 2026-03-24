"use client";

import { X } from "lucide-react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { AddSectionPanel } from "@/app/editor/[siteId]/components/panels/AddSectionPanel";
import { StructurePanel } from "@/app/editor/[siteId]/components/panels/StructurePanel";
import { ElementsPanel } from "@/app/editor/[siteId]/components/panels/ElementsPanel";
import { MediaPanel } from "@/app/editor/[siteId]/components/panels/MediaPanel";
import { AiToolsPanel } from "@/app/editor/[siteId]/components/panels/AiToolsPanel";
import { PagesPanel } from "@/app/editor/[siteId]/components/panels/PagesPanel";
import { ThemePanel } from "@/app/editor/[siteId]/components/panels/ThemePanel";
import { SettingsPanel } from "@/app/editor/[siteId]/components/panels/SettingsPanel";

export function LeftPanel() {
  const state = useEditorState();
  const { setLeftPanelOpen } = useEditorActions();

  const titleMap = {
    add: "Add Section",
    structure: "Structure",
    elements: "Add Elements",
    pages: "Pages & Menu",
    media: "Media",
    theme: "Site Design",
    ai: "AI Tools",
    settings: "My Business"
  } as const;

  return (
    <aside
      className={`builder-panel flex h-full min-w-0 flex-col overflow-hidden rounded-r-[28px] border-r border-[#e8dfcf] bg-[rgba(255,251,244,0.98)] shadow-[0_24px_80px_rgba(55,43,20,0.08)] backdrop-blur transition-all duration-200 ${
        state.isLeftPanelOpen
          ? "w-[360px] translate-x-0 opacity-100 pointer-events-auto"
          : "w-0 -translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#efeae0] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,248,238,0.75))] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{titleMap[state.leftTool]}</p>
          <p className="text-xs text-neutral-500">Manage your site content.</p>
        </div>
        <button
          type="button"
          onClick={() => setLeftPanelOpen(false)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e1d8] bg-white text-neutral-500 shadow-sm hover:bg-[#f5f2ec]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {state.leftTool === "add" ? <AddSectionPanel /> : null}
        {state.leftTool === "structure" ? <StructurePanel /> : null}
        {state.leftTool === "elements" ? <ElementsPanel /> : null}
        {state.leftTool === "media" ? <MediaPanel /> : null}
        {state.leftTool === "ai" ? <AiToolsPanel /> : null}
        {state.leftTool === "pages" ? <PagesPanel /> : null}
        {state.leftTool === "theme" ? <ThemePanel /> : null}
        {state.leftTool === "settings" ? <SettingsPanel /> : null}
      </div>
    </aside>
  );
}
