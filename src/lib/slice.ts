"use client";

// Cutting a drawn page into panels you can actually move.
//
// A page arrives as one flat picture with panels found on it, which is fine to
// look at and useless to edit: dragging a panel would move its frame and leave
// its art behind. So each panel is cut out and given the piece it covers, and
// the page beneath becomes bare paper. After that a panel is a thing with art
// in it - move it, resize it, swap two of them, throw one away - and the
// gutters are gutters rather than the parts of the picture nobody claimed.

import { type Page, type Panel, bounds } from "./doc";

/** Cuts one rectangle out of a loaded image. */
function cut(img: HTMLImageElement, box: { x: number; y: number; width: number; height: number }): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width));
  canvas.height = Math.max(1, Math.round(box.height));
  canvas
    .getContext("2d")
    ?.drawImage(img, Math.round(box.x), Math.round(box.y), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.92);
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the page image."));
    img.src = src;
  });

/**
 * Gives every panel the art it covers and clears the page behind them.
 * A page with no art, or panels that already own theirs, is left alone.
 */
export async function sliceIntoPanels(page: Page): Promise<Page> {
  if (!page.art || !page.panels.length || page.panels.every((p) => p.art)) return page;
  let img: HTMLImageElement;
  try {
    img = await load(page.art);
  } catch {
    return page; // Better a flat page than no page.
  }

  const panels: Panel[] = page.panels.map((panel) => {
    if (panel.art) return panel;
    const box = bounds(panel.shape);
    return { ...panel, art: { src: cut(img, box) } };
  });

  // Lettering made before bubbles belonged to panels is matched to whichever
  // panel it sits inside, so it travels with that panel from now on.
  const bubbles = page.bubbles.map((b) => {
    if (b.panelId) return b;
    const owner = panels.find((panel) => {
      const box = bounds(panel.shape);
      return b.x >= box.x && b.x <= box.x + box.width && b.y >= box.y && b.y <= box.y + box.height;
    });
    return owner ? { ...b, panelId: owner.id } : b;
  });

  // The gutters keep the page's own colour, as they do in print.
  return { ...page, panels, bubbles, art: undefined };
}
