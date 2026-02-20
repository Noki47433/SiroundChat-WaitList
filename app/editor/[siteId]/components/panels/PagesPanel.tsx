"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage } from "@/lib/website-builder/editor/selectors";
import type { SiteDocument, SitePage, SiteSection } from "@/lib/website-builder/types";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const defaultStyle: SiteSection["style"] = {
  alignment: "left",
  spacing: "normal",
  background: { type: "plain" },
  buttonStyle: "solid",
  colorOverride: null
};

const buildBlankSection = (): SiteSection => ({
  id: createId(),
  type: "custom",
  variant: "A",
  enabled: true,
  style: { ...defaultStyle },
  content: { title: "Custom section", body: "Add your own elements and layout." }
});

const resolveFooterSection = (doc: SiteDocument) => {
  const footer = doc.pages.flatMap((page) => page.sections).find((section) => section.type === "footer");
  if (!footer) return null;
  return {
    ...footer,
    id: createId(),
    content: JSON.parse(JSON.stringify(footer.content ?? {})),
    images: footer.images ? JSON.parse(JSON.stringify(footer.images)) : undefined,
    elements: footer.elements ? JSON.parse(JSON.stringify(footer.elements)) : undefined
  };
};

const ensureUniqueSlug = (slug: string, pages: SitePage[], pageId?: string) => {
  const base = slug || "page";
  let candidate = base;
  let counter = 1;
  const exists = (value: string) => pages.some((page) => page.slug === value && page.id !== pageId);
  while (exists(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
};

export function PagesPanel() {
  const state = useEditorState();
  const { updateDocument, setActivePage } = useEditorActions();
  const activePage = selectActivePage(state);
  const [newPageName, setNewPageName] = useState("");

  const { normalPages, systemPages } = useMemo(() => {
    const pages = state.document?.pages ?? [];
    const normal = pages.filter((page) => !page.isSystem);
    const system = pages.filter((page) => page.isSystem);
    const sorted = [...normal].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return { normalPages: sorted, systemPages: system };
  }, [state.document?.pages]);

  const updatePage = (pageId: string, updater: (page: SitePage) => SitePage) => {
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => (page.id === pageId ? updater(page) : page))
    }));
  };

  const addPage = (name: string) => {
    const pageId = createId();
    updateDocument((doc) => {
      const slug = ensureUniqueSlug(slugify(name), doc.pages);
      const order = Math.max(0, ...doc.pages.map((page) => page.order ?? 0)) + 1;
      const footer = resolveFooterSection(doc);
      const sections = footer ? [buildBlankSection(), footer] : [buildBlankSection()];
      const nextPage: SitePage = {
        id: pageId,
        name,
        slug: slug || "page",
        showInMenu: true,
        menuTitle: name,
        parentId: null,
        order,
        sections
      };
      return { ...doc, pages: [...doc.pages, nextPage] };
    });
    setActivePage(pageId);
  };

  const reorderPages = (pageId: string, direction: -1 | 1) => {
    updateDocument((doc) => {
      const list = doc.pages
        .filter((page) => !page.isSystem)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const systemPagesList = doc.pages.filter((page) => page.isSystem);
      const index = list.findIndex((page) => page.id === pageId);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= list.length) return doc;
      const reordered = [...list];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);
      const withOrder = reordered.map((page, order) => ({ ...page, order }));
      return { ...doc, pages: [...withOrder, ...systemPagesList] };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Pages</p>
        <p className="mt-1 text-xs text-sc-muted">Create, rename, and reorder your site pages.</p>
      </div>
      <div className="flex gap-2">
        <input
          className="h-9 flex-1 rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
          value={newPageName}
          onChange={(event) => setNewPageName(event.target.value)}
          placeholder="New page name"
        />
        <button
          type="button"
          onClick={() => {
            const name = newPageName.trim();
            if (!name) return;
            addPage(name);
            setNewPageName("");
          }}
          className="rounded-xl border border-sc-border px-3 text-xs font-semibold text-sc-text"
        >
          Add
        </button>
      </div>
      <div className="space-y-2">
        {normalPages.map((page, index) => {
          const isActive = activePage?.id === page.id;
          return (
            <div key={page.id} className="rounded-xl border border-sc-border bg-sc-surface px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActivePage(page.id)}
                  className={`text-left text-sm font-semibold ${isActive ? "text-sc-text" : "text-sc-muted"}`}
                >
                  {page.name}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => reorderPages(page.id, -1)}
                    disabled={index === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-sc-border text-sc-text disabled:opacity-40"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reorderPages(page.id, 1)}
                    disabled={index === normalPages.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-sc-border text-sc-text disabled:opacity-40"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-sc-muted">
                <input
                  type="checkbox"
                  checked={page.showInMenu !== false}
                  onChange={(event) =>
                    updatePage(page.id, (current) => ({ ...current, showInMenu: event.target.checked }))
                  }
                />
                Show in menu
              </label>
              {isActive ? (
                <div className="mt-3 space-y-2">
                  <input
                    className="h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                    value={page.name}
                    onChange={(event) =>
                      updatePage(page.id, (current) => {
                        const nextName = event.target.value;
                        const nextMenuTitle =
                          !current.menuTitle || current.menuTitle === current.name
                            ? nextName
                            : current.menuTitle;
                        return { ...current, name: nextName, menuTitle: nextMenuTitle };
                      })
                    }
                    placeholder="Page name"
                  />
                  <input
                    className="h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                    value={page.menuTitle ?? page.name}
                    onChange={(event) =>
                      updatePage(page.id, (current) => ({ ...current, menuTitle: event.target.value }))
                    }
                    placeholder="Menu label"
                  />
                  <input
                    className="h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                    value={page.slug}
                    onChange={(event) =>
                      updatePage(page.id, (current) => ({
                        ...current,
                        slug: ensureUniqueSlug(slugify(event.target.value), state.document?.pages ?? [], page.id)
                      }))
                    }
                    placeholder="Slug"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {systemPages.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">System pages</p>
          {systemPages.map((page) => (
            <div key={page.id} className="rounded-xl border border-sc-border bg-sc-surface px-3 py-2">
              <button
                type="button"
                onClick={() => setActivePage(page.id)}
                className="text-left text-sm font-semibold text-sc-text"
              >
                {page.name}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
