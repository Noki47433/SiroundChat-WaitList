import { create } from "zustand";

export type SelectedNode =
  | { type: "page"; id: string }
  | { type: "section"; id: string; parentId?: string | null }
  | { type: "element"; id: string; parentId?: string | null };

type EditorState = {
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
};

export const useBuilderEditorStore = create<EditorState>((set) => ({
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node })
}));
