"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Copy,
  GripVertical,
  PencilLine,
  Power,
  Trash2
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage } from "@/lib/website-builder/editor/selectors";
import type { SiteElement, SiteSection } from "@/lib/website-builder/types";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const SECTION_LABELS: Record<SiteSection["type"], string> = {
  hero: "Hero",
  services: "Services",
  about: "About",
  gallery: "Gallery",
  testimonials: "Testimonials",
  pricing: "Pricing",
  cta: "Call to Action",
  faq: "FAQ",
  contact: "Contact",
  reservation: "Reservation",
  footer: "Footer",
  newsletter: "Newsletter",
  "blog-index": "Blog Index",
  "blog-post": "Blog Post",
  "store-listing": "Store Listing",
  "store-product": "Store Product",
  "store-cart": "Store Cart",
  custom: "Custom",
  "app-embed": "App Embed"
};

const ELEMENT_LABELS: Record<SiteElement["type"], string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  spacer: "Spacer",
  divider: "Divider"
};

const SortableRow = ({
  id,
  children,
  onClick,
  trailing,
  muted,
  className
}: {
  id: string;
  children: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  muted?: boolean;
  className?: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border border-sc-border bg-sc-surface px-2 py-2 transition ${
        isDragging ? "opacity-60" : ""
      } ${muted ? "opacity-70" : ""} ${className ?? ""}`}
    >
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sc-muted hover:text-sc-text"
        {...attributes}
        {...listeners}
        aria-label="Drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex-1 text-left text-sm font-semibold text-sc-text"
        >
          {children}
        </button>
      ) : (
        <div className="flex-1 text-sm font-semibold text-sc-text">{children}</div>
      )}
      {trailing}
    </div>
  );
};

export function StructurePanel() {
  const state = useEditorState();
  const { updateDocument, setSelectedNode } = useEditorActions();
  const activePage = selectActivePage(state);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState("");

  const sections = activePage?.sections ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  const updateSection = (sectionId: string, updater: (section: SiteSection) => SiteSection) => {
    if (!activePage) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        return {
          ...page,
          sections: page.sections.map((section) => (section.id === sectionId ? updater(section) : section))
        };
      })
    }));
  };

  const updateSectionName = (sectionId: string, name: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      name: name.trim() || undefined
    }));
  };

  const toggleSection = (sectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      enabled: !section.enabled
    }));
  };

  const duplicateSection = (sectionId: string) => {
    if (!activePage) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const list = [...page.sections];
        const index = list.findIndex((section) => section.id === sectionId);
        if (index === -1) return page;
        const original = list[index];
        const clone: SiteSection = {
          ...original,
          id: createId(),
          content: JSON.parse(JSON.stringify(original.content ?? {})),
          images: original.images ? JSON.parse(JSON.stringify(original.images)) : undefined,
          elements: original.elements ? JSON.parse(JSON.stringify(original.elements)) : undefined
        };
        list.splice(index + 1, 0, clone);
        return { ...page, sections: list };
      })
    }));
  };

  const deleteSection = (sectionId: string) => {
    if (!activePage) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        return { ...page, sections: page.sections.filter((section) => section.id !== sectionId) };
      })
    }));
  };

  const reorderSections = (sourceId: string, targetId: string) => {
    if (!activePage || sourceId === targetId) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const list = [...page.sections];
        const sourceIndex = list.findIndex((section) => section.id === sourceId);
        const targetIndex = list.findIndex((section) => section.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return page;
        return { ...page, sections: arrayMove(list, sourceIndex, targetIndex) };
      })
    }));
  };

  const reorderElements = (sectionId: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    updateSection(sectionId, (section) => {
      const elements = section.elements ? [...section.elements] : [];
      const sourceIndex = elements.findIndex((element) => element.id === sourceId);
      const targetIndex = elements.findIndex((element) => element.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return section;
      return { ...section, elements: arrayMove(elements, sourceIndex, targetIndex) };
    });
  };

  const flattenedSelection = useMemo(() => state.selectedNode, [state.selectedNode]);

  if (!activePage) {
    return <p className="text-sm text-sc-muted">Select a page to manage its structure.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Structure</p>
        <p className="mt-1 text-xs text-sc-muted">Reorder sections and elements.</p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          if (!event.over) return;
          reorderSections(String(event.active.id), String(event.over.id));
        }}
      >
        <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section) => {
              const isSelected = flattenedSelection?.type === "section" && flattenedSelection.id === section.id;
              const isEditing = editingSectionId === section.id;
              return (
                <div key={section.id} className="space-y-2">
                  <SortableRow
                    id={section.id}
                    muted={!section.enabled}
                    className={isSelected ? "ring-1 ring-sc-yellow/60" : ""}
                    onClick={
                      isEditing
                        ? undefined
                        : () => setSelectedNode({ type: "section", id: section.id, parentId: activePage.id })
                    }
                    trailing={
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectionId(section.id);
                            setSectionNameDraft(section.name ?? SECTION_LABELS[section.type]);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-sc-muted hover:text-sc-text"
                          aria-label="Rename section"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border border-sc-border ${
                            section.enabled ? "text-sc-text" : "text-sc-muted"
                          }`}
                          aria-label="Toggle section"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateSection(section.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-sc-muted hover:text-sc-text"
                          aria-label="Duplicate section"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSection(section.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-sc-danger"
                          aria-label="Delete section"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    }
                  >
                    {isEditing ? (
                      <input
                        className="h-8 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-xs text-sc-text"
                        value={sectionNameDraft}
                        onChange={(event) => setSectionNameDraft(event.target.value)}
                        onBlur={() => {
                          updateSectionName(section.id, sectionNameDraft);
                          setEditingSectionId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            updateSectionName(section.id, sectionNameDraft);
                            setEditingSectionId(null);
                          }
                          if (event.key === "Escape") {
                            setEditingSectionId(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className={isSelected ? "text-sc-text" : "text-sc-text"}>
                        {section.name ?? SECTION_LABELS[section.type]}
                      </span>
                    )}
                  </SortableRow>

                  {section.elements?.length ? (
                    <div className="space-y-2 pl-8">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          if (!event.over) return;
                          reorderElements(section.id, String(event.active.id), String(event.over.id));
                        }}
                      >
                        <SortableContext
                          items={section.elements.map((element) => element.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {section.elements.map((element) => {
                              const isElementSelected =
                                flattenedSelection?.type === "element" && flattenedSelection.id === element.id;
                              return (
                                <SortableRow
                                  key={element.id}
                                  id={element.id}
                                  muted={!section.enabled}
                                  className={isElementSelected ? "ring-1 ring-sc-yellow/60" : ""}
                                  onClick={() =>
                                    setSelectedNode({
                                      type: "element",
                                      id: element.id,
                                      parentId: section.id
                                    })
                                  }
                                >
                                  <span className={isElementSelected ? "text-sc-text" : "text-sc-text"}>
                                    {ELEMENT_LABELS[element.type]}
                                  </span>
                                </SortableRow>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
