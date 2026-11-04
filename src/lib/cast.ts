"use client";

// Bringing your own characters.
//
// Uploads are laid out side by side on one sheet rather than kept as separate
// pictures, because that is what the drawing wants: an image model handed more
// reference pictures does worse, not better, so six characters on one sheet
// cost what one does where six attachments would not. Everything after this
// treats a sheet you supplied exactly like a sheet it drew.

const GAP = 48;
const HEIGHT = 1024;
const PAPER = "#f6f3ec";

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not an image."));
    img.src = src;
  });

const read = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

/** One file, as a data URL, for showing back to whoever picked it. */
export const asDataUrl = (file: File) => read(file);

/**
 * Lays pictures of characters in a row on a plain background, each scaled to
 * the same height so no one of them dominates the sheet.
 */
export async function castSheetFrom(sources: string[]): Promise<string | undefined> {
  if (!sources.length || typeof document === "undefined") return undefined;
  const images = await Promise.all(sources.map(load)).catch(() => undefined);
  if (!images?.length) return undefined;

  const widths = images.map((img) => Math.round((img.naturalWidth / img.naturalHeight) * HEIGHT));
  const canvas = document.createElement("canvas");
  canvas.width = widths.reduce((a, b) => a + b, 0) + GAP * (images.length + 1);
  canvas.height = HEIGHT + GAP * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = GAP;
  images.forEach((img, i) => {
    ctx.drawImage(img, x, GAP, widths[i], HEIGHT);
    x += widths[i] + GAP;
  });

  // Ask for WebP, but check: a browser that cannot encode it hands back a PNG
  // without saying so, and then the picture and its label disagree. JPEG is
  // the fallback because every browser can write it.
  const webp = canvas.toDataURL("image/webp", 0.92);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.92);
}
