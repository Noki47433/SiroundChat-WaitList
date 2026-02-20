import type { EditorAction, LeftTool, SelectedNode } from "@/lib/website-builder/editor/types";
import type { SiteDocument } from "@/lib/website-builder/types";

export const editorActions = {
  hydrate: (document: SiteDocument): EditorAction => ({ type: "hydrate", document }),
  commit: (document: SiteDocument): EditorAction => ({ type: "commit", document }),
  undo: (): EditorAction => ({ type: "undo" }),
  redo: (): EditorAction => ({ type: "redo" }),
  select: (node: SelectedNode | null): EditorAction => ({ type: "select", node }),
  setActivePage: (pageId: string | null): EditorAction => ({ type: "set-active-page", pageId }),
  setLeftTool: (tool: LeftTool): EditorAction => ({ type: "set-left-tool", tool }),
  setLeftPanelOpen: (open: boolean): EditorAction => ({ type: "set-left-panel-open", open }),
  setRightPanelOpen: (open: boolean): EditorAction => ({ type: "set-right-panel-open", open }),
  setViewport: (viewport: "desktop" | "mobile"): EditorAction => ({ type: "set-viewport", viewport }),
  setZoom: (zoom: number): EditorAction => ({ type: "set-zoom", zoom }),
  setGuides: (value: boolean): EditorAction => ({ type: "set-guides", value }),
  setGrid: (value: boolean): EditorAction => ({ type: "set-grid", value })
};
