"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectSelectedSection } from "@/lib/website-builder/editor/selectors";
import type { SiteElement } from "@/lib/website-builder/types";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `element-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type ElementBlueprint = {
  id: string;
  label: string;
  description: string;
  build: () => SiteElement;
};

export function ElementsPanel() {
  const state = useEditorState();
  const { updateDocument, setSelectedNode, setRightPanelOpen } = useEditorActions();
  const selectedSection = selectSelectedSection(state);
  const isFreeform = selectedSection?.style.layoutMode === "freeform";
  const alignment = selectedSection?.style.alignment ?? "left";
  const dividerColor = state.document?.theme.border ?? "#E2E8F0";

  const elementLibrary = useMemo<ElementBlueprint[]>(
    () => {
      const mediaLibrary = state.document?.mediaLibrary ?? [];
      return [
      {
        id: "heading",
        label: "Heading",
        description: "Display a bold title or callout.",
        build: () => ({
          id: createId(),
          type: "text",
          text: "Heading text",
          textStyle: "h2",
          align: alignment
        })
      },
      {
        id: "paragraph",
        label: "Paragraph",
        description: "Body copy and supporting text.",
        build: () => ({
          id: createId(),
          type: "text",
          text: "Body copy goes here.",
          textStyle: "body",
          align: alignment
        })
      },
      {
        id: "button",
        label: "Button",
        description: "Primary call-to-action button.",
        build: () => ({
          id: createId(),
          type: "button",
          label: "Learn more",
          href: "#contact",
          variant: "primary",
          align: alignment
        })
      },
      {
        id: "image",
        label: "Image",
        description: "Inline media or illustration.",
        build: () => ({
          id: createId(),
          type: "image",
          src:
            mediaLibrary[0]?.src ??
            "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1200",
          alt: "Section image"
        })
      },
      {
        id: "spacer",
        label: "Spacer",
        description: "Add breathing room between blocks.",
        build: () => ({
          id: createId(),
          type: "spacer",
          height: 24
        })
      },
      {
        id: "divider",
        label: "Divider",
        description: "Subtle horizontal rule.",
        build: () => ({
          id: createId(),
          type: "divider",
          thickness: 1,
          color: dividerColor
        })
      }
      ];
    },
    [alignment, dividerColor, state.document?.mediaLibrary]
  );

  const handleAddElement = (blueprint: ElementBlueprint) => {
    if (!selectedSection) return;
    const element = blueprint.build();
    const index = selectedSection.elements ? selectedSection.elements.length : 0;
    const frame =
      isFreeform && !element.frame
        ? {
            x: 24,
            y: 24 + index * 120,
            width: element.type === "image" ? 360 : element.type === "button" ? 200 : 420,
            height:
              element.type === "image"
                ? 220
                : element.type === "button"
                  ? 60
                  : element.type === "spacer"
                    ? element.height ?? 24
                    : element.type === "divider"
                      ? 16
                      : 140
          }
        : undefined;
    const nextElement = frame ? { ...element, frame } : element;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (section.id !== selectedSection.id) return section;
          return { ...section, elements: [...(section.elements ?? []), nextElement] };
        })
      }))
    }));
    setSelectedNode({ type: "element", id: nextElement.id, parentId: selectedSection.id });
    setRightPanelOpen(true);
  };

  if (!selectedSection) {
    return <p className="text-sm text-sc-muted">Select a section to add elements.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Elements</p>
        <p className="mt-1 text-xs text-sc-muted">Add extra blocks inside the selected section.</p>
      </div>
      <div className="space-y-2">
        {elementLibrary.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleAddElement(item)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-left transition hover:bg-sc-surface-2"
          >
            <div>
              <p className="text-sm font-semibold text-sc-text">{item.label}</p>
              <p className="text-xs text-sc-muted">{item.description}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-sc-border text-sc-text">
              <Plus className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
