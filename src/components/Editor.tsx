"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type Konva from "konva";
import { useEditor } from "@/lib/store";

// Konva draws to a canvas and needs a window, so it must not be prerendered.
const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-neutral-500">Preparing the page...</div>,
});

const button =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700";

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

export default function Editor() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const { addBubble, undo, redo, remove, selection, past, future, restore, loaded, doc } = useEditor();

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

  const exportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const page = doc.pages[0];
    const url = stage.toDataURL({ pixelRatio: page.width / stage.width() });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/\W+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="mr-2 font-semibold tracking-tight">Paneller <span className="font-normal text-neutral-500">Open</span></span>
        <button className={button} onClick={() => addBubble("speech")}>Speech</button>
        <button className={button} onClick={() => addBubble("caption")}>Caption</button>
        <button className={button} onClick={() => addBubble("sfx")}>Sound effect</button>
        <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
        <button className={button} onClick={undo} disabled={!past.length}>Undo</button>
        <button className={button} onClick={redo} disabled={!future.length}>Redo</button>
        <button className={button} onClick={() => selection && remove(selection)} disabled={!selection}>Delete</button>
        <span className="flex-1" />
        <button className={button} onClick={exportPng}>Export PNG</button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">{loaded ? <Canvas stageRef={stageRef} /> : null}</main>
        <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="p-3 text-xs text-neutral-500">
            Click a panel or a bubble to select it. Drag to move. Cmd+Z undoes.
          </div>
          <Inspector />
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
