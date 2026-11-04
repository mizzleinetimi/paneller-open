"use client";

// Editor state, with undo. Every change that should be undoable goes through
// `commit`, which pushes the previous document onto the past stack. Dragging
// calls `live` instead, so a drag is one undo step rather than sixty.

import { create } from "zustand";
import { adoptLegacy, deleteComic as dropComic, readComic, readIndex, thumbnail, writeComic } from "./library";
import { sliceIntoPanels } from "./slice";
import {
  type Bubble,
  type BubbleKind,
  type Doc,
  type Page,
  type Panel,
  type ComicSummary,
  type Selection,
  type Point,
  type Story,
  bounds,
  carry,
  emptyDoc,
  newBubble,
  newId,
} from "./doc";

const LIMIT = 100;

type State = {
  doc: Doc;
  pageIndex: number;
  selection: Selection;
  past: Doc[];
  future: Doc[];
  loaded: boolean;
  /** Every comic kept in this browser, newest first. */
  library: ComicSummary[];

  page: () => Page;
  commit: (next: (doc: Doc) => Doc) => void;
  live: (next: (doc: Doc) => Doc) => void;
  undo: () => void;
  redo: () => void;
  select: (selection: Selection) => void;

  updatePanel: (id: string, patch: Partial<Panel>, live?: boolean) => void;
  /** Reshapes a panel and carries its lettering with it. */
  reshapePanel: (id: string, shape: Point[], live?: boolean) => void;
  updateBubble: (id: string, patch: Partial<Bubble>, live?: boolean) => void;
  addBubble: (kind: BubbleKind) => void;
  remove: (selection: NonNullable<Selection>) => void;
  /** Exchanges two panels' art, so a page can be re-ordered by dragging. */
  swapPanels: (a: string, b: string) => void;
  setDoc: (doc: Doc) => void;
  newComic: () => void;
  openComic: (id: string) => Promise<void>;
  forgetComic: (id: string) => Promise<void>;
  rename: (title: string) => void;
  openPage: (art: string, width: number, height: number, found: { panels: Panel[]; bubbles: Bubble[] }) => void;
  startStory: (story: Story, page: NewPage) => void;
  appendPage: (page: NewPage) => void;
  goToPage: (index: number) => void;
  removePage: (index: number) => void;
  setBubbles: (bubbles: Bubble[]) => void;
  setPageArt: (art: string) => void;
  restore: () => Promise<void>;
};

export type NewPage = {
  /** The whole page as one picture, when it still is one. */
  art?: string;
  width: number;
  height: number;
  panels: Panel[];
  bubbles: Bubble[];
  plan?: Page["plan"];
};

const asPage = (p: NewPage): Page => ({
  id: newId("page"),
  width: p.width,
  height: p.height,
  background: "#ffffff",
  art: p.art,
  panels: p.panels,
  bubbles: p.bubbles,
  plan: p.plan,
});

type Setter = (partial: Partial<State>) => void;

/** Writes a comic and refreshes the shelf; the first page becomes its cover. */
async function save(doc: Doc, set: Setter) {
  const first = doc.pages[0];
  const cover = await thumbnail(first?.art ?? first?.panels.find((p) => p.art)?.art?.src);
  set({ library: await writeComic(doc, cover) });
}

