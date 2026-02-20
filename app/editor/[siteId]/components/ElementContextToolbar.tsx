"use client";

import { Copy, Pencil, Settings, Trash2 } from "lucide-react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage, selectSelectedSection, selectSelectedElement } from "@/lib/website-builder/editor/selectors";
import type { SiteElement, SiteSection } from "@/lib/website-builder/types";

type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  type: "section" | "element" | "content";
  sectionId?: string;
  elementId?: string;
  contentKey?: string;
};

type ElementContextToolbarProps = {
  selectionRect?: SelectionRect | null;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function ElementContextToolbar({ selectionRect }: ElementContextToolbarProps) {
  const state = useEditorState();
  const { updateDocument, setRightPanelOpen } = useEditorActions();
  const activePage = selectActivePage(state);
  const selectedSection = selectSelectedSection(state);
  const selectedElement = selectSelectedElement(state);

  if (!selectionRect || !activePage) return null;

  const handleDuplicateSection = () => {
    if (!selectedSection) return;
    const clone: SiteSection = {
      ...selectedSection,
      id: createId(),
      content: JSON.parse(JSON.stringify(selectedSection.content ?? {})),
      images: selectedSection.images ? JSON.parse(JSON.stringify(selectedSection.images)) : undefined,
      elements: selectedSection.elements ? JSON.parse(JSON.stringify(selectedSection.elements)) : undefined
    };
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const sections = [...page.sections];
        const index = sections.findIndex((section) => section.id === selectedSection.id);
        if (index === -1) return page;
        sections.splice(index + 1, 0, clone);
        return { ...page, sections };
      })
    }));
  };

  const handleDeleteSection = () => {
    if (!selectedSection) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        return { ...page, sections: page.sections.filter((section) => section.id !== selectedSection.id) };
      })
    }));
  };

  const handleDuplicateElement = () => {
    if (!selectedSection || !selectedElement) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        return {
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== selectedSection.id) return section;
            const elements = section.elements ? [...section.elements] : [];
            const index = elements.findIndex((element) => element.id === selectedElement.id);
            if (index === -1) return section;
            const clone = { ...(JSON.parse(JSON.stringify(selectedElement)) as SiteElement), id: createId() };
            if ((clone as any).frame) {
              (clone as any).frame = {
                ...(clone as any).frame,
                x: (clone as any).frame.x + 24,
                y: (clone as any).frame.y + 24
              };
            }
            elements.splice(index + 1, 0, clone);
            return { ...section, elements };
          })
        };
      })
    }));
  };

  const handleDeleteElement = () => {
    if (!selectedSection || !selectedElement) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        return {
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== selectedSection.id) return section;
            return {
              ...section,
              elements: (section.elements ?? []).filter((element) => element.id !== selectedElement.id)
            };
          })
        };
      })
    }));
  };

  const toolbarTop = Math.max(8, selectionRect.top - 38);
  const toolbarLeft = selectionRect.left;

  return (
    <div
      className="pointer-events-auto absolute z-20 flex items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-2 py-1 shadow-sm"
      style={{ top: toolbarTop, left: toolbarLeft }}
    >
      <button
        type="button"
        onClick={() => setRightPanelOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => setRightPanelOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </button>
      {selectionRect.type === "section" ? (
        <>
          <button
            type="button"
            onClick={handleDuplicateSection}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDeleteSection}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-danger hover:bg-sc-surface-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </>
      ) : selectionRect.type === "element" ? (
        <>
          <button
            type="button"
            onClick={handleDuplicateElement}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDeleteElement}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sc-danger hover:bg-sc-surface-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </>
      ) : null}
    </div>
  );
}
