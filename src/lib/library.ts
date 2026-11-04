"use client";

// Where comics are kept.
//
// Everything lives in this browser: a short index of what exists, and each
// comic under its own key. The index is kept small on purpose - a title, a
// count, a date and a thumbnail - so that listing the shelf does not mean
// loading every page of every comic.

import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import type { ComicSummary, Doc } from "./doc";

const INDEX = "paneller-open.index";
const comicKey = (id: string) => `paneller-open.comic.${id}`;

/** A small picture of a page, for the library list. */
export async function thumbnail(art: string | undefined, width = 220): Promise<string | undefined> {
  if (!art || typeof document === "undefined") return undefined;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("no"));
      el.src = art;
    });
    const scale = width / img.naturalWidth;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return undefined;
  }
}

/**
 * Comics used to be kept one at a time under a single key. Anyone who made one
 * before the shelf existed should still find it there, so the old key is read
 * once, written in as a comic, and cleared.
 */
export async function adoptLegacy(): Promise<void> {
  const LEGACY = "paneller-open.doc";
  const old = await idbGet<Doc>(LEGACY).catch(() => undefined);
  if (!old?.pages?.length) return;
  const id = old.id ?? `comic_legacy`;
  const cover = await thumbnail(old.pages[0]?.art ?? old.pages[0]?.panels.find((p) => p.art)?.art?.src);
  await writeComic({ ...old, id, title: old.story?.title ?? old.title ?? "Untitled comic" }, cover);
  await idbDel(LEGACY);
}

export const readIndex = async (): Promise<ComicSummary[]> =>
  (await idbGet<ComicSummary[]>(INDEX).catch(() => undefined)) ?? [];

export const readComic = async (id: string): Promise<Doc | undefined> =>
  await idbGet<Doc>(comicKey(id)).catch(() => undefined);

/** Writes the comic and brings its entry in the index up to date. */
export async function writeComic(doc: Doc, cover?: string): Promise<ComicSummary[]> {
  const index = await readIndex();
  const was = index.find((c) => c.id === doc.id);
  const entry: ComicSummary = {
    id: doc.id,
    title: doc.story?.title ?? doc.title,
    pages: doc.pages.length,
    updatedAt: Date.now(),
    cover: cover ?? was?.cover,
  };
  const next = [entry, ...index.filter((c) => c.id !== doc.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  await Promise.all([idbSet(comicKey(doc.id), doc), idbSet(INDEX, next)]);
  return next;
}

export async function deleteComic(id: string): Promise<ComicSummary[]> {
  const next = (await readIndex()).filter((c) => c.id !== id);
  await Promise.all([idbDel(comicKey(id)), idbSet(INDEX, next)]);
  return next;
}
