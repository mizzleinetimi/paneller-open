import "server-only";

// Lettering a page in another language.
//
// The hard part is not the translation, it is the fit. A bubble is a fixed
// shape drawn around the sentence it already holds, and a faithful rendering
// that runs 40% longer breaks the page. Yoruba and German both do that. So each
// line is translated against a budget: roughly the room the original had.

import type { Bubble } from "./doc";
import { askJson } from "./meta/text";

/** Roughly how many characters fit, from the box and the type size. */
function budget(b: Bubble): number {
  const perLine = Math.max(6, Math.floor(b.width / (b.fontSize * 0.55)));
  const lines = Math.max(1, Math.floor(b.height / (b.fontSize * 1.25)));
  return perLine * lines;
}

export async function translateBubbles(bubbles: Bubble[], language: string): Promise<Bubble[]> {
  const lettered = bubbles.filter((b) => b.text.trim());
  if (!lettered.length) return bubbles;

  const items = lettered.map((b, i) => ({
    n: i + 1,
    kind: b.kind,
    text: b.text,
    fits: budget(b),
  }));

  const instruction = `Translate each line of comic lettering into ${language}.

Rules:
- Keep the voice and register. Comic dialogue is spoken, not formal.
- Each translation must fit the bubble it goes in. "fits" is roughly how many characters there is room for, newlines included. Going a little over is fine; going half as long again is not. Where a faithful rendering is too long, say the same thing in fewer words.
- Sound effects stay sound effects: render them the way that language writes noise, not as a dictionary definition.
- Keep line breaks where they help the shape.

Lines:
${JSON.stringify(items, null, 2)}

Reply with only a JSON array of ${items.length} strings, in order. No commentary.`;

  const out = await askJson<string[]>([{ type: "text", text: instruction }], { maxTokens: 6000 });
  const byId = new Map(lettered.map((b, i) => [b.id, (out[i] ?? b.text).trim()]));
  return bubbles.map((b) => (byId.has(b.id) ? { ...b, text: byId.get(b.id)! } : b));
}
