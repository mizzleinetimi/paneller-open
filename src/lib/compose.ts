import "server-only";

// Making a page from an idea.
//
// Two steps, because they are different jobs. Muse Spark turns a sentence into
// a page: how many panels, what is in each, who says what. Muse Image draws
// that page. Then SAM reads it back into parts, and from there it is an
// ordinary page in the editor - the panels are yours to redraw, the lettering
// yours to change, and nothing is baked in.

import { editImage, generateImage } from "./meta/client";
import { askJson } from "./meta/text";

/**
 * What carries from page to page: where we are and who is in it. The cast's
 * looks are the same strings the speech balloons aim by, so describing a
 * character once serves both the drawing and the lettering.
 */
export type StoryBible = {
  title: string;
  setting: string;
  cast: { who: string; look: string }[];
};

export type PagePlan = {
  setting: string;
  panels: {
    description: string;
    speech?: string;
    /**
     * Who says it, described by how they look rather than named: a segmentation
     * prompt can find "woman in a yellow headwrap" on the page and cannot find
     * "Ada". This is what the balloon's tail is aimed at.
     */
    speaker?: string;
    sfx?: string;
    caption?: string;
  }[];
};

const MAX_PANELS = 6;

const PANEL_RULES = `For each panel say what is drawn - who is in it, what they are doing, where the camera is - in one or two sentences. Give a panel spoken words only where someone speaks, a sound effect only where there is a noise, a caption only where narration is needed. Keep dialogue short: it has to fit in a bubble.

Where a panel has spoken words, also give "speaker": who says them, described by how they look in two to five words, as someone pointing at the page would say it - "woman in a yellow headwrap", "boy in a blue shirt", "man in a grey suit". Never a name, and never a pronoun: this is used to find them in the picture. Use exactly the same words for a character every time they appear.`;

/** Opens a comic: the cast and the place, plus the first page. */
export async function planStory(
  idea: string,
  panels?: number,
): Promise<{ bible: StoryBible; plan: PagePlan }> {
  const count = panels ? `exactly ${Math.min(panels, MAX_PANELS)}` : "between three and six";
  const instruction = `Start a comic from this idea:

"${idea}"

First settle what carries through the whole comic:
- "title": a short title.
- "setting": the place and the time of day, in one line.
- "cast": everyone who appears, each with "who" (their part in the story, such as "the tailor") and "look" (how they look, in the same two-to-five-word form the speakers use, such as "man in a green apron"). Give every character a look that tells them apart from the others at a glance - different clothing colours, not just different faces.

Then plan the first page, with ${count} panels.

${PANEL_RULES}

Reply with only JSON of this shape, no commentary:
{"title":"...","setting":"...","cast":[{"who":"...","look":"..."}],"panels":[{"description":"...","speech":"...","speaker":"...","sfx":"...","caption":"..."}]}

Leave out speech, speaker, sfx or caption where the panel has none.`;

  const out = await askJson<StoryBible & PagePlan>([{ type: "text", text: instruction }], { maxTokens: 8000 });
  if (!out.panels?.length) throw new Error("Muse Spark returned a page with no panels.");
  return {
    bible: { title: out.title ?? "Untitled comic", setting: out.setting, cast: out.cast ?? [] },
    plan: { setting: out.setting, panels: out.panels.slice(0, MAX_PANELS) },
  };
}

