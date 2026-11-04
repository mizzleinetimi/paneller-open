"use client";

import { useEffect, useState } from "react";

/**
 * What is happening while a page is made.
 *
 * Drawing a page takes about a minute, and three different models do the work
 * in turn. Showing a spinner for that minute hides the most interesting thing
 * about the program, so the stages are named and the current one marked.
 *
 * The timings are measured averages, not progress reported by the server: the
 * page is one request and the stages are not observable from here. So the
 * wording never claims a stage has finished - it says what is being worked on,
 * and says plainly that it is an estimate.
 */
export type Stage = { label: string; by: string; seconds: number };

export const MAKE_STAGES: Stage[] = [
  { label: "Planning the cast, the place and the panels", by: "Muse Spark", seconds: 16 },
  { label: "Drawing the cast once, to hold every page against", by: "Muse Image", seconds: 26 },
  { label: "Drawing the art, with no lettering on it", by: "Muse Image", seconds: 32 },
  { label: "Finding the panels", by: "SAM 3.1", seconds: 20 },
  { label: "Laying the lettering over it", by: "SAM 3.1", seconds: 8 },
];

export const CONTINUE_STAGES: Stage[] = [
  { label: "Planning the next page from the story so far", by: "Muse Spark", seconds: 18 },
  { label: "Drawing it against the cast sheet and the page before", by: "Muse Image", seconds: 44 },
  { label: "Finding the panels", by: "SAM 3.1", seconds: 20 },
  { label: "Laying the lettering over it", by: "SAM 3.1", seconds: 8 },
];

/** With characters brought along, there is nothing to invent and nothing to draw. */
export const OWN_CAST_STAGES: Stage[] = [
  { label: "Reading the characters you brought", by: "Muse Spark", seconds: 10 },
  { label: "Writing a story about them", by: "Muse Spark", seconds: 18 },
  { label: "Drawing the art, with no lettering on it", by: "Muse Image", seconds: 32 },
  { label: "Finding the panels", by: "SAM 3.1", seconds: 20 },
  { label: "Laying the lettering over it", by: "SAM 3.1", seconds: 8 },
];

export function Pipeline({ stages, startedAt }: { stages: Stage[]; startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(tick);
  }, [startedAt]);

  let running = 0;
  const marks = stages.map((s) => (running += s.seconds));
  const current = Math.min(marks.findIndex((m) => elapsed < m), stages.length - 1);
  const at = current === -1 ? stages.length - 1 : current;
  const total = marks[marks.length - 1];

  return (
    <div className="w-full max-w-md">
      <ol className="flex flex-col gap-2.5">
        {stages.map((stage, i) => {
          const done = i < at;
          const now = i === at;
          return (
            <li key={stage.label} className="flex items-start gap-3">
              <span
                className={`mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--line)] ${
                  now ? "animate-pulse bg-[var(--accent)]" : done ? "bg-[var(--ink)]" : "bg-transparent"
                }`}
              />
              <span className="min-w-0">
                <span className={`block text-sm ${now ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint"}`}>
                  {stage.label}
                </span>
                <span className="block text-[11px] text-ink-faint">{stage.by}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[11px] text-ink-faint">
        {Math.round(elapsed)}s of roughly {total}s. The stages are timed estimates, not progress
        reported back from the models.
      </p>
    </div>
  );
}
