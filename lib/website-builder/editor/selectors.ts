import type { SiteElement, SitePage, SiteSection } from "@/lib/website-builder/types";
import type { EditorState } from "@/lib/website-builder/editor/types";

export const selectActivePage = (state: EditorState): SitePage | null => {
  const pages = state.document?.pages ?? [];
  if (!pages.length) return null;
  if (!state.activePageId) return pages[0];
  return pages.find((page) => page.id === state.activePageId) ?? pages[0];
};

export const selectSections = (state: EditorState): SiteSection[] => {
  const activePage = selectActivePage(state);
  return activePage?.sections ?? [];
};

export const selectSelectedSection = (state: EditorState): SiteSection | null => {
  const sections = selectSections(state);
  const node = state.selectedNode;
  if (!node) return null;
  if (node.type === "section") return sections.find((section) => section.id === node.id) ?? null;
  if (node.type === "element" && node.parentId) {
    return sections.find((section) => section.id === node.parentId) ?? null;
  }
  if (node.type === "content" && node.parentId) {
    return sections.find((section) => section.id === node.parentId) ?? null;
  }
  return null;
};

export const selectSelectedElement = (state: EditorState): SiteElement | null => {
  if (state.selectedNode?.type !== "element") return null;
  const section = selectSelectedSection(state);
  if (!section?.elements?.length) return null;
  return section.elements.find((element) => element.id === state.selectedNode?.id) ?? null;
};

export const selectSelectedContentKey = (state: EditorState): string | null => {
  if (state.selectedNode?.type !== "content") return null;
  return state.selectedNode.key;
};
