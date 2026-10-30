"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { bounds as boundsOf } from "@/lib/doc";
import { useEditor } from "@/lib/store";

// Konva draws to a canvas and needs a window, so it must not be prerendered.
const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-neutral-500">Preparing the page...</div>,
});

const button =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700";

const LANGUAGES = ["Yoruba", "Spanish", "Japanese", "French", "Arabic", "Hindi", "Portuguese"];
const STYLE_NAMES = ["classic", "manga", "noir", "soft"];

function DrawPage({
  busy,
  continuing,
  onDraw,
  onClose,
}: {
  busy: boolean;
  /** The comic already running, if this is a further page. */
  continuing?: { title: string; cast: { who: string; look: string }[] };
  onDraw: (idea: string, panels: number, style: string) => void;
  onClose: () => void;
}) {
  const [idea, setIdea] = useState("");
  const [panels, setPanels] = useState(4);
  const [style, setStyle] = useState("classic");
  return (
    <div className="absolute left-0 right-0 top-full z-10 border-b border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {continuing ? `What happens next in "${continuing.title}"?` : "What happens on this page?"}
        </label>
        {continuing && continuing.cast.length > 0 && (
          <p className="-mt-1 text-xs text-neutral-500">
            Carrying on with {continuing.cast.map((c) => c.look).join(", ")}, drawn from the page before
            so they keep their faces.
          </p>
        )}
        <textarea
          autoFocus
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={2}
          placeholder={
            continuing
              ? "the conductor finally gives him his change, and the bus pulls away"
              : "a danfo driver in Lagos traffic argues with a conductor, then spots his old teacher through the window"
          }
          className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-neutral-500">
            Panels
            <select className={`${button} ml-2`} value={panels} onChange={(e) => setPanels(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {!continuing && (
            <label className="text-xs text-neutral-500">
              Style
              <select className={`${button} ml-2`} value={style} onChange={(e) => setStyle(e.target.value)}>
                {STYLE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <span className="flex-1" />
          <button className={button} onClick={onClose}>Cancel</button>
          <button className={button} onClick={() => idea.trim() && onDraw(idea.trim(), panels, style)} disabled={busy || !idea.trim()}>
            {busy ? "Drawing..." : continuing ? "Draw the next page" : "Draw the page"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Muse Spark plans the panels and the dialogue, Muse Image draws the art with no lettering on
          it, and the words go on top as objects you can edit. About a minute.
        </p>
      </div>
    </div>
  );
}

function PanelInspector({ busy, onRedraw }: { busy: boolean; onRedraw: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
      <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">Redraw this panel</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="make it night, add a second bus..."
        className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button className={button} onClick={() => prompt.trim() && onRedraw(prompt.trim())} disabled={busy || !prompt.trim()}>
        {busy ? "Drawing..." : "Redraw"}
      </button>
    </div>
  );
}

function Inspector() {
  const { selection, doc, pageIndex, updateBubble } = useEditor();
  const page = doc.pages[pageIndex];
  if (selection?.kind !== "bubble") return null;
  const bubble = page.bubbles.find((b) => b.id === selection.id);
  if (!bubble) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
      <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {bubble.kind} text
      </label>
      <textarea
        value={bubble.text}
        onChange={(e) => updateBubble(bubble.id, { text: e.target.value }, true)}
        onBlur={(e) => updateBubble(bubble.id, { text: e.target.value })}
        rows={3}
        className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <label className="text-xs text-neutral-500">
        Size {bubble.fontSize}
        <input
          type="range"
          min={12}
          max={120}
          value={bubble.fontSize}
          onChange={(e) => updateBubble(bubble.id, { fontSize: Number(e.target.value) }, true)}
          onMouseUp={(e) => updateBubble(bubble.id, { fontSize: Number((e.target as HTMLInputElement).value) })}
          className="w-full"
        />
      </label>
    </div>
  );
}

/** Reads a file into a data URL and the pixel size of the image inside it. */
function readImage(file: File): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onerror = () => reject(new Error("That file is not an image."));
      img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** The pages of the comic, to move between and to add to. */
function PageStrip({
  count,
  current,
  busy,
  onGo,
  onAdd,
  onRemove,
}: {
  count: number;
  current: number;
  busy: boolean;
  onGo: (i: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 border-t border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <span className="mr-1 text-xs text-neutral-500">Pages</span>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          className={`h-7 w-7 rounded-md border text-xs font-medium ${
            i === current
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          {i + 1}
        </button>
      ))}
      <button className={`${button} ml-1`} onClick={onAdd} disabled={busy}>+ Page</button>
      {count > 1 && (
        <button className={button} onClick={() => onRemove(current)} disabled={busy}>
          Remove page {current + 1}
        </button>
      )}
    </div>
  );
}

export default function Editor() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const {
    addBubble, undo, redo, remove, selection, past, future, restore, loaded, doc, openPage,
    pageIndex, startStory, appendPage, goToPage, removePage,
  } = useEditor();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setReading("Reading the page...");
    try {
      const { src, width, height } = await readImage(file);
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: src }),
      });
      const found = await res.json();
      if (!res.ok) throw new Error(found.error ?? "Could not read that page.");
      openPage(src, width, height, found);
      setReading(`Found ${found.counts.panels} panels, ${found.counts.speech} bubbles, ${found.counts.sfx} sound effects.`);
      setTimeout(() => setReading(null), 6000);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not read that page.");
      setReading(null);
    }
  };

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName);
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === "Backspace" || e.key === "Delete") && selection) {
        e.preventDefault();
        remove(selection);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, remove, selection]);

  const page = doc.pages[pageIndex];

  const call = async <T,>(label: string, url: string, body: unknown): Promise<T | undefined> => {
    setProblem(null);
    setReading(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That did not work.");
      setReading(null);
      return json as T;
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That did not work.");
      setReading(null);
      return undefined;
    }
  };

  const readLettering = async () => {
    const out = await call<{ bubbles: typeof page.bubbles }>("Reading the lettering...", "/api/read", {
      image: page.art,
      bubbles: page.bubbles,
    });
    if (out) useEditor.getState().setBubbles(out.bubbles);
  };

  const translate = async (language: string) => {
    const out = await call<{ bubbles: typeof page.bubbles }>(`Lettering in ${language}...`, "/api/translate", {
      bubbles: page.bubbles,
      language,
    });
    if (out) useEditor.getState().setBubbles(out.bubbles);
  };

  const redraw = async (prompt: string) => {
    if (selection?.kind !== "panel") return;
    const panel = page.panels.find((p) => p.id === selection.id);
    if (!panel) return;
    const out = await call<{ page?: string; art?: string }>("Redrawing the panel...", "/api/redraw", {
      image: page.art,
      panel,
      prompt,
    });
    if (out?.page) useEditor.getState().setPageArt(out.page);
    else if (out?.art) useEditor.getState().updatePanel(panel.id, { art: { src: out.art, ...boundsOf(panel.shape) } });
  };

  const drawNewPage = async (idea: string, panels: number, style: string) => {
    const story = doc.story;
    const carryOn = Boolean(story && doc.pages.some((p) => p.art));
    const out = await call<{
      image: string;
      plan: NonNullable<typeof page.plan>;
      story?: NonNullable<typeof doc.story>;
      panels: typeof page.panels;
      bubbles: typeof page.bubbles;
    }>(
      carryOn ? "Planning and drawing the next page..." : "Planning, drawing and lettering the page...",
      "/api/page",
      carryOn
        ? {
            what: idea,
            panels,
            story,
            soFar: doc.pages.map((p) => p.plan).filter(Boolean),
            // The page before this one, so the cast keeps its faces.
            reference: doc.pages[doc.pages.length - 1]?.art,
          }
        : { idea, panels, style },
    );
    if (!out) return;
    const img = new window.Image();
    img.onload = () => {
      const made = {
        art: out.image,
        width: img.naturalWidth,
        height: img.naturalHeight,
        panels: out.panels,
        bubbles: out.bubbles,
        plan: out.plan,
      };
      if (carryOn) appendPage(made);
      else if (out.story) startStory(out.story, made);
      else openPage(out.image, img.naturalWidth, img.naturalHeight, out);
      setDrawing(false);
    };
    img.src = out.image;
  };

  const exportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const url = stage.toDataURL({ pixelRatio: page.width / stage.width() });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/\W+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="relative flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="mr-2 font-semibold tracking-tight">Paneller <span className="font-normal text-neutral-500">Open</span></span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button className={button} onClick={() => setDrawing((d) => !d)} disabled={Boolean(reading)}>
          Draw a page
        </button>
        <button className={button} onClick={() => fileRef.current?.click()} disabled={Boolean(reading)}>
          Open a page
        </button>
        <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
        <button className={button} onClick={() => addBubble("speech")}>Speech</button>
        <button className={button} onClick={() => addBubble("caption")}>Caption</button>
        <button className={button} onClick={() => addBubble("sfx")}>Sound effect</button>
        <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
        <button className={button} onClick={undo} disabled={!past.length}>Undo</button>
        <button className={button} onClick={redo} disabled={!future.length}>Redo</button>
        <button className={button} onClick={() => selection && remove(selection)} disabled={!selection}>Delete</button>
        <button className={button} onClick={() => void readLettering()} disabled={!page.art || !page.bubbles.length || Boolean(reading)}>
          Read lettering
        </button>
        <select
          className={button}
          value=""
          disabled={!page.bubbles.some((b) => b.text) || Boolean(reading)}
          onChange={(e) => e.target.value && void translate(e.target.value)}
        >
          <option value="">Translate to...</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <span className="flex-1" />
        {reading && <span className="text-sm text-neutral-500">{reading}</span>}
        {problem && <span className="text-sm text-red-600 dark:text-red-400">{problem}</span>}
        <button className={button} onClick={exportPng}>Export PNG</button>
        {drawing && (
          <DrawPage
            busy={Boolean(reading)}
            onDraw={(idea, panels, style) => void drawNewPage(idea, panels, style)}
            onClose={() => setDrawing(false)}
            continuing={
              doc.story && doc.pages.some((p) => p.art)
                ? { title: doc.story.title, cast: doc.story.cast }
                : undefined
            }
          />
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">{loaded ? <Canvas stageRef={stageRef} /> : null}</div>
          {doc.pages.length > 0 && (
            <PageStrip
              count={doc.pages.length}
              current={pageIndex}
              busy={Boolean(reading)}
              onGo={goToPage}
              onAdd={() => setDrawing(true)}
              onRemove={removePage}
            />
          )}
        </main>
        <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="p-3 text-xs text-neutral-500">
            Click a panel or a bubble to select it. Drag to move. Cmd+Z undoes.
          </div>
          <Inspector />
          {selection?.kind === "panel" && <PanelInspector busy={Boolean(reading)} onRedraw={(p) => void redraw(p)} />}
          <div className="mt-auto border-t border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-800">
            Want the whole comic drawn for you, with your characters kept
            consistent across pages?{" "}
            <a
              href="https://panellr.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
            >
              Paneller
            </a>{" "}
            does that. This editor is its open core.
          </div>
        </aside>
      </div>
    </div>
  );
}
