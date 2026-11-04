"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { CONTINUE_STAGES, MAKE_STAGES, Pipeline, type Stage } from "./Pipeline";
import { bounds as boundsOf } from "@/lib/doc";
import { useEditor } from "@/lib/store";

// Konva draws to a canvas and needs a window, so it must not be prerendered.
const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-faint">Preparing the page...</div>,
});

const LANGUAGES = ["Yoruba", "Spanish", "Japanese", "French", "Arabic", "Hindi", "Portuguese"];
const STYLE_NAMES = ["classic", "manga", "noir", "soft"];

const Wordmark = () => (
  <span className="select-none text-[15px] font-semibold tracking-tight">
    Paneller <span className="hollow font-bold">Open</span>
  </span>
);

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-1.5">
    <span className="label mr-0.5 hidden lg:inline">{label}</span>
    {children}
  </div>
);

const Divider = () => <span className="mx-1 h-5 w-px bg-[var(--rule)]" />;

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

// ─── Panels on the right ─────────────────────────────────────

function BubbleInspector() {
  const { selection, doc, pageIndex, updateBubble } = useEditor();
  const page = doc.pages[pageIndex];
  if (selection?.kind !== "bubble") return null;
  const bubble = page.bubbles.find((b) => b.id === selection.id);
  if (!bubble) return null;

  return (
    <div className="flex flex-col gap-2.5 border-b border-[var(--rule)] p-4">
      <span className="label">{bubble.kind === "sfx" ? "Sound effect" : bubble.kind}</span>
      <textarea
        value={bubble.text}
        onChange={(e) => updateBubble(bubble.id, { text: e.target.value }, true)}
        onBlur={(e) => updateBubble(bubble.id, { text: e.target.value })}
        rows={3}
        className="field"
        placeholder="Say something."
      />
      <label className="text-[11px] text-ink-faint">
        Type size {bubble.fontSize}
        <input
          type="range"
          min={12}
          max={140}
          value={bubble.fontSize}
          onChange={(e) => updateBubble(bubble.id, { fontSize: Number(e.target.value) }, true)}
          onMouseUp={(e) => updateBubble(bubble.id, { fontSize: Number((e.target as HTMLInputElement).value) })}
          className="mt-1 w-full accent-[var(--accent)]"
        />
      </label>
      {bubble.kind === "speech" && (
        <p className="text-[11px] text-ink-faint">
          The balloon is as big as what it says. Drag the blue dot to aim its tail; the tail stays
          put when you move the balloon.
        </p>
      )}
    </div>
  );
}

function PanelInspector({ busy, onRedraw }: { busy: boolean; onRedraw: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="flex flex-col gap-2.5 border-b border-[var(--rule)] p-4">
      <span className="label">Redraw this panel</span>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="make it night, add a second danfo, move the camera closer..."
        className="field"
      />
      <button className="btn btn-key justify-center" onClick={() => prompt.trim() && onRedraw(prompt.trim())} disabled={busy || !prompt.trim()}>
        {busy ? "Drawing..." : "Redraw with Muse Image"}
      </button>
      <p className="text-[11px] text-ink-faint">
        Only this panel is sent, so the rest of the page cannot drift.
      </p>
    </div>
  );
}

