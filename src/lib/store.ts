"use client";

// Editor state, with undo. Every change that should be undoable goes through
// `commit`, which pushes the previous document onto the past stack. Dragging
// calls `live` instead, so a drag is one undo step rather than sixty.

import { get as idbGet, set as idbSet } from "idb-keyval";
import { create } from "zustand";
import {
  type Bubble,
  type BubbleKind,
  type Doc,
  type Page,
  type Panel,
  type Selection,
  emptyDoc,
  newBubble,
  newId,
} from "./doc";

const SAVE_KEY = "paneller-open.doc";
const LIMIT = 100;

type State = {
  doc: Doc;
  pageIndex: number;
  selection: Selection;
  past: Doc[];
  future: Doc[];
  loaded: boolean;

  page: () => Page;
  commit: (next: (doc: Doc) => Doc) => void;
  live: (next: (doc: Doc) => Doc) => void;
  undo: () => void;
  redo: () => void;
  select: (selection: Selection) => void;

  updatePanel: (id: string, patch: Partial<Panel>, live?: boolean) => void;
  updateBubble: (id: string, patch: Partial<Bubble>, live?: boolean) => void;
  addBubble: (kind: BubbleKind) => void;
  remove: (selection: NonNullable<Selection>) => void;
  setDoc: (doc: Doc) => void;
  openPage: (art: string, width: number, height: number, found: { panels: Panel[]; bubbles: Bubble[] }) => void;
  setBubbles: (bubbles: Bubble[]) => void;
  setPageArt: (art: string) => void;
  restore: () => Promise<void>;
};

const mapPage = (doc: Doc, index: number, f: (page: Page) => Page): Doc => ({
  ...doc,
  pages: doc.pages.map((p, i) => (i === index ? f(p) : p)),
});

export const useEditor = create<State>((set, get) => ({
  doc: emptyDoc(),
  pageIndex: 0,
  selection: null,
  past: [],
  future: [],
  loaded: false,

  page: () => get().doc.pages[get().pageIndex],

  commit: (next) =>
    set((s) => {
      const doc = next(s.doc);
      if (doc === s.doc) return s;
      void idbSet(SAVE_KEY, doc);
      return { doc, past: [...s.past, s.doc].slice(-LIMIT), future: [] };
    }),

  live: (next) =>
    set((s) => {
      const doc = next(s.doc);
      return doc === s.doc ? s : { doc };
    }),

  undo: () =>
    set((s) => {
      const previous = s.past.at(-1);
      if (!previous) return s;
      void idbSet(SAVE_KEY, previous);
      return { doc: previous, past: s.past.slice(0, -1), future: [s.doc, ...s.future], selection: null };
    }),

  redo: () =>
    set((s) => {
      const [next, ...rest] = s.future;
      if (!next) return s;
      void idbSet(SAVE_KEY, next);
      return { doc: next, past: [...s.past, s.doc], future: rest, selection: null };
    }),

  select: (selection) => set({ selection }),

  updatePanel: (id, patch, isLive) => {
    const apply = (doc: Doc) =>
      mapPage(doc, get().pageIndex, (page) => ({
        ...page,
        panels: page.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    if (isLive) get().live(apply);
    else get().commit(apply);
  },

  updateBubble: (id, patch, isLive) => {
    const apply = (doc: Doc) =>
      mapPage(doc, get().pageIndex, (page) => ({
        ...page,
        bubbles: page.bubbles.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    if (isLive) get().live(apply);
    else get().commit(apply);
  },

  addBubble: (kind) => {
    const page = get().page();
    // Step each new one down the page so it doesn't land on the last.
    const step = (page.bubbles.length % 6) * 48;
    const bubble = newBubble(kind, page.width / 2 - 130 + step, page.height / 2 - 70 + step);
    get().commit((doc) => mapPage(doc, get().pageIndex, (p) => ({ ...p, bubbles: [...p.bubbles, bubble] })));
    set({ selection: { kind: "bubble", id: bubble.id } });
  },

  remove: (selection) => {
    get().commit((doc) =>
      mapPage(doc, get().pageIndex, (page) =>
        selection.kind === "panel"
          ? { ...page, panels: page.panels.filter((p) => p.id !== selection.id) }
          : { ...page, bubbles: page.bubbles.filter((b) => b.id !== selection.id) },
      ),
    );
    set({ selection: null });
  },

  setDoc: (doc) => get().commit(() => doc),

  openPage: (art, width, height, found) => {
    get().commit((doc) => ({
      ...doc,
      pages: [
        {
          id: newId("page"),
          width,
          height,
          background: "#ffffff",
          art,
          panels: found.panels,
          bubbles: found.bubbles,
        },
      ],
    }));
    set({ pageIndex: 0, selection: null });
  },

  setBubbles: (bubbles) =>
    get().commit((doc) => mapPage(doc, get().pageIndex, (page) => ({ ...page, bubbles }))),

  setPageArt: (art) => get().commit((doc) => mapPage(doc, get().pageIndex, (page) => ({ ...page, art }))),

  restore: async () => {
    const saved = await idbGet<Doc>(SAVE_KEY).catch(() => undefined);
    set(saved?.pages?.length ? { doc: saved, loaded: true } : { loaded: true });
  },
}));
