// Squaring up what the detection found.
//
// SAM returns the panel it can see, which is the art inside the border rather
// than the border itself, and it returns each one on its own. So a page of
// four panels comes back with four left edges a few pixels apart and every
// frame a little smaller than it was drawn. Cut on those boxes and the page
// loses its rules and stops lining up.
//
// Two passes fix most of it: grow each panel back over its own border, then
// agree the edges that were meant to be the same.

import { type Panel, bounds, rectShape } from "./doc";

type Box = { x: number; y: number; width: number; height: number };

/** Edges within this much of each other were meant to be one edge. */
const SAME = 0.018;
/** How far to grow a panel back over the ink of its own border. */
const GROW = 0.004;

/** Replaces each cluster of near-equal values with one value. */
function agree(values: number[], tolerance: number): Map<number, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const settled = new Map<number, number>();
  let group: number[] = [];
  const close = () => {
    if (!group.length) return;
    const mean = group.reduce((a, b) => a + b, 0) / group.length;
    for (const v of group) settled.set(v, mean);
    group = [];
  };
  for (const v of sorted) {
    if (group.length && v - group[group.length - 1] > tolerance) close();
    group.push(v);
  }
  close();
  return settled;
}

/**
 * Grows panels back over their borders and lines up the edges that belong
 * together, without letting any of them leave the page.
 */
export function tidyPanels(panels: Panel[], pageWidth: number, pageHeight: number): Panel[] {
  if (panels.length < 2) return panels;
  const grow = Math.round(Math.min(pageWidth, pageHeight) * GROW);
  const tolerance = Math.min(pageWidth, pageHeight) * SAME;

  const boxes: Box[] = panels.map((p) => {
    const b = bounds(p.shape);
    const x = Math.max(0, b.x - grow);
    const y = Math.max(0, b.y - grow);
    return {
      x,
      y,
      width: Math.min(b.width + grow * 2, pageWidth - x),
      height: Math.min(b.height + grow * 2, pageHeight - y),
    };
  });

  const lefts = agree(boxes.map((b) => b.x), tolerance);
  const rights = agree(boxes.map((b) => b.x + b.width), tolerance);
  const tops = agree(boxes.map((b) => b.y), tolerance);
  const bottoms = agree(boxes.map((b) => b.y + b.height), tolerance);

  return panels.map((panel, i) => {
    const b = boxes[i];
    const left = Math.max(0, Math.round(lefts.get(b.x) ?? b.x));
    const top = Math.max(0, Math.round(tops.get(b.y) ?? b.y));
    const right = Math.min(pageWidth, Math.round(rights.get(b.x + b.width) ?? b.x + b.width));
    const bottom = Math.min(pageHeight, Math.round(bottoms.get(b.y + b.height) ?? b.y + b.height));
    const box = { x: left, y: top, width: Math.max(8, right - left), height: Math.max(8, bottom - top) };
    // Panels are rectangles once squared up; an irregular one keeps its shape.
    const squared = panel.shape.length <= 4;
    return {
      ...panel,
      shape: squared ? rectShape(box.x, box.y, box.width, box.height) : panel.shape,
      from: box,
    };
  });
}