/** Carries a comic on: the next page, knowing the cast and what has happened. */
export async function planNextPage(
  bible: StoryBible,
  soFar: PagePlan[],
  what: string,
  panels?: number,
): Promise<PagePlan> {
  const count = panels ? `exactly ${Math.min(panels, MAX_PANELS)}` : "between three and six";
  const story = soFar
    .map((page, i) => `Page ${i + 1}: ${page.panels.map((p) => p.description).join(" ")}`)
    .join("\n");

  const instruction = `Carry on this comic with its next page.

Title: ${bible.title}
Setting: ${bible.setting}
Cast:
${bible.cast.map((c) => `- ${c.who}: ${c.look}`).join("\n")}

What has happened so far:
${story}

What happens on this page: ${what}

Give it ${count} panels. Use the cast's looks exactly as written above, word for word, so the same person is described the same way on every page.

${PANEL_RULES}

Reply with only JSON of this shape, no commentary:
{"setting":"...","panels":[{"description":"...","speech":"...","speaker":"...","sfx":"...","caption":"..."}]}`;

  const plan = await askJson<PagePlan>([{ type: "text", text: instruction }], { maxTokens: 6000 });
  if (!plan.panels?.length) throw new Error("Muse Spark returned a page with no panels.");
  return { setting: plan.setting ?? bible.setting, panels: plan.panels.slice(0, MAX_PANELS) };
}

/** Turns an idea into a plan for one page. */
export async function planPage(idea: string, panels?: number): Promise<PagePlan> {
  const count = panels ? `exactly ${Math.min(panels, MAX_PANELS)}` : "between three and six";
  const instruction = `Plan one page of a comic from this idea:

"${idea}"

Give it ${count} panels that tell the idea as a sequence. For each panel say what is drawn - who is in it, what they are doing, where the camera is - in one or two sentences. Give a panel spoken words only where someone speaks, a sound effect only where there is a noise, a caption only where narration is needed. Keep dialogue short: it has to fit in a bubble.

Where a panel has spoken words, also give "speaker": who says them, described by how they look in two to five words, as someone pointing at the page would say it - "woman in a yellow headwrap", "boy in a blue shirt", "man in a grey suit". Never a name, and never a pronoun: this is used to find them in the picture. Describe them the same way every time they appear.

Also give one "setting" line describing the place and the time of day, which every panel shares, so the page does not drift from panel to panel.

Reply with only JSON of this shape, no commentary:
{"setting": "...", "panels": [{"description": "...", "speech": "...", "speaker": "...", "sfx": "...", "caption": "..."}]}

Leave out speech, speaker, sfx or caption where the panel has none.`;

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

/**
 * Draws a planned page.
 *
 * With an earlier page to hand, the page is drawn as an edit against it rather
 * than from text alone, so the characters and the drawing style carry over
 * instead of being described again and hoped for. The prompt has to insist on
 * a *new* page: given an image, the model's first instinct is to alter it.
 */
export async function drawPlan(
  plan: PagePlan,
  style: string,
  reference?: { image: string; cast: string[] },
): Promise<string> {
  const prompt = pagePrompt(plan, style);
  if (!reference) {
    const [b64] = await generateImage({ prompt, size: "1024x1536" });
    return `data:image/webp;base64,${b64}`;
  }

  const who = reference.cast.length
    ? ` The same people appear: ${reference.cast.join(", ")}. Keep each of them looking exactly as they do in the reference - same face, same clothes, same colours.`
    : "";
  const bytes = Buffer.from(reference.image.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const [b64] = await editImage({
    prompt: `The attached image is an earlier page of the same comic, for reference only. Do not modify it, do not include any part of it, and do not copy its panel layout.

Draw a COMPLETELY NEW comic page, in the same drawing style, with the same characters.${who}

${prompt}`,
    images: [{ bytes, name: "reference.webp", type: "image/webp" }],
    size: "1024x1536",
  });
  return `data:image/webp;base64,${b64}`;
}

/** Idea in, drawn page out. */
export async function drawPage(
  idea: string,
  opts: { panels?: number; style?: keyof typeof STYLES | string } = {},
): Promise<{ image: string; plan: PagePlan }> {
  const plan = await planPage(idea, opts.panels);
  const style = STYLES[opts.style ?? "classic"] ?? STYLES.classic;
  return { image: await drawPlan(plan, STYLES[opts.style ?? "classic"] ?? style), plan };
}
