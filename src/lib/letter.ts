import "server-only";

// Putting the lettering on a page we drew.
//
// The art is drawn clean - no balloons, no words - and the lettering is laid
// over it as objects. That is the whole difference between a comic you can
// edit and a picture of one: the words were never pixels, so changing them,
// resizing them or saying them in another language is just changing them.
//
// Placing them well needs to know where people are, which is one segmentation
// call for the page: a balloon goes in the clear space above a speaker, on the
// opposite side from their face, with its tail aimed at their head.

import { measure } from "./bubble";
import { type Bubble, type Panel, type Point, bounds, newId } from "./doc";
import type { PagePlan } from "./compose";
import { boxesOf, segment } from "./meta/sam";

type Box = { left: number; top: number; right: number; bottom: number };

const centre = (b: Box): Point => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });
const inside = (p: Point, b: Box) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;

/** Whatever SAM can find for one description, as boxes. Never throws. */
async function find(image: string, concept: string): Promise<Box[]> {
  try {
    const result = await segment({ image, concept, confidence: true });
    return boxesOf(result).map((b) => ({ left: b.left, top: b.top, right: b.right, bottom: b.bottom }));
  } catch {
    return []; // Lettering still lands, just centred rather than aimed.
  }
}

/** The biggest of these standing inside this panel, if any. */
function inPanel(panel: Box, people: Box[]): Box | undefined {
  const area = (b: Box) => (b.right - b.left) * (b.bottom - b.top);
  return people.filter((p) => inside(centre(p), panel)).sort((a, b) => area(b) - area(a))[0];
}

/** A size that suits the panel: big enough to read, never wider than a third. */
function sizeFor(text: string, kind: "speech" | "caption" | "sfx", panel: Box): number {
  const width = panel.right - panel.left;
  if (kind === "sfx") return Math.round(width * 0.17);
  const base = Math.round(width * 0.052);
  // Long lines need smaller type or the balloon eats the panel.
  const shrink = text.length > 60 ? 0.78 : text.length > 32 ? 0.88 : 1;
  return Math.max(13, Math.round(base * shrink));
}

export function letterPanel(panel: Panel, said: PagePlan["panels"][number], speaker: Box | undefined): Bubble[] {
  const box = bounds(panel.shape);
  const b: Box = { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
  const pad = Math.min(box.width, box.height) * 0.06;
  const out: Bubble[] = [];

  if (said.caption?.trim()) {
    const fontSize = sizeFor(said.caption, "caption", b);
    const m = measure(said.caption, "caption", fontSize);
    out.push({
      id: newId("bubble"),
      kind: "caption",
      x: b.left + pad + m.width / 2,
      y: b.top + pad + m.height / 2,
      text: said.caption.trim(),
      fontSize,
    });
  }

  if (said.speech?.trim()) {
    const fontSize = sizeFor(said.speech, "speech", b);
    const m = measure(said.speech, "speech", fontSize);
    // Opposite side from the speaker's face, so the balloon does not cover it.
    const speakerX = speaker ? centre(speaker).x : (b.left + b.right) / 2;
    const leftish = speakerX > (b.left + b.right) / 2;
    const x = leftish
      ? Math.max(b.left + pad + m.width / 2, b.left + box.width * 0.3)
      : Math.min(b.right - pad - m.width / 2, b.right - box.width * 0.3);
    const y = b.top + pad + m.height / 2 + (said.caption ? box.height * 0.14 : 0);
    const head: Point = speaker
      ? { x: centre(speaker).x, y: speaker.top + (speaker.bottom - speaker.top) * 0.12 }
      : { x: (b.left + b.right) / 2, y: b.bottom - box.height * 0.25 };
    out.push({
      id: newId("bubble"),
      kind: "speech",
      x,
      y,
      text: said.speech.trim(),
      fontSize,
      tail: head,
    });
  }

  if (said.sfx?.trim()) {
    const fontSize = sizeFor(said.sfx, "sfx", b);
    const m = measure(said.sfx, "sfx", fontSize);
    out.push({
      id: newId("bubble"),
      kind: "sfx",
      x: (b.left + b.right) / 2,
      y: b.bottom - pad - m.height / 2,
      text: said.sfx.trim(),
      fontSize,
    });
  }

  return out;
}

/**
 * Letters a drawn page from its plan. Panels must be in reading order.
 *
 * The plan says who speaks and what they look like, so each description is
 * looked for by name - "woman in a yellow headwrap" - rather than settling for
 * whoever is biggest in the panel, which aims the tail at the listener as
 * often as the speaker when two people are talking. One call per distinct
 * description, not per panel, since a character usually speaks more than once.
 * Anyone not found falls back to the biggest person there.
 */
export async function letterPage(image: string, panels: Panel[], plan: PagePlan): Promise<Bubble[]> {
  const described = [...new Set(plan.panels.map((p) => p.speaker?.trim()).filter((s): s is string => Boolean(s)))];

  const [people, ...found] = await Promise.all([
    find(image, "person"),
    ...described.map((concept) => find(image, concept)),
  ]);
  const byDescription = new Map(described.map((d, i) => [d, found[i]]));

  return panels.flatMap((panel, i) => {
    const said = plan.panels[i];
    if (!said) return [];
    const box = bounds(panel.shape);
    const area: Box = { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
    const named = said.speaker ? byDescription.get(said.speaker.trim()) : undefined;
    const speaker = (named && inPanel(area, named)) ?? inPanel(area, people);
    return letterPanel(panel, said, speaker);
  });
}
