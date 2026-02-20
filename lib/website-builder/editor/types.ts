import type { SiteDocument } from "@/lib/website-builder/types";

export type SelectedNode =
  | { type: "page"; id: string }
  | { type: "section"; id: string; parentId?: string | null }
  | { type: "element"; id: string; parentId?: string | null }
  | { type: "content"; id: string; parentId?: string | null; key: string };

export type LeftTool = "add" | "structure" | "elements" | "pages" | "media" | "theme" | "ai" | "settings";

export type EditorHistory = {
  past: SiteDocument[];
  present: SiteDocument | null;
  future: SiteDocument[];
};

export type EditorState = {
  siteId: string;
  document: SiteDocument | null;
  history: EditorHistory;
  selectedNode: SelectedNode | null;
  activePageId: string | null;
  leftTool: LeftTool;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  viewport: "desktop" | "mobile";
  zoom: number;
  showGuides: boolean;
  showGrid: boolean;
};

export type EditorAction =
  | { type: "hydrate"; document: SiteDocument }
  | { type: "commit"; document: SiteDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; node: SelectedNode | null }
  | { type: "set-active-page"; pageId: string | null }
  | { type: "set-left-tool"; tool: LeftTool }
  | { type: "set-left-panel-open"; open: boolean }
  | { type: "set-right-panel-open"; open: boolean }
  | { type: "set-viewport"; viewport: "desktop" | "mobile" }
  | { type: "set-zoom"; zoom: number }
  | { type: "set-guides"; value: boolean }
  | { type: "set-grid"; value: boolean };
