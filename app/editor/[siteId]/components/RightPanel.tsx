"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import {
  selectSelectedContentKey,
  selectSelectedElement,
  selectSelectedSection
} from "@/lib/website-builder/editor/selectors";
import { TextEditor } from "@/app/editor/[siteId]/components/property-editors/TextEditor";
import { BackgroundEditor } from "@/app/editor/[siteId]/components/property-editors/BackgroundEditor";
import { SpacingEditor } from "@/app/editor/[siteId]/components/property-editors/SpacingEditor";
import type { ContentStyle, ElementStyle, SiteSection, SiteElement, ElementFrame } from "@/lib/website-builder/types";

const REQUIRED_CONTENT_KEYS: Record<string, string[]> = {
  hero: ["headline", "subheadline", "ctaLabel", "ctaHref"],
  services: ["title", "items"],
  about: ["title", "body"],
  gallery: ["title"],
  testimonials: ["title", "items"],
  pricing: ["title", "plans"],
  cta: ["title", "body", "ctaLabel", "ctaHref"],
  faq: ["title", "items"],
  contact: ["title", "body"],
  reservation: ["title", "body"],
  footer: ["text"]
};

const isMissingValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return value === undefined || value === null;
};

const parsePath = (path: string) => path.split(".").filter(Boolean);

const getByPath = (obj: any, path: string) => {
  const parts = parsePath(path);
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    const index = Number(part);
    if (Number.isFinite(index) && String(index) === part && Array.isArray(current)) {
      current = current[index];
    } else {
      current = current[part];
    }
  }
  return current;
};

const setByPath = (obj: any, path: string, value: any) => {
  const parts = parsePath(path);
  if (!parts.length) return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  let current: any = clone;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const index = Number(part);
    if (Number.isFinite(index) && String(index) === part) {
      current[index] = Array.isArray(current[index]) ? [...current[index]] : { ...(current[index] ?? {}) };
      current = current[index];
      continue;
    }
    const shouldBeArray = Number.isFinite(Number(nextPart)) && String(Number(nextPart)) === nextPart;
    current[part] = Array.isArray(current[part])
      ? [...current[part]]
      : shouldBeArray
        ? [...(current[part] ?? [])]
        : { ...(current[part] ?? {}) };
    current = current[part];
  }
  const last = parts[parts.length - 1];
  const lastIndex = Number(last);
  if (Number.isFinite(lastIndex) && String(lastIndex) === last && Array.isArray(current)) {
    current[lastIndex] = value;
  } else {
    current[last] = value;
  }
  return clone;
};

const parsePx = (value?: string) => {
  if (!value) return "";
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? String(numeric) : "";
};

const toPx = (value?: string | number) => {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return undefined;
  return `${numeric}px`;
};

const FONT_OPTIONS = [
  "Sora, Inter, system-ui, sans-serif",
  "Manrope, Inter, system-ui, sans-serif",
  '"Space Grotesk", Inter, system-ui, sans-serif',
  '"Playfair Display", Inter, system-ui, sans-serif'
];

const buildDefaultFrame = (element: SiteElement, index: number): ElementFrame => {
  const baseX = 24;
  const baseY = 24 + index * 120;
  if (element.type === "image") {
    return { x: baseX, y: baseY, width: 360, height: 220 };
  }
  if (element.type === "button") {
    return { x: baseX, y: baseY, width: 200, height: 60 };
  }
  if (element.type === "spacer") {
    return { x: baseX, y: baseY, width: 240, height: element.height ?? 24 };
  }
  if (element.type === "divider") {
    return { x: baseX, y: baseY, width: 320, height: 16 };
  }
  return { x: baseX, y: baseY, width: 440, height: 140 };
};