/** With nothing selected, the sidebar shows what the comic is carrying. */
function StoryPanel() {
  const { doc } = useEditor();
  const story = doc.story;
  if (!story) return null;
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--rule)] p-4">
      <span className="label">The comic</span>
      <p className="text-sm font-medium leading-snug">{story.title}</p>
      <p className="text-[13px] leading-snug text-ink-soft">{story.setting}</p>
      {story.cast.length > 0 && (
        <>
          <span className="label mt-1">Cast carried between pages</span>
          <ul className="flex flex-col gap-1.5">
            {story.cast.map((c) => (
              <li key={c.look} className="text-[13px] leading-snug">
                <span className="text-ink">{c.who}</span>
                <span className="text-ink-faint"> — {c.look}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-faint">
            These words are used twice: later pages are drawn from them, and SAM 3.1 finds each
            person by them to aim their speech balloon.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Making a page ───────────────────────────────────────────

function DrawDialog({
  busy,
  continuing,
  onDraw,
  onClose,
}: {
  busy: boolean;
  continuing?: { title: string; cast: { who: string; look: string }[] };
  onDraw: (idea: string, panels: number, style: string) => void;
  onClose: () => void;
}) {
  const [idea, setIdea] = useState("");
  const [panels, setPanels] = useState(4);
  const [style, setStyle] = useState("classic");
  const go = () => idea.trim() && onDraw(idea.trim(), panels, style);

  return (
    <div className="absolute inset-x-0 top-full z-20 border-b border-[var(--rule)] bg-[var(--paper-raised)] px-4 py-4 shadow-sm">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <span className="label">
          {continuing ? `What happens next in "${continuing.title}"?` : "What happens on this page?"}
        </span>
        {continuing && continuing.cast.length > 0 && (
          <p className="-mt-1 text-[13px] text-ink-soft">
            Carrying on with {continuing.cast.map((c) => c.look).join(", ")}, drawn against the first
            page and the one before so they keep their faces.
          </p>
        )}
        <textarea
          autoFocus
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") go();
          }}
          rows={2}
          className="field"
          placeholder={
            continuing
              ? "the conductor finally gives him his change, and the bus pulls away"
              : "a danfo driver in Lagos traffic argues with a conductor, then spots his old teacher through the window"
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-ink-faint">
            Panels
            <select className="btn ml-1.5" value={panels} onChange={(e) => setPanels(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {!continuing && (
            <label className="text-[11px] text-ink-faint">
              Style
              <select className="btn ml-1.5" value={style} onChange={(e) => setStyle(e.target.value)}>
                {STYLE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <span className="flex-1" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-key" onClick={go} disabled={busy || !idea.trim()}>
            {continuing ? "Draw the next page" : "Draw the page"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Nothing made yet: the two ways in, and what each one is for. */
function Start({ onDraw, onOpen }: { onDraw: () => void; onOpen: () => void }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-[22px] font-semibold tracking-tight">A comic you can take apart.</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Pages are drawn with no lettering on them, and the words go on top as objects. Nothing is
          ever flattened: every panel can be redrawn and every line rewritten or translated.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button onClick={onDraw} className="dashed group rounded-md p-5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]">
            <span className="block text-sm font-medium">Draw a page from an idea</span>
            <span className="mt-1.5 block text-[13px] leading-snug text-ink-soft">
              Muse Spark plans the panels and writes the dialogue, Muse Image draws it, SAM 3.1 finds
              the panels. About a minute.
            </span>
          </button>
          <button onClick={onOpen} className="dashed group rounded-md p-5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]">
            <span className="block text-sm font-medium">Open a page you already have</span>
            <span className="mt-1.5 block text-[13px] leading-snug text-ink-soft">
              SAM 3.1 finds its panels and bubbles, Muse Spark reads the words out, and you can
              letter it again in another language.
            </span>
          </button>
        </div>
        <p className="mt-6 text-[11px] text-ink-faint">
          Everything stays in this browser. No account, no server, nothing uploaded but the page
          itself while a model is looking at it.
        </p>
      </div>
    </div>
  );
}

// ─── The editor ──────────────────────────────────────────────

export default function Editor() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ note: string; stages?: Stage[]; since: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  const {
    addBubble, undo, redo, remove, selection, past, future, restore, loaded, doc, openPage,
    pageIndex, startStory, appendPage, goToPage, removePage,
  } = useEditor();

  const page = doc.pages[pageIndex];
  const started = Boolean(doc.pages.some((p) => p.art));
  const carryOn = Boolean(doc.story && started);

  useEffect(() => { void restore(); }, [restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
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

  const call = async <T,>(note: string, url: string, body: unknown, stages?: Stage[]): Promise<T | undefined> => {
    setProblem(null);
    setBusy({ note, stages, since: Date.now() });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That did not work.");
      return json as T;
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That did not work.");
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    try {
      const { src, width, height } = await readImage(file);
      const found = await call<{ panels: typeof page.panels; bubbles: typeof page.bubbles; counts: Record<string, number> }>(
        "Reading the page",
        "/api/detect",
        { image: src },
        [
          { label: "Finding the panels", by: "SAM 3.1", seconds: 9 },
          { label: "Finding speech bubbles, captions and sound effects", by: "SAM 3.1", seconds: 12 },
        ],
      );
      if (found) openPage(src, width, height, found);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not read that page.");
    }
  };

  const drawNewPage = async (idea: string, panels: number, style: string) => {
    setDrawing(false);
    const out = await call<{
      image: string;
      plan: NonNullable<typeof page.plan>;
      story?: NonNullable<typeof doc.story>;
      panels: typeof page.panels;
      bubbles: typeof page.bubbles;
    }>(
      carryOn ? "Drawing the next page" : "Making the page",
      "/api/page",
      carryOn
        ? {
            what: idea,
            panels,
            story: doc.story,
            soFar: doc.pages.map((p) => p.plan).filter(Boolean),
            reference: [doc.pages[0]?.art, doc.pages[doc.pages.length - 1]?.art]
              .filter((art, i, all): art is string => Boolean(art) && all.indexOf(art) === i),
          }
        : { idea, panels, style },
      carryOn ? CONTINUE_STAGES : MAKE_STAGES,
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
    };
    img.src = out.image;
  };

  const readLettering = async () => {
    const out = await call<{ bubbles: typeof page.bubbles }>(
      "Reading the lettering",
      "/api/read",
      { image: page.art, bubbles: page.bubbles },
      [{ label: "Reading the words in each bubble", by: "Muse Spark", seconds: 10 }],
    );
    if (out) useEditor.getState().setBubbles(out.bubbles);
  };

  const translate = async (language: string) => {
    const out = await call<{ bubbles: typeof page.bubbles }>(
      `Lettering in ${language}`,
      "/api/translate",
      { bubbles: page.bubbles, language },
      [{ label: `Translating each line to fit its bubble`, by: "Muse Spark", seconds: 12 }],
    );
    if (out) useEditor.getState().setBubbles(out.bubbles);
  };

  const redraw = async (prompt: string) => {
    if (selection?.kind !== "panel") return;
    const panel = page.panels.find((p) => p.id === selection.id);
    if (!panel) return;
    const out = await call<{ page?: string; art?: string }>(
      "Redrawing the panel",
      "/api/redraw",
      { image: page.art, panel, prompt },
      [{ label: "Redrawing this panel alone", by: "Muse Image", seconds: 35 }],
    );
    if (out?.page) useEditor.getState().setPageArt(out.page);
    else if (out?.art) useEditor.getState().updatePanel(panel.id, { art: { src: out.art, ...boundsOf(panel.shape) } });
  };

  const exportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const url = stage.toDataURL({ pixelRatio: page.width / stage.width() });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.story?.title ?? doc.title).replace(/\W+/g, "-").toLowerCase()}-${pageIndex + 1}.png`;
    a.click();
  };

  const working = Boolean(busy);

  return (
    <div className="flex h-dvh flex-col bg-[var(--paper)] text-ink">
      <header className="relative flex flex-wrap items-center gap-2 border-b border-[var(--rule)] bg-[var(--paper-raised)] px-4 py-2">
        <Wordmark />
        <Divider />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Group label="Make">
          <button className="btn btn-key" onClick={() => setDrawing((d) => !d)} disabled={working}>
            {carryOn ? "Next page" : "Draw a page"}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={working}>Open a page</button>
        </Group>

        {started && (
          <>
            <Divider />
            <Group label="Letter">
              <button className="btn" onClick={() => addBubble("speech")} disabled={working}>Speech</button>
              <button className="btn" onClick={() => addBubble("caption")} disabled={working}>Caption</button>
              <button className="btn" onClick={() => addBubble("sfx")} disabled={working}>Sound</button>
              <button className="btn" onClick={() => void readLettering()} disabled={!page.art || !page.bubbles.length || working}>
                Read lettering
              </button>
              <select
                className="btn"
                value=""
                disabled={!page.bubbles.some((b) => b.text) || working}
                onChange={(e) => e.target.value && void translate(e.target.value)}
              >
                <option value="">Translate...</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Group>

            <Divider />
            <Group label="Edit">
              <button className="btn" onClick={undo} disabled={!past.length || working}>Undo</button>
              <button className="btn" onClick={redo} disabled={!future.length || working}>Redo</button>
              <button className="btn" onClick={() => selection && remove(selection)} disabled={!selection || working}>Delete</button>
            </Group>
          </>
        )}

        <span className="flex-1" />
        {problem && <span className="max-w-xs truncate text-[13px] text-[var(--warn)]" title={problem}>{problem}</span>}
        {started && <button className="btn" onClick={exportPng} disabled={working}>Export PNG</button>}

        {drawing && (
          <DrawDialog
            busy={working}
            onDraw={(idea, panels, style) => void drawNewPage(idea, panels, style)}
            onClose={() => setDrawing(false)}
            continuing={carryOn && doc.story ? { title: doc.story.title, cast: doc.story.cast } : undefined}
          />
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--paper-sunk)]">
          {!loaded ? null : started ? <div className="min-h-0 flex-1"><Canvas stageRef={stageRef} /></div> : (
            <Start onDraw={() => setDrawing(true)} onOpen={() => fileRef.current?.click()} />
          )}

          {started && (
            <div className="flex items-center gap-1.5 border-t border-[var(--rule)] bg-[var(--paper-raised)] px-4 py-2">
              <span className="label mr-1 hidden sm:inline">Pages</span>
              {doc.pages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => goToPage(i)}
                  className={`h-7 w-7 rounded border text-xs ${
                    i === pageIndex
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--rule-strong)] text-ink-soft hover:bg-[var(--paper-sunk)]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              {carryOn && (
                <button className="btn ml-1" onClick={() => setDrawing(true)} disabled={working}>+ Page</button>
              )}
              <span className="flex-1" />
              {doc.pages.length > 1 && (
                <button className="btn" onClick={() => removePage(pageIndex)} disabled={working}>
                  Remove page {pageIndex + 1}
                </button>
              )}
            </div>
          )}

          {busy && (
            <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--paper)]/92 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-5 px-8">
                <span className="label">{busy.note}</span>
                {busy.stages ? (
                  <Pipeline stages={busy.stages} startedAt={busy.since} />
                ) : (
                  <span className="text-sm text-ink-soft">Working...</span>
                )}
              </div>
            </div>
          )}
        </main>

        {started && (
        <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-[var(--rule)] bg-[var(--paper-raised)] xl:w-80">
          {selection?.kind === "bubble" && <BubbleInspector />}
          {selection?.kind === "panel" && <PanelInspector busy={working} onRedraw={(p) => void redraw(p)} />}
          {!selection && <StoryPanel />}
          {!selection && (
            <div className="p-4 text-[13px] leading-snug text-ink-soft">
              Click a panel to redraw it, or a bubble to change what it says. Drag to move. Cmd+Z
              undoes.
            </div>
          )}
          <div className="mt-auto border-t border-[var(--rule)] p-4 text-[12px] leading-snug text-ink-faint">
            This is the open core of{" "}
            <a href="https://panellr.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] underline underline-offset-2">
              Paneller
            </a>
            , which draws whole comics with your characters kept consistent across pages.
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
