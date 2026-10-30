import "server-only";

// Reading a comic page back into its parts.
//
// SAM takes one noun phrase per request, so a page is three requests, run at
// once. Which phrase you use decides whether anything comes back at all; the
// ones below were measured, and docs/CONCEPTS.md records what else was tried.

import { decodeMaskToSVGPath } from "@meta-sam/parser";
import sharp from "sharp";
import { type Bubble, type BubbleKind, type Panel, type Point, newId, rectShape } from "./doc";
import { boxesOf, masksOf, segment } from "./meta/sam";
import { maskToPolygon, snapToBox } from "./trace";

export const CONCEPTS = {
  panel: "comic panel",
  speech: "speech bubble",
  sfx: "comic sound effect lettering",
} as const;

export type Detected = { panels: Panel[]; bubbles: Bubble[]; counts: Record<string, number> };

/** Panels in reading order: down the page in bands, left to right inside each. */
function readingOrder(panels: Panel[], shapes: Map<string, { top: number; left: number; height: number }>): Panel[] {
  const rows: Panel[][] = [];
  for (const panel of [...panels].sort((a, b) => shapes.get(a.id)!.top - shapes.get(b.id)!.top)) {
    const box = shapes.get(panel.id)!;
    const row = rows.at(-1);
    const rowTop = row ? shapes.get(row[0].id)!.top : 0;
    const rowHeight = row ? shapes.get(row[0].id)!.height : 0;
    // Same band if it starts before the previous row is half over.
    if (row && box.top < rowTop + rowHeight * 0.5) row.push(panel);
    else rows.push([panel]);
  }
  return rows.flatMap((row) => row.sort((a, b) => shapes.get(a.id)!.left - shapes.get(b.id)!.left));
}

async function shapesFor(image: string, concept: string) {
  const result = await segment({ image, concept, confidence: true });
  const masks = masksOf(result);
  const boxes = boxesOf(result);
  // A mask carries its own box; fall back to the box record when one is missing.
  return masks.length
    ? masks.map((m) => ({
        polygon: snapToBox(maskToPolygon(decodeMaskToSVGPath(m.mask), m.bounds, m.mask)),
        box: m.bounds,
        confidence: m.confidence,
      }))
    : boxes.map((b) => ({
        polygon: rectShape(b.left, b.top, b.right - b.left, b.bottom - b.top),
        box: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
        confidence: b.confidence,
      }));
}

type Box = { left: number; top: number; right: number; bottom: number };

/** Intersection over union: 0 for separate boxes, 1 for identical ones. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  const both = w * h;
  const area = (x: Box) => (x.right - x.left) * (x.bottom - x.top);
  return both / (area(a) + area(b) - both);
}

const bubbleFrom = (kind: BubbleKind, box: Box, clear?: string): Bubble => ({
  id: newId("bubble"),
  kind,
  x: box.left,
  y: box.top,
  width: box.right - box.left,
  height: box.bottom - box.top,
  text: "",
  fontSize: kind === "sfx" ? Math.round((box.bottom - box.top) * 0.6) : 28,
  ...(clear ? { clear } : {}),
});

/**
 * The page colour just outside a box. Sound effects sit on bare art with
 * nothing to hide the old lettering behind, so re-lettering paints this first.
 * A thin ring outside the box is sampled, well away from the letters.
 */
async function colourAround(page: Buffer, box: Box, size: { width: number; height: number }): Promise<string | undefined> {
  const pad = 10;
  const left = Math.max(0, Math.round(box.left) - pad);
  const top = Math.max(0, Math.round(box.top) - pad);
  const width = Math.min(Math.round(box.right - box.left) + pad * 2, size.width - left);
  const height = Math.min(Math.round(box.bottom - box.top) + pad * 2, size.height - top);
  if (width < 4 || height < 4) return undefined;
  try {
    // One pixel row from just above the box: outside the lettering, on the art.
    const strip = await sharp(page).extract({ left, top, width, height: 3 }).stats();
    const [r, g, b] = strip.channels.slice(0, 3).map((c) => Math.round(c.mean));
    return `rgb(${r},${g},${b})`;
  } catch {
    return undefined;
  }
}

/** Reads one page. `image` is a data: URL or a public URL. */
export async function detectPage(image: string): Promise<Detected> {
  const pageBytes = image.startsWith("data:")
    ? Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64")
    : undefined;
  const size = pageBytes ? await sharp(pageBytes).metadata() : undefined;
  const [panelShapes, speech, sfx] = await Promise.all([
    shapesFor(image, CONCEPTS.panel),
    shapesFor(image, CONCEPTS.speech),
    shapesFor(image, CONCEPTS.sfx),
  ]);

  const panels: Panel[] = panelShapes.map((s) => ({ id: newId("panel"), shape: s.polygon as Point[] }));
  const boxes = new Map(
    panels.map((p, i) => [
      p.id,
      {
        top: panelShapes[i].box.top,
        left: panelShapes[i].box.left,
        height: panelShapes[i].box.bottom - panelShapes[i].box.top,
      },
    ]),
  );

  // "comic sound effect lettering" also matches speech bubbles: on the test page
  // all three of its hits included both bubbles, boxes identical to the speech
  // ones. Speech is the surer reading (0.96 against 0.75-0.91), so where the two
  // land on the same thing, the sound effect goes.
  const keptSfx = sfx.filter((s) => !speech.some((sp) => overlap(s.box, sp.box) > 0.5));

  // Only sound effects need a patch; a bubble's own white covers its words.
  const clears =
    pageBytes && size?.width && size.height
      ? await Promise.all(
          keptSfx.map((s) => colourAround(pageBytes, s.box, { width: size.width!, height: size.height! })),
        )
      : keptSfx.map(() => undefined);

  return {
    panels: readingOrder(panels, boxes),
    bubbles: [
      ...speech.map((s) => bubbleFrom("speech", s.box)),
      ...keptSfx.map((s, i) => bubbleFrom("sfx", s.box, clears[i])),
    ],
    counts: {
      panels: panelShapes.length,
      speech: speech.length,
      sfx: keptSfx.length,
      sfxDropped: sfx.length - keptSfx.length,
    },
  };
}