const StyleControls = ({
  value,
  onChange,
  allowBox = false
}: {
  value?: ContentStyle | ElementStyle;
  onChange: (next: ContentStyle | ElementStyle) => void;
  allowBox?: boolean;
}) => {
  const style = value ?? {};
  const boxStyle = style as ElementStyle;
  const update = (patch: Partial<ContentStyle & ElementStyle>) => onChange({ ...style, ...patch });
  const isBold = (style.fontWeight ?? 400) >= 600;
  const isItalic = style.fontStyle === "italic";
  const isUnderline = style.textDecoration === "underline";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => update({ fontWeight: isBold ? 400 : 700 })}
          className={`h-8 rounded-full border px-3 text-xs font-semibold ${
            isBold ? "border-sc-yellow bg-sc-surface-2 text-sc-text" : "border-sc-border text-sc-muted"
          }`}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => update({ fontStyle: isItalic ? "normal" : "italic" })}
          className={`h-8 rounded-full border px-3 text-xs font-semibold ${
            isItalic ? "border-sc-yellow bg-sc-surface-2 text-sc-text" : "border-sc-border text-sc-muted"
          }`}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => update({ textDecoration: isUnderline ? "none" : "underline" })}
          className={`h-8 rounded-full border px-3 text-xs font-semibold ${
            isUnderline ? "border-sc-yellow bg-sc-surface-2 text-sc-text" : "border-sc-border text-sc-muted"
          }`}
        >
          Underline
        </button>
      </div>
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Text color
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-11 rounded-lg border border-sc-border bg-sc-surface"
            value={style.color ?? "#111827"}
            onChange={(event) => update({ color: event.target.value })}
          />
          <input
            className="h-9 flex-1 rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
            value={style.color ?? ""}
            onChange={(event) => update({ color: event.target.value })}
            placeholder="#111827"
          />
        </div>
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Font size (px)
        <input
          type="number"
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={parsePx(style.fontSize)}
          onChange={(event) => update({ fontSize: toPx(event.target.value) })}
          placeholder="16"
        />
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Font weight
        <select
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={style.fontWeight ?? ""}
          onChange={(event) =>
            update({ fontWeight: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">Default</option>
          {[300, 400, 500, 600, 700, 800].map((weight) => (
            <option key={weight} value={weight}>
              {weight}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Line height
        <input
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={style.lineHeight ?? ""}
          onChange={(event) => update({ lineHeight: event.target.value })}
          placeholder="1.4"
        />
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Letter spacing (px)
        <input
          type="number"
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={parsePx(style.letterSpacing)}
          onChange={(event) => update({ letterSpacing: toPx(event.target.value) })}
          placeholder="0"
        />
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Font family
        <select
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={style.fontFamily ?? ""}
          onChange={(event) => update({ fontFamily: event.target.value })}
        >
          <option value="">Default</option>
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font.split(",")[0].replace(/\"/g, "")}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Text align
        <select
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={style.textAlign ?? ""}
          onChange={(event) => update({ textAlign: event.target.value as ContentStyle["textAlign"] })}
        >
          <option value="">Default</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Text transform
        <select
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={style.textTransform ?? ""}
          onChange={(event) =>
            update({ textTransform: event.target.value as ContentStyle["textTransform"] })
          }
        >
          <option value="">Default</option>
          <option value="none">None</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Max width (px)
        <input
          type="number"
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={parsePx(style.maxWidth)}
          onChange={(event) => update({ maxWidth: toPx(event.target.value) })}
          placeholder="640"
        />
      </label>

      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Opacity
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          className="mt-2 w-full"
          value={typeof style.opacity === "number" ? style.opacity : 1}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
      </label>

      {allowBox ? (
        <>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Background
            <input
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={boxStyle.background ?? ""}
              onChange={(event) => update({ background: event.target.value })}
              placeholder="transparent"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Padding
            <input
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={boxStyle.padding ?? ""}
              onChange={(event) => update({ padding: event.target.value })}
              placeholder="8px 12px"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Border radius
            <input
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={boxStyle.borderRadius ?? ""}
              onChange={(event) => update({ borderRadius: event.target.value })}
              placeholder="12px"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Shadow
            <input
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={boxStyle.boxShadow ?? ""}
              onChange={(event) => update({ boxShadow: event.target.value })}
              placeholder="0 10px 30px rgba(0,0,0,0.1)"
            />
          </label>
        </>
      ) : null}
    </div>
  );
};

const FrameEditor = ({
  frame,
  onChange
}: {
  frame: ElementFrame;
  onChange: (next: ElementFrame) => void;
}) => {
  const update = (patch: Partial<ElementFrame>) => onChange({ ...frame, ...patch });
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Position & size</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sc-muted">
          X
          <input
            type="number"
            className="mt-1 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
            value={frame.x}
            onChange={(event) => update({ x: Number(event.target.value) })}
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sc-muted">
          Y
          <input
            type="number"
            className="mt-1 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
            value={frame.y}
            onChange={(event) => update({ y: Number(event.target.value) })}
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sc-muted">
          Width
          <input
            type="number"
            className="mt-1 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
            value={frame.width}
            onChange={(event) => update({ width: Math.max(40, Number(event.target.value)) })}
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sc-muted">
          Height
          <input
            type="number"
            className="mt-1 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
            value={frame.height}
            onChange={(event) => update({ height: Math.max(24, Number(event.target.value)) })}
          />
        </label>
      </div>
    </div>
  );
};

export function RightPanel() {
  const state = useEditorState();
  const { push: pushToast } = useToast();
  const { updateDocument, setLeftPanelOpen, setLeftTool, setRightPanelOpen } = useEditorActions();
  const selectedSection = selectSelectedSection(state);
  const selectedElement = selectSelectedElement(state);
  const selectedContentKey = selectSelectedContentKey(state);
  const selectedContentValue =
    selectedSection && selectedContentKey ? getByPath(selectedSection.content ?? {}, selectedContentKey) : "";
  const selectedContentStyle =
    selectedSection && selectedContentKey ? selectedSection.contentStyles?.[selectedContentKey] : undefined;
  const isContentSelected = Boolean(selectedSection && selectedContentKey);
  const isElementSelected = Boolean(selectedElement);
  const isFreeform = selectedSection?.style.layoutMode === "freeform";
  const [isRegenerating, setIsRegenerating] = useState(false);
  const selectedElementIndex =
    selectedSection && selectedElement
      ? (selectedSection.elements ?? []).findIndex((element) => element.id === selectedElement.id)
      : -1;
  const resolvedElementFrame =
    selectedElement && selectedElementIndex >= 0
      ? selectedElement.frame ?? buildDefaultFrame(selectedElement, selectedElementIndex)
      : null;

  const updateSection = (updater: (section: SiteSection) => SiteSection) => {
    if (!selectedSection) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) =>
          section.id === selectedSection.id ? updater(section) : section
        )
      }))
    }));
  };

  const updateSectionContent = (key: string, value: unknown) =>
    updateSection((section) => ({
      ...section,
      content: { ...section.content, [key]: value }
    }));

  const updateSectionContentByPath = (path: string, value: unknown) =>
    updateSection((section) => ({
      ...section,
      content: setByPath(section.content ?? {}, path, value)
    }));

  const updateContentStyle = (path: string, value: ContentStyle) =>
    updateSection((section) => ({
      ...section,
      contentStyles: {
        ...(section.contentStyles ?? {}),
        [path]: value
      }
    }));

  const updateElementStyle = (element: SiteElement, style: ElementStyle) => {
    if (!selectedSection) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (section.id !== selectedSection.id) return section;
          return {
            ...section,
            elements: (section.elements ?? []).map((item) =>
              item.id === element.id ? { ...item, style } : item
            )
          };
        })
      }))
    }));
  };

  const updateElementFrame = (element: SiteElement, frame: ElementFrame) => {
    if (!selectedSection) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (section.id !== selectedSection.id) return section;
          return {
            ...section,
            elements: (section.elements ?? []).map((item) =>
              item.id === element.id ? { ...item, frame } : item
            )
          };
        })
      }))
    }));
  };

  const missingKeys = selectedSection
    ? (REQUIRED_CONTENT_KEYS[selectedSection.type] ?? []).filter((key) =>
        isMissingValue((selectedSection.content ?? {})[key])
      )
    : [];

  const canRegenerate =
    selectedSection && ["about", "hero", "services", "testimonials", "pricing", "cta", "faq"].includes(selectedSection.type);

  const handleRegenerate = async () => {
    if (!selectedSection || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const response = await fetch("/api/builder/regenerate-section-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: state.siteId,
          sectionId: selectedSection.id,
          sectionType: selectedSection.type
        })
      });
      if (!response.ok) {
        throw new Error("Regeneration failed");
      }
      const data = await response.json();
      if (data?.section?.content) {
        updateSection((section) => ({
          ...section,
          content: { ...section.content, ...data.section.content }
        }));
      }
      pushToast({ title: "Section regenerated", message: "Content updated.", variant: "success" });
    } catch (error) {
      console.error("[EDITOR_REGENERATE_ERROR]", error);
      pushToast({
        title: "Regeneration failed",
        message: "Try again in a moment.",
        variant: "error"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <aside
      className={`builder-panel flex h-full min-w-0 flex-col overflow-hidden rounded-l-xl border-l border-sc-border bg-sc-surface shadow-sm transition-all duration-200 ${
        state.isRightPanelOpen
          ? "w-[320px] translate-x-0 opacity-100 pointer-events-auto"
          : "w-0 translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between border-b border-sc-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-sc-text">Quick Edit</p>
          <p className="text-xs text-sc-muted">Contextual settings</p>
        </div>
        <button
          type="button"
          onClick={() => setRightPanelOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-sc-border text-sc-muted hover:bg-sc-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!selectedSection ? (
          <p className="text-sm text-sc-muted">Select a section or element to edit.</p>
        ) : null}

        {selectedSection && selectedContentKey ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Selected text</p>
              <p className="text-xs text-sc-muted">Edit the content and style.</p>
            </div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Content
              {typeof selectedContentValue === "string" && selectedContentValue.length > 80 ||
              /body|description|quote|subtitle|answer|excerpt/i.test(selectedContentKey ?? "")
                ? (
                  <textarea
                    className="mt-2 min-h-[120px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                    value={selectedContentValue ?? ""}
                    onChange={(event) => updateSectionContentByPath(selectedContentKey, event.target.value)}
                  />
                )
                : (
                  <input
                    className="mt-2 h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                    value={selectedContentValue ?? ""}
                    onChange={(event) => updateSectionContentByPath(selectedContentKey, event.target.value)}
                  />
                )}
            </label>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Style</p>
              <StyleControls
                value={selectedContentStyle}
                onChange={(next) => updateContentStyle(selectedContentKey, next)}
              />
            </div>
          </div>
        ) : null}

        {selectedSection && selectedElement?.type === "text" ? (
          <div className="space-y-4">
            <TextEditor
              label="Text"
              value={selectedElement.text}
              onChange={(value) =>
                updateDocument((doc) => ({
                  ...doc,
                  pages: doc.pages.map((page) => ({
                    ...page,
                    sections: page.sections.map((section) => {
                      if (section.id !== selectedSection.id) return section;
                      return {
                        ...section,
                        elements: (section.elements ?? []).map((element) =>
                          element.id === selectedElement.id && element.type === "text"
                            ? { ...element, text: value }
                            : element
                        )
                      };
                    })
                  }))
                }))
              }
            />
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Style
              <select
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.textStyle}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "text"
                              ? {
                                  ...element,
                                  textStyle: event.target.value as "h1" | "h2" | "h3" | "body" | "caption"
                                }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              >
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="body">Paragraph</option>
                <option value="caption">Caption</option>
              </select>
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Style</p>
              <StyleControls
                value={selectedElement.style}
                allowBox
                onChange={(next) => updateElementStyle(selectedElement, next)}
              />
            </div>
            {isFreeform && resolvedElementFrame ? (
              <FrameEditor
                frame={resolvedElementFrame}
                onChange={(next) => updateElementFrame(selectedElement, next)}
              />
            ) : null}
          </div>
        ) : null}

        {selectedSection && selectedElement?.type === "image" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setLeftTool("media");
                setLeftPanelOpen(true);
              }}
              className="rounded-xl border border-sc-border px-3 py-2 text-xs font-semibold text-sc-text"
            >
              Replace image
            </button>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Alt text
              <input
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.alt ?? ""}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "image"
                              ? { ...element, alt: event.target.value }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Style</p>
              <StyleControls
                value={selectedElement.style}
                allowBox
                onChange={(next) => updateElementStyle(selectedElement, next)}
              />
            </div>
            {isFreeform && resolvedElementFrame ? (
              <FrameEditor
                frame={resolvedElementFrame}
                onChange={(next) => updateElementFrame(selectedElement, next)}
              />
            ) : null}
          </div>
        ) : null}

        {selectedSection && selectedElement?.type === "button" ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Label
              <input
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.label}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "button"
                              ? { ...element, label: event.target.value }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Link
              <input
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.href}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "button"
                              ? { ...element, href: event.target.value }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Style</p>
              <StyleControls
                value={selectedElement.style}
                allowBox
                onChange={(next) => updateElementStyle(selectedElement, next)}
              />
            </div>
            {isFreeform && resolvedElementFrame ? (
              <FrameEditor
                frame={resolvedElementFrame}
                onChange={(next) => updateElementFrame(selectedElement, next)}
              />
            ) : null}
          </div>
        ) : null}

        {selectedSection && selectedElement?.type === "spacer" ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Height
              <input
                type="number"
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.height ?? 24}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "spacer"
                              ? { ...element, height: Number(event.target.value) }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            {isFreeform && resolvedElementFrame ? (
              <FrameEditor
                frame={resolvedElementFrame}
                onChange={(next) => updateElementFrame(selectedElement, next)}
              />
            ) : null}
          </div>
        ) : null}

        {selectedSection && selectedElement?.type === "divider" ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Thickness
              <input
                type="number"
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.thickness ?? 1}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "divider"
                              ? { ...element, thickness: Number(event.target.value) }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
              Color
              <input
                type="color"
                className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={selectedElement.color ?? "#E2E8F0"}
                onChange={(event) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) => {
                        if (section.id !== selectedSection.id) return section;
                        return {
                          ...section,
                          elements: (section.elements ?? []).map((element) =>
                            element.id === selectedElement.id && element.type === "divider"
                              ? { ...element, color: event.target.value }
                              : element
                          )
                        };
                      })
                    }))
                  }))
                }
              />
            </label>
            {isFreeform && resolvedElementFrame ? (
              <FrameEditor
                frame={resolvedElementFrame}
                onChange={(next) => updateElementFrame(selectedElement, next)}
              />
            ) : null}
          </div>
        ) : null}

        {selectedSection && !isContentSelected && !isElementSelected ? (
          <>
            <div className="space-y-4 border-t border-sc-border pt-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Section content</p>
                  <p className="text-xs text-sc-muted">Update the copy for this section.</p>
                </div>
                {missingKeys.length ? (
                  <div className="rounded-xl border border-sc-border bg-sc-surface-2 px-3 py-2 text-xs text-sc-muted">
                    Missing required fields: {missingKeys.join(", ")}
                  </div>
                ) : null}

                {selectedSection.type === "hero" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.headline ?? ""}
                      onChange={(event) => updateSectionContent("headline", event.target.value)}
                      placeholder="Headline"
                    />
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                      value={selectedSection.content.subheadline ?? ""}
                      onChange={(event) => updateSectionContent("subheadline", event.target.value)}
                      placeholder="Subheadline"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.ctaLabel ?? ""}
                      onChange={(event) => updateSectionContent("ctaLabel", event.target.value)}
                      placeholder="CTA label"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.ctaHref ?? ""}
                      onChange={(event) => updateSectionContent("ctaHref", event.target.value)}
                      placeholder="CTA link"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "about" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Title"
                    />
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                      value={selectedSection.content.body ?? ""}
                      onChange={(event) => updateSectionContent("body", event.target.value)}
                      placeholder="Body"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "services" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Section title"
                    />
                    {(Array.isArray(selectedSection.content.items) ? selectedSection.content.items : []).map(
                      (item: any, index: number) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl border border-sc-border p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={item.title ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), title: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Service title"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-sc-border bg-sc-surface px-2 py-2 text-sm text-sc-text"
                            value={item.body ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), body: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Service description"
                          />
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateSection((section) => ({
                          ...section,
                          content: {
                            ...section.content,
                            items: [
                              ...(Array.isArray(section.content.items) ? section.content.items : []),
                              { title: "New service", body: "Describe this service." }
                            ]
                          }
                        }))
                      }
                      className="text-xs font-semibold text-sc-muted"
                    >
                      Add service
                    </button>
                  </div>
                ) : null}

                {selectedSection.type === "gallery" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Gallery title"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "testimonials" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Section title"
                    />
                    {(Array.isArray(selectedSection.content.items) ? selectedSection.content.items : []).map(
                      (item: any, index: number) => (
                        <div key={`${item.name}-${index}`} className="rounded-xl border border-sc-border p-3">
                          <textarea
                            className="min-h-[80px] w-full rounded-lg border border-sc-border bg-sc-surface px-2 py-2 text-sm text-sc-text"
                            value={item.quote ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), quote: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Quote"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={item.name ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), name: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Name"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={item.role ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), role: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Role"
                          />
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateSection((section) => ({
                          ...section,
                          content: {
                            ...section.content,
                            items: [
                              ...(Array.isArray(section.content.items) ? section.content.items : []),
                              { quote: "Client quote goes here.", name: "New name", role: "Client" }
                            ]
                          }
                        }))
                      }
                      className="text-xs font-semibold text-sc-muted"
                    >
                      Add testimonial
                    </button>
                  </div>
                ) : null}

                {selectedSection.type === "pricing" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Section title"
                    />
                    {(Array.isArray(selectedSection.content.plans) ? selectedSection.content.plans : []).map(
                      (plan: any, index: number) => (
                        <div key={`${plan.name}-${index}`} className="rounded-xl border border-sc-border p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={plan.name ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const plans = Array.isArray(section.content.plans)
                                  ? [...section.content.plans]
                                  : [];
                                plans[index] = { ...(plans[index] ?? {}), name: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Plan name"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={plan.price ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const plans = Array.isArray(section.content.plans)
                                  ? [...section.content.plans]
                                  : [];
                                plans[index] = { ...(plans[index] ?? {}), price: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Price"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-sc-border bg-sc-surface px-2 py-2 text-sm text-sc-text"
                            value={plan.description ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const plans = Array.isArray(section.content.plans)
                                  ? [...section.content.plans]
                                  : [];
                                plans[index] = { ...(plans[index] ?? {}), description: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Description"
                          />
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateSection((section) => ({
                          ...section,
                          content: {
                            ...section.content,
                            plans: [
                              ...(Array.isArray(section.content.plans) ? section.content.plans : []),
                              { name: "New plan", price: "$0", description: "Plan details." }
                            ]
                          }
                        }))
                      }
                      className="text-xs font-semibold text-sc-muted"
                    >
                      Add plan
                    </button>
                  </div>
                ) : null}

                {selectedSection.type === "cta" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Title"
                    />
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                      value={selectedSection.content.body ?? ""}
                      onChange={(event) => updateSectionContent("body", event.target.value)}
                      placeholder="Body"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.ctaLabel ?? ""}
                      onChange={(event) => updateSectionContent("ctaLabel", event.target.value)}
                      placeholder="CTA label"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.ctaHref ?? ""}
                      onChange={(event) => updateSectionContent("ctaHref", event.target.value)}
                      placeholder="CTA link"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "faq" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Section title"
                    />
                    {(Array.isArray(selectedSection.content.items) ? selectedSection.content.items : []).map(
                      (item: any, index: number) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-sc-border p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                            value={item.question ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), question: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Question"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-sc-border bg-sc-surface px-2 py-2 text-sm text-sc-text"
                            value={item.answer ?? ""}
                            onChange={(event) =>
                              updateSection((section) => {
                                const items = Array.isArray(section.content.items)
                                  ? [...section.content.items]
                                  : [];
                                items[index] = { ...(items[index] ?? {}), answer: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Answer"
                          />
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateSection((section) => ({
                          ...section,
                          content: {
                            ...section.content,
                            items: [
                              ...(Array.isArray(section.content.items) ? section.content.items : []),
                              { question: "New question", answer: "Add an answer." }
                            ]
                          }
                        }))
                      }
                      className="text-xs font-semibold text-sc-muted"
                    >
                      Add FAQ
                    </button>
                  </div>
                ) : null}

                {selectedSection.type === "contact" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Title"
                    />
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                      value={selectedSection.content.body ?? ""}
                      onChange={(event) => updateSectionContent("body", event.target.value)}
                      placeholder="Body"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.email ?? ""}
                      onChange={(event) => updateSectionContent("email", event.target.value)}
                      placeholder="Email"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.phone ?? ""}
                      onChange={(event) => updateSectionContent("phone", event.target.value)}
                      placeholder="Phone"
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.address ?? ""}
                      onChange={(event) => updateSectionContent("address", event.target.value)}
                      placeholder="Address"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "reservation" ? (
                  <div className="space-y-3">
                    <input
                      className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) => updateSectionContent("title", event.target.value)}
                      placeholder="Title"
                    />
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
                      value={selectedSection.content.body ?? ""}
                      onChange={(event) => updateSectionContent("body", event.target.value)}
                      placeholder="Body"
                    />
                  </div>
                ) : null}

                {selectedSection.type === "footer" ? (
                  <input
                    className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
                    value={selectedSection.content.text ?? ""}
                    onChange={(event) => updateSectionContent("text", event.target.value)}
                    placeholder="Footer text"
                  />
                ) : null}

                {canRegenerate ? (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="rounded-xl border border-sc-border px-3 py-2 text-xs font-semibold text-sc-text disabled:opacity-40"
                  >
                    {isRegenerating ? "Regenerating..." : "Regenerate section"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 border-t border-sc-border pt-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Layout mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["flow", "freeform"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        updateSection((section) => {
                          const nextMode = mode;
                          const elements = (section.elements ?? []).map((element, index) =>
                            nextMode === "freeform" && !element.frame
                              ? { ...element, frame: buildDefaultFrame(element, index) }
                              : element
                          );
                          return {
                            ...section,
                            elements,
                            style: { ...section.style, layoutMode: nextMode }
                          };
                        })
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        (selectedSection.style.layoutMode ?? "flow") === mode
                          ? "border-sc-yellow bg-sc-surface-2 text-sc-text"
                          : "border-sc-border text-sc-muted"
                      }`}
                    >
                      {mode === "flow" ? "Flow" : "Freeform"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-sc-muted">
                  Freeform lets you drag and resize elements anywhere inside the section.
                </p>
              </div>
              <BackgroundEditor
                value={selectedSection.style.background}
                mediaLibrary={state.document?.mediaLibrary ?? []}
                onChange={(background) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) =>
                        section.id === selectedSection.id
                          ? { ...section, style: { ...section.style, background } }
                          : section
                      )
                    }))
                  }))
                }
              />
              <SpacingEditor
                value={selectedSection.style.spacing}
                onChange={(spacing) =>
                  updateDocument((doc) => ({
                    ...doc,
                    pages: doc.pages.map((page) => ({
                      ...page,
                      sections: page.sections.map((section) =>
                        section.id === selectedSection.id
                          ? { ...section, style: { ...section.style, spacing } }
                          : section
                      )
                    }))
                  }))
                }
              />
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
