"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage } from "@/lib/website-builder/editor/selectors";
import { renderSection } from "@/lib/website-builder/sections/registry";
import { themeToCssVars } from "@/lib/website-builder/theme/vars";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";

type CanvasStageProps = {
  onSelectionRect?: (rect: {
    left: number;
    top: number;
    width: number;
    height: number;
    type: "section" | "element" | "content";
    sectionId?: string;
    elementId?: string;
    contentKey?: string;
  } | null) => void;
};

type RawRect = { x: number; y: number; width: number; height: number };

type RenderContext = {
  theme: SiteDocument["theme"];
  site: SiteDocument;
  editor?: {
    onElementReorder?: (sectionId: string, sourceId: string, targetId: string) => void;
    onElementFrameChange?: (
      sectionId: string,
      elementId: string,
      frame: { x: number; y: number; width: number; height: number }
    ) => void;
  };
};

export function CanvasStage({ onSelectionRect }: CanvasStageProps) {
  const state = useEditorState();
  const { setSelectedNode, setRightPanelOpen, updateDocument } = useEditorActions();
  const activePage = selectActivePage(state);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const rawSelectionRef = useRef<{
    rect: RawRect;
    type: "section" | "element" | "content";
    sectionId?: string;
    elementId?: string;
    contentKey?: string;
  } | null>(null);

  const baseWidth = state.viewport === "desktop" ? 1200 : 375;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateScale = () => {
      const containerWidth = node.clientWidth;
      const nextScale = Math.min(1, containerWidth / baseWidth) * state.zoom;
      setPreviewScale(nextScale);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [baseWidth, state.zoom]);

  const computeRectRelativeToContainer = (nodeRect: DOMRect, containerRect: DOMRect) => ({
    left: nodeRect.left - containerRect.left + containerRef.current!.scrollLeft,
    top: nodeRect.top - containerRect.top + containerRef.current!.scrollTop,
    width: nodeRect.width,
    height: nodeRect.height
  });

  const translateSelection = useCallback(() => {
    if (!rawSelectionRef.current || !containerRef.current) {
      onSelectionRect?.(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const { rect, type, sectionId, elementId, contentKey } = rawSelectionRef.current;
    const computed = computeRectRelativeToContainer(
      new DOMRect(rect.x, rect.y, rect.width, rect.height),
      containerRect
    );
    onSelectionRect?.({
      left: computed.left,
      top: computed.top,
      width: computed.width,
      height: computed.height,
      type,
      sectionId,
      elementId,
      contentKey
    });
  }, [onSelectionRect]);

  useEffect(() => {
    translateSelection();
  }, [previewScale, translateSelection]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handleScroll = () => translateSelection();
    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [previewScale, translateSelection]);

  useEffect(() => {
    if (!state.selectedNode) {
      rawSelectionRef.current = null;
      onSelectionRect?.(null);
      return;
    }
    if (
      rawSelectionRef.current &&
      state.selectedNode.type === "section" &&
      rawSelectionRef.current.sectionId !== state.selectedNode.id
    ) {
      rawSelectionRef.current = null;
      onSelectionRect?.(null);
    }
    if (
      rawSelectionRef.current &&
      state.selectedNode.type === "element" &&
      rawSelectionRef.current.elementId !== state.selectedNode.id
    ) {
      rawSelectionRef.current = null;
      onSelectionRect?.(null);
    }
    if (
      rawSelectionRef.current &&
      state.selectedNode.type === "content" &&
      rawSelectionRef.current.contentKey !== state.selectedNode.key
    ) {
      rawSelectionRef.current = null;
      onSelectionRect?.(null);
    }
  }, [state.selectedNode, onSelectionRect]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  const sections = activePage?.sections ?? [];

  const handleDragEnd = (event: DragEndEvent) => {
    if (!activePage || !event.over) return;
    const sourceId = String(event.active.id);
    const targetId = String(event.over.id);
    if (sourceId === targetId) return;
    updateDocument((doc) => {
      return {
        ...doc,
        pages: doc.pages.map((page) => {
          if (page.id !== activePage.id) return page;
          const list = [...page.sections];
          const sourceIndex = list.findIndex((section) => section.id === sourceId);
          const targetIndex = list.findIndex((section) => section.id === targetId);
          if (sourceIndex === -1 || targetIndex === -1) return page;
          return { ...page, sections: arrayMove(list, sourceIndex, targetIndex) };
        })
      };
    });
  };

  const handlePointerDownCapture = (event: ReactMouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("[data-drag-handle]")) {
      return;
    }
    const elementNode = target.closest("[data-element-id]") as HTMLElement | null;
    const contentNode = target.closest("[data-content-key]") as HTMLElement | null;
    const sectionNode = target.closest("[data-section-id]") as HTMLElement | null;
    const linkNode = target.closest("a") as HTMLAnchorElement | null;
    if (linkNode && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
    }
    if (elementNode) {
      const elementId = elementNode.getAttribute("data-element-id");
      const sectionId = elementNode.closest("[data-section-id]")?.getAttribute("data-section-id");
      if (elementId && sectionId) {
        setSelectedNode({ type: "element", id: elementId, parentId: sectionId });
        setRightPanelOpen(true);
        const rect = elementNode.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "element",
          sectionId,
          elementId
        };
        translateSelection();
        return;
      }
    }
    if (contentNode) {
      const contentKey = contentNode.getAttribute("data-content-key");
      const sectionId =
        contentNode.getAttribute("data-section-id") ??
        contentNode.closest("[data-section-id]")?.getAttribute("data-section-id");
      if (contentKey && sectionId) {
        setSelectedNode({
          type: "content",
          id: `${sectionId}:${contentKey}`,
          parentId: sectionId,
          key: contentKey
        });
        setRightPanelOpen(true);
        const rect = contentNode.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "content",
          sectionId,
          contentKey
        };
        translateSelection();
        return;
      }
    }
    if (sectionNode) {
      const sectionId = sectionNode.getAttribute("data-section-id");
      if (sectionId) {
        setSelectedNode({ type: "section", id: sectionId, parentId: activePage?.id });
        setRightPanelOpen(true);
        const rect = sectionNode.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "section",
          sectionId
        };
        translateSelection();
      }
    }
  };

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll("[data-section-selected]").forEach((node) => {
      node.removeAttribute("data-section-selected");
    });
    root.querySelectorAll("[data-element-selected]").forEach((node) => {
      node.removeAttribute("data-element-selected");
    });
    root.querySelectorAll("[data-content-selected]").forEach((node) => {
      node.removeAttribute("data-content-selected");
    });
    if (!state.selectedNode) return;
    if (state.selectedNode.type === "section") {
      const node = root.querySelector(`[data-section-id="${state.selectedNode.id}"]`) as HTMLElement | null;
      if (node) {
        node.setAttribute("data-section-selected", "true");
        const rect = node.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "section",
          sectionId: state.selectedNode.id
        };
        translateSelection();
        if (!root.dataset.lastScrollTo || root.dataset.lastScrollTo !== state.selectedNode.id) {
          node.scrollIntoView({ block: "center" });
          root.dataset.lastScrollTo = state.selectedNode.id;
        }
      }
    }
    if (state.selectedNode.type === "element") {
      const node = root.querySelector(`[data-element-id="${state.selectedNode.id}"]`) as HTMLElement | null;
      if (node) {
        node.setAttribute("data-element-selected", "true");
        const rect = node.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "element",
          elementId: state.selectedNode.id,
          sectionId: state.selectedNode.parentId ?? undefined
        };
        translateSelection();
        if (!root.dataset.lastScrollTo || root.dataset.lastScrollTo !== state.selectedNode.id) {
          node.scrollIntoView({ block: "center" });
          root.dataset.lastScrollTo = state.selectedNode.id;
        }
      }
    }
    if (state.selectedNode.type === "content") {
      const node = root.querySelector(`[data-content-key="${state.selectedNode.key}"][data-section-id="${state.selectedNode.parentId}"]`) as HTMLElement | null;
      if (node) {
        node.setAttribute("data-content-selected", "true");
        const rect = node.getBoundingClientRect();
        rawSelectionRef.current = {
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          type: "content",
          contentKey: state.selectedNode.key,
          sectionId: state.selectedNode.parentId ?? undefined
        };
        translateSelection();
        if (!root.dataset.lastScrollTo || root.dataset.lastScrollTo !== state.selectedNode.id) {
          node.scrollIntoView({ block: "center" });
          root.dataset.lastScrollTo = state.selectedNode.id;
        }
      }
    }
  }, [state.selectedNode, state.document, translateSelection]);

  const handleElementReorder = useCallback(
    (sectionId: string, sourceId: string, targetId: string) => {
      updateDocument((doc) => ({
        ...doc,
        pages: doc.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== sectionId) return section;
            const elements = section.elements ? [...section.elements] : [];
            const sourceIndex = elements.findIndex((element) => element.id === sourceId);
            const targetIndex = elements.findIndex((element) => element.id === targetId);
            if (sourceIndex === -1 || targetIndex === -1) return section;
            return { ...section, elements: arrayMove(elements, sourceIndex, targetIndex) };
          })
        }))
      }));
    },
    [updateDocument]
  );

  const handleElementFrameChange = useCallback(
    (sectionId: string, elementId: string, frame: { x: number; y: number; width: number; height: number }) => {
      updateDocument((doc) => ({
        ...doc,
        pages: doc.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== sectionId) return section;
            return {
              ...section,
              elements: (section.elements ?? []).map((element) =>
                element.id === elementId ? { ...element, frame } : element
              )
            };
          })
        }))
      }));
    },
    [updateDocument]
  );

  const renderContext: RenderContext | null = state.document
    ? {
        theme: state.document.theme,
        site: state.document,
        editor: {
          onElementReorder: handleElementReorder,
          onElementFrameChange: handleElementFrameChange
        }
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="sc-editor h-full w-full min-w-0 overflow-y-auto overflow-x-hidden bg-[#f7f5f1] p-4 wix-grid"
      onMouseDownCapture={handlePointerDownCapture}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
        <div
          className="relative mx-auto w-full max-w-full origin-top rounded-2xl border border-[#e5e1d8] bg-white shadow-lg"
          style={{
            width: "100%",
            maxWidth: baseWidth,
            transform: `scale(${previewScale})`
          }}
        >
          {state.showGrid ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(107,107,107,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(107,107,107,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }}
            />
          ) : null}
          {state.showGuides ? (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-sc-yellow" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-sc-border" />
              <div className="pointer-events-none absolute inset-y-0 left-[10%] w-px border-l border-dashed border-sc-border" />
              <div className="pointer-events-none absolute inset-y-0 right-[10%] w-px border-l border-dashed border-sc-border" />
            </>
          ) : null}
          <div className="relative" style={themeToCssVars(state.document?.theme ?? ({} as any))}>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {sections.map((section) => (
                    <SortableSection key={section.id} section={section} renderContext={renderContext} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableSection({
  section,
  renderContext
}: {
  section: SiteSection;
  renderContext: RenderContext | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-70" : ""}>
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Section</span>
        <button
          type="button"
          className="rounded-full border border-[#e5e1d8] bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500"
          data-drag-handle
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
      </div>
      {renderContext ? renderSection(section, renderContext) : null}
    </div>
  );
}