/** Cuts any page that is still one flat picture into its panels. */
async function sliced(doc: Doc): Promise<Doc> {
  const pages = await Promise.all(doc.pages.map(sliceIntoPanels));
  return pages.some((p, i) => p !== doc.pages[i]) ? { ...doc, pages } : doc;
}

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
  library: [],

  page: () => get().doc.pages[get().pageIndex],

  commit: (next) =>
    set((s) => {
      const doc = next(s.doc);
      if (doc === s.doc) return s;
      void save(doc, set);
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
      void save(previous, set);
      return { doc: previous, past: s.past.slice(0, -1), future: [s.doc, ...s.future], selection: null };
    }),

  redo: () =>
    set((s) => {
      const [next, ...rest] = s.future;
      if (!next) return s;
      void save(next, set);
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

  reshapePanel: (id, shape, isLive) => {
    const apply = (doc: Doc) =>
      mapPage(doc, get().pageIndex, (page) => {
        const panel = page.panels.find((p) => p.id === id);
        if (!panel) return page;
        const from = bounds(panel.shape);
        const to = bounds(shape);
        return {
          ...page,
          panels: page.panels.map((p) => (p.id === id ? { ...p, shape } : p)),
          // Words spoken in this panel move and scale with it.
          bubbles: page.bubbles.map((b) => (b.panelId === id ? carry(b, from, to) : b)),
        };
      });
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

  swapPanels: (a, b) => {
    if (a === b) return;
    get().commit((doc) =>
      mapPage(doc, get().pageIndex, (page) => {
        const first = page.panels.find((p) => p.id === a);
        const second = page.panels.find((p) => p.id === b);
        if (!first || !second) return page;
        const boxA = bounds(first.shape);
        const boxB = bounds(second.shape);
        // The frames stay where they are, which is what keeps a page tidy; what
        // is drawn in them trades places, along with the script behind it and
        // the words spoken in it.
        return {
          ...page,
          panels: page.panels.map((p) =>
            p.id === a
              ? { ...p, art: second.art, script: second.script, said: second.said }
              : p.id === b
                ? { ...p, art: first.art, script: first.script, said: first.said }
                : p,
          ),
          bubbles: page.bubbles.map((bubble) =>
            bubble.panelId === a
              ? { ...carry(bubble, boxA, boxB), panelId: b }
              : bubble.panelId === b
                ? { ...carry(bubble, boxB, boxA), panelId: a }
                : bubble,
          ),
        };
      }),
    );
  },

  setDoc: (doc) => get().commit(() => doc),

  newComic: () => {
    const doc = emptyDoc();
    set({ doc, pageIndex: 0, selection: null, past: [], future: [] });
  },

  openComic: async (id) => {
    const found = await readComic(id);
    if (!found) return;
    const doc = await sliced(found);
    set({ doc, pageIndex: 0, selection: null, past: [], future: [] });
    if (doc !== found) void save(doc, set);
  },

  forgetComic: async (id) => {
    const library = await dropComic(id);
    set({ library });
    if (get().doc.id === id) set({ doc: emptyDoc(), pageIndex: 0, selection: null, past: [], future: [] });
  },

  rename: (title) =>
    get().commit((doc) => ({ ...doc, title, ...(doc.story ? { story: { ...doc.story, title } } : {}) })),

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

  startStory: (story, page) => {
    // A new comic is a new comic: it never writes over the one on screen.
    const doc: Doc = { id: newId("comic"), title: story.title, story, pages: [asPage(page)] };
    void save(doc, set);
    set({ doc, pageIndex: 0, selection: null, past: [], future: [] });
  },

  appendPage: (page) => {
    get().commit((doc) => ({ ...doc, pages: [...doc.pages, asPage(page)] }));
    set({ pageIndex: get().doc.pages.length - 1, selection: null });
  },

  goToPage: (index) => {
    if (index >= 0 && index < get().doc.pages.length) set({ pageIndex: index, selection: null });
  },

  removePage: (index) => {
    const { doc } = get();
    if (doc.pages.length < 2) return;
    get().commit((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== index) }));
    set({ pageIndex: Math.max(0, Math.min(index, get().doc.pages.length - 1)), selection: null });
  },

  restore: async () => {
    await adoptLegacy();
    const library = await readIndex();
    const found = library[0] ? await readComic(library[0].id) : undefined;
    if (!found?.pages?.length) return set({ library, loaded: true });
    const doc = await sliced(found);
    set({ doc, library, loaded: true });
    if (doc !== found) void save(doc, set);
  },
}));
