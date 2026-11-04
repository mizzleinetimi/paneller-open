import "server-only";

// Drawing and redrawing a single panel.
//
// Redrawing works on the panel alone: we cut its box out of the page, hand that
// to Muse Image with the instruction, and paste what comes back into the same
// hole. The rest of the page is never sent and so cannot drift, which is the
// whole point of editing a panel rather than regenerating a page.

import sharp from "sharp";
import { type Panel, bounds } from "./doc";
import { editImage, generateImage } from "./meta/client";

const dataUrl = (b64: string) => `data:image/webp;base64,${b64}`;
const toBuffer = (image: string) => Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64");

/** Nearest ratio Muse accepts, so a panel comes back the shape it went in. */
function sizeFor(width: number, height: number): string {
  const ratio = width / height;
  const options: [string, number][] = [
    ["1024x1536", 2 / 3],
    ["1024x1024", 1],
    ["1536x1024", 3 / 2],
  ];
  return options.reduce((best, o) => (Math.abs(o[1] - ratio) < Math.abs(best[1] - ratio) ? o : best))[0];
}

/** Draws art for one panel from a prompt alone, for a page that has none yet. */
export async function drawPanel(prompt: string, width: number, height: number): Promise<string> {
  const [b64] = await generateImage({
    prompt: `A single comic book panel, no border, no speech bubbles, no lettering. ${prompt}`,
    size: sizeFor(width, height),
  });
  return dataUrl(b64);
}

/** Redraws one panel in place and returns the whole page with it replaced. */
export async function redrawPanel(pageImage: string, panel: Panel, prompt: string): Promise<string> {
  const page = toBuffer(pageImage);
  const box = bounds(panel.shape);
  const meta = await sharp(page).metadata();
  const left = Math.max(0, Math.round(box.x));
  const top = Math.max(0, Math.round(box.y));
  const width = Math.min(Math.round(box.width), (meta.width ?? 0) - left);
  const height = Math.min(Math.round(box.height), (meta.height ?? 0) - top);

  const crop = await sharp(page).extract({ left, top, width, height }).webp().toBuffer();
  const [b64] = await editImage({
    prompt: `Redraw this comic panel. Keep the same art style, line weight and colouring, and keep any speech bubbles exactly where they are. ${prompt}`,
    images: [{ bytes: crop, name: "panel.webp", type: "image/webp" }],
    size: sizeFor(width, height),
  });

  // Muse returns a ratio rather than exact pixels, so fit it back to the hole.
  const redrawn = await sharp(toBuffer(dataUrl(b64))).resize(width, height, { fit: "fill" }).toBuffer();
  const composed = await sharp(page)
    .composite([{ input: redrawn, left, top }])
    .webp()
    .toBuffer();
  return dataUrl(composed.toString("base64"));
}
