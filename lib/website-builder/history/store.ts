import { create } from "zustand";
import type { SiteDocument } from "@/lib/website-builder/types";

type HistoryState = {
  past: SiteDocument[];
  present: SiteDocument | null;
  future: SiteDocument[];
  setPresent: (doc: SiteDocument) => void;
  commit: (doc: SiteDocument) => void;
  undo: () => void;
  redo: () => void;
};

export const useSiteHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  present: null,
  future: [],
  setPresent: (doc) => set({ past: [], present: doc, future: [] }),
  commit: (doc) =>
    set((state) => ({
      past: state.present ? [...state.past, state.present] : state.past,
      present: doc,
      future: []
    })),
  undo: () =>
    set((state) => {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      return {
        past,
        present: previous,
        future: state.present ? [state.present, ...state.future] : state.future
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.future.length) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      return {
        past: state.present ? [...state.past, state.present] : state.past,
        present: next,
        future
      };
    })
}));
