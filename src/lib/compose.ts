import "server-only";

// Making a page from an idea.
//
// Two steps, because they are different jobs. Muse Spark turns a sentence into
// a page: how many panels, what is in each, who says what. Muse Image draws
// that page. Then SAM reads it back into parts, and from there it is an
// ordinary page in the editor - the panels are yours to redraw, the lettering
// yours to change, and nothing is baked in.

import { generateImage } from "./meta/client";
import { askJson } from "./meta/text";

export type PagePlan = {
  setting: string;
  panels: { description: string; speech?: string; sfx?: string; caption?: string }[];
};

const MAX_PANELS = 6;

/** Turns an idea into a plan for one page. */
export async function planPage(idea: string, panels?: number): Promise<PagePlan> {
  const count = panels ? `exactly ${Math.min(panels, MAX_PANELS)}` : "between three and six";
  const instruction = `Plan one page of a comic from this idea:

"${idea}"

Give it ${count} panels that tell the idea as a sequence. For each panel say what is drawn - who is in it, what they are doing, where the camera is - in one or two sentences. Give a panel spoken words only where someone speaks, a sound effect only where there is a noise, a caption only where narration is needed. Keep dialogue short: it has to fit in a bubble.

Also give one "setting" line describing the place and the time of day, which every panel shares, so the page does not drift from panel to panel.

Reply with only JSON of this shape, no commentary:
{"setting": "...", "panels": [{"description": "...", "speech": "...", "sfx": "...", "caption": "..."}]}

Leave out speech, sfx or caption where the panel has none.`;

  const plan = await askJson<PagePlan>([{ type: "text", text: instruction }], { maxTokens: 6000 });
  if (!plan.panels?.length) throw new Error("Muse Spark returned a page with no panels.");
  plan.panels = plan.panels.slice(0, MAX_PANELS);
  return plan;
}

/**
 * The prompt that draws the planned page.
 *
 * Deliberately **no lettering**: the words go on afterwards as objects, so they
 * stay editable, resizable and translatable instead of being pixels we would
 * later have to paint over. It also leaves the model free to draw, which it is
 * good at, rather than to spell, which it is unreliable at.
 */
export function pagePrompt(plan: PagePlan, style: string): string {
  const panels = plan.panels
    .map((p, i) => {
      // Leave room where the lettering will go, without drawing any.
      const room = p.speech || p.caption ? " Leave clear, uncluttered space in the upper part of this panel." : "";
      return `Panel ${i + 1}: ${p.description}${room}`;
    })
    .join("\n");

  return `A comic book page with ${plan.panels.length} panels in a clear grid, separated by clean white gutters.

Setting, the same in every panel: ${plan.setting}

${panels}

${style}

Important: draw artwork only. NO speech balloons, NO speech bubbles, NO caption boxes, NO sound effects, NO text, NO words, NO lettering, NO panel numbers, NO title. Every panel is pure illustration.`;
}

export const STYLES: Record<string, string> = {
  classic: "Bold ink lines, flat colour, printed comic look.",
  manga: "Black and white manga, screentone shading, fine linework.",
  noir: "High contrast black and white, heavy shadow, inked crosshatching.",
  soft: "Soft watercolour wash, gentle outlines, muted palette.",
};

/** Idea in, drawn page out. */
export async function drawPage(
  idea: string,
  opts: { panels?: number; style?: keyof typeof STYLES | string } = {},
): Promise<{ image: string; plan: PagePlan }> {
  const plan = await planPage(idea, opts.panels);
  const style = STYLES[opts.style ?? "classic"] ?? STYLES.classic;
  const [b64] = await generateImage({ prompt: pagePrompt(plan, style), size: "1024x1536" });
  return { image: `data:image/webp;base64,${b64}`, plan };
}
