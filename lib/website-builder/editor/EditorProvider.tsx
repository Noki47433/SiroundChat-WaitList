"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import type { SiteDocument } from "@/lib/website-builder/types";
import { editorActions } from "@/lib/website-builder/editor/actions";
import { createInitialState, editorReducer } from "@/lib/website-builder/editor/state";
import type { EditorState, LeftTool, SelectedNode } from "@/lib/website-builder/editor/types";

type EditorActions = {
  setSelectedNode: (node: SelectedNode | null) => void;
  setActivePage: (pageId: string | null) => void;
  setLeftTool: (tool: LeftTool) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setViewport: (viewport: "desktop" | "mobile") => void;
  setZoom: (zoom: number) => void;
  setGuides: (value: boolean) => void;
  setGrid: (value: boolean) => void;
  commitDocument: (doc: SiteDocument) => void;
  updateDocument: (updater: (doc: SiteDocument) => SiteDocument) => void;
  undo: () => void;
  redo: () => void;
};

const EditorStateContext = createContext<EditorState | null>(null);
const EditorActionsContext = createContext<EditorActions | null>(null);

type EditorProviderProps = {
  siteId: string;
  initialDocument: SiteDocument;
  children: ReactNode;
};

export function EditorProvider({ siteId, initialDocument, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, createInitialState(siteId, initialDocument));
  const lastSelectedPageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.document?.pages?.length) return;
    if (!state.activePageId || !state.document.pages.some((page) => page.id === state.activePageId)) {
      dispatch(editorActions.setActivePage(state.document.pages[0]?.id ?? null));
    }
  }, [state.activePageId, state.document]);

  useEffect(() => {
    if (!state.document || state.selectedNode) return;
    const pages = state.document.pages ?? [];
    const activePage =
      pages.find((page) => page.id === state.activePageId) ?? pages[0];
    const sections = activePage?.sections ?? [];
    if (!sections.length) return;
    const hero = sections.find((section) => section.type === "hero") ?? sections[0];
    dispatch(editorActions.select({ type: "section", id: hero.id, parentId: activePage?.id }));
  }, [state.document, state.selectedNode, state.activePageId]);

  useEffect(() => {
    if (!state.document) return;
    const pages = state.document.pages ?? [];
    const activePage =
      pages.find((page) => page.id === state.activePageId) ?? pages[0];
    if (!activePage?.id) return;
    if (lastSelectedPageRef.current === activePage.id) return;
    const sections = activePage.sections ?? [];
    if (!sections.length) return;
    const hero = sections.find((section) => section.type === "hero") ?? sections[0];
    dispatch(editorActions.select({ type: "section", id: hero.id, parentId: activePage.id }));
    lastSelectedPageRef.current = activePage.id;
  }, [state.activePageId, state.document]);

  const actions = useMemo<EditorActions>(
    () => ({
      setSelectedNode: (node) => dispatch(editorActions.select(node)),
      setActivePage: (pageId) => dispatch(editorActions.setActivePage(pageId)),
      setLeftTool: (tool) => dispatch(editorActions.setLeftTool(tool)),
      setLeftPanelOpen: (open) => dispatch(editorActions.setLeftPanelOpen(open)),
      setRightPanelOpen: (open) => dispatch(editorActions.setRightPanelOpen(open)),
      setViewport: (viewport) => dispatch(editorActions.setViewport(viewport)),
      setZoom: (zoom) => dispatch(editorActions.setZoom(zoom)),
      setGuides: (value) => dispatch(editorActions.setGuides(value)),
      setGrid: (value) => dispatch(editorActions.setGrid(value)),
      commitDocument: (doc) => dispatch(editorActions.commit(doc)),
      updateDocument: (updater) => {
        if (!state.document) return;
        dispatch(editorActions.commit(updater(state.document)));
      },
      undo: () => dispatch(editorActions.undo()),
      redo: () => dispatch(editorActions.redo())
    }),
    [state.document]
  );

  return (
    <EditorStateContext.Provider value={state}>
      <EditorActionsContext.Provider value={actions}>{children}</EditorActionsContext.Provider>
    </EditorStateContext.Provider>
  );
}

export const useEditorState = () => {
  const ctx = useContext(EditorStateContext);
  if (!ctx) {
    throw new Error("useEditorState must be used within EditorProvider");
  }
  return ctx;
};

export const useEditorActions = () => {
  const ctx = useContext(EditorActionsContext);
  if (!ctx) {
    throw new Error("useEditorActions must be used within EditorProvider");
  }
  return ctx;
};
