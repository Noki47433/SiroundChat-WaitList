import type { SiteDocument } from "@/lib/website-builder/types";
import type { EditorAction, EditorHistory, EditorState } from "@/lib/website-builder/editor/types";

const buildHistory = (document: SiteDocument | null): EditorHistory => ({
  past: [],
  present: document,
  future: []
});

export const createInitialState = (siteId: string, document: SiteDocument | null): EditorState => ({
  siteId,
  document,
  history: buildHistory(document),
  selectedNode: null,
  activePageId: document?.pages?.[0]?.id ?? null,
  leftTool: "add",
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  viewport: "desktop",
  zoom: 1,
  showGuides: false,
  showGrid: false
});

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case "hydrate": {
      const nextDoc = action.document;
      return {
        ...state,
        document: nextDoc,
        history: buildHistory(nextDoc),
        activePageId: nextDoc.pages?.[0]?.id ?? null,
        selectedNode: null
      };
    }
    case "commit": {
      const previous = state.history.present;
      return {
        ...state,
        document: action.document,
        history: {
          past: previous ? [...state.history.past, previous] : state.history.past,
          present: action.document,
          future: []
        }
      };
    }
    case "undo": {
      if (!state.history.past.length) return state;
      const previous = state.history.past[state.history.past.length - 1];
      const past = state.history.past.slice(0, -1);
      return {
        ...state,
        document: previous,
        history: {
          past,
          present: previous,
          future: state.history.present ? [state.history.present, ...state.history.future] : state.history.future
        }
      };
    }
    case "redo": {
      if (!state.history.future.length) return state;
      const next = state.history.future[0];
      const future = state.history.future.slice(1);
      return {
        ...state,
        document: next,
        history: {
          past: state.history.present ? [...state.history.past, state.history.present] : state.history.past,
          present: next,
          future
        }
      };
    }
    case "select":
      return { ...state, selectedNode: action.node };
    case "set-active-page":
      return { ...state, activePageId: action.pageId };
    case "set-left-tool":
      return { ...state, leftTool: action.tool };
    case "set-left-panel-open":
      return { ...state, isLeftPanelOpen: action.open };
    case "set-right-panel-open":
      return { ...state, isRightPanelOpen: action.open };
    case "set-viewport":
      return { ...state, viewport: action.viewport };
    case "set-zoom":
      return { ...state, zoom: action.zoom };
    case "set-guides":
      return { ...state, showGuides: action.value };
    case "set-grid":
      return { ...state, showGrid: action.value };
    default:
      return state;
  }
};
