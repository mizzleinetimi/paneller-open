import "server-only";

// Making a page from an idea.
//
// Two steps, because they are different jobs. Muse Spark turns a sentence into
// a page: how many panels, what is in each, who says what. Muse Image draws
// that page. Then SAM reads it back into parts, and from there it is an
// ordinary page in the editor - the panels are yours to redraw, the lettering
// yours to change, and nothing is baked in.

import { ContentFiltered, attach, editImage, generateImage } from "./meta/client";
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
  /**
   * The cast drawn once, side by side, and kept. Every page is drawn against
   * it, so characters are anchored to one picture instead of to the page
   * before - which drifts, each page faithful to the last and the last
   * nothing like the first. One image however big the cast, which matters:
   * handing a model more reference pictures makes it worse, not better.
   */
  sheet?: string;
};

/** How much of the page a panel takes, which is how a comic paces itself. */
export type PanelSize = "wide" | "tall" | "small" | "big" | "full";

export type PagePlan = {
  setting: string;
  /** How the panels sit on the page, in a line, for the drawing prompt. */
  layout?: string;
  panels: {
    description: string;
    /** Its weight on the page. A page of equal boxes reads flat. */
    size?: PanelSize;
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

const PANEL_RULES = `Give the page a layout that is not a uniform grid. A comic paces itself by panel size: a wide panel to establish a place, small ones for quick beats, a big one for the moment that matters. Give each panel a "size" - one of "wide" (full width, short), "tall" (half width, full height), "small" (a quick beat), "big" (the moment of the page) or "full" (the whole page) - and give "layout": one line saying how they sit, such as "a wide panel across the top, two small ones beneath it, then a big panel across the bottom". Never make every panel the same size.

For each panel say what is drawn - who is in it, what they are doing, where the camera is - in one or two sentences. Give a panel spoken words only where someone speaks, a sound effect only where there is a noise, a caption only where narration is needed. Keep dialogue short: it has to fit in a bubble.

Where a panel has spoken words, also give "speaker": who says them, described by how they look in two to five words, as someone pointing at the page would say it - "woman in a yellow headwrap", "boy in a blue shirt", "man in a grey suit". Never a name, and never a pronoun: this is used to find them in the picture. Use exactly the same words for a character every time they appear.`;

/** Opens a comic: the cast and the place, plus the first page. */
export async function planStory(
  idea: string,
  panels?: number,
  /** Characters the reader brought, already described from their own pictures. */
  known?: { who: string; look: string }[],
): Promise<{ bible: StoryBible; plan: PagePlan }> {
  const count = panels ? `exactly ${Math.min(panels, MAX_PANELS)}` : "between three and six";
  const cast = known?.length
    ? `- "cast": use exactly these characters, word for word, and no others. The story is about them:
${known.map((c) => `  - who: "${c.who}", look: "${c.look}"`).join("\n")}`
    : `- "cast": everyone who appears, each with "who" (their part in the story, such as "the tailor") and "look" (how they look, in the same two-to-five-word form the speakers use, such as "man in a green apron"). Give every character a look that tells them apart from the others at a glance - different clothing colours, not just different faces.`;

  const instruction = `Start a comic from this idea:

"${idea}"

First settle what carries through the whole comic:
- "title": a short title.
- "setting": the place and the time of day, in one line.
${cast}

Then plan the first page, with ${count} panels.

${PANEL_RULES}

Reply with only JSON of this shape, no commentary:
{"title":"...","setting":"...","cast":[{"who":"...","look":"..."}],"panels":[{"description":"...","speech":"...","speaker":"...","sfx":"...","caption":"..."}]}

Leave out speech, speaker, sfx or caption where the panel has none.`;

  const out = await askJson<StoryBible & PagePlan>([{ type: "text", text: instruction }], { maxTokens: 8000 });
  if (!out.panels?.length) throw new Error("Muse Spark returned a page with no panels.");
  return {
    bible: { title: out.title ?? "Untitled comic", setting: out.setting, cast: out.cast ?? [] },
    plan: { setting: out.setting, layout: out.layout, panels: out.panels.slice(0, MAX_PANELS) },
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
  const used = soFar.map((p) => p.layout).filter(Boolean);

  const instruction = `Carry on this comic with its next page.

Title: ${bible.title}
Setting: ${bible.setting}
Cast:
${bible.cast.map((c) => `- ${c.who}: ${c.look}`).join("\n")}

What has happened so far:
${story}

What happens on this page: ${what}

Give it ${count} panels. Use the cast's looks exactly as written above, word for word, so the same person is described the same way on every page.
${used.length ? `\nThe pages before this one were laid out like this:\n${used.map((l, i) => `Page ${i + 1}: ${l}`).join("\n")}\n\nLay this page out differently from all of them. A comic where every page has the same arrangement of panels reads as flat as one where every panel is the same size. Put the big panel somewhere else, or start with something other than a wide establishing shot.` : ""}

${PANEL_RULES}

Reply with only JSON of this shape, no commentary:
{"setting":"...","layout":"...","panels":[{"description":"...","size":"...","speech":"...","speaker":"...","sfx":"...","caption":"..."}]}`;

  const plan = await askJson<PagePlan>([{ type: "text", text: instruction }], { maxTokens: 6000 });
  if (!plan.panels?.length) throw new Error("Muse Spark returned a page with no panels.");
  return { setting: plan.setting ?? bible.setting, layout: plan.layout, panels: plan.panels.slice(0, MAX_PANELS) };
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

  const sizes = plan.panels
    .map((p, i) => (p.size ? `Panel ${i + 1} is ${SIZE_WORDS[p.size] ?? p.size}.` : null))
    .filter(Boolean)
    .join(" ");

  return `A comic book page of ${plan.panels.length} panels, separated by clean white gutters.

Layout: ${plan.layout ?? "vary the panel sizes; do not draw a uniform grid"}. ${sizes}
The panels are different sizes and shapes, as on a real comic page.

Setting, the same in every panel: ${plan.setting}

${panels}

${style}

Important: draw artwork only. NO speech balloons, NO speech bubbles, NO caption boxes, NO sound effects, NO text, NO words, NO lettering, NO panel numbers, NO title. Every panel is pure illustration.`;
}

const SIZE_WORDS: Record<string, string> = {
  wide: "a wide panel running the full width of the page, not tall",
  tall: "a tall panel running the full height of its column",
  small: "a small panel, narrower than the others",
  big: "the largest panel on the page",
  full: "a single panel filling the whole page",
};

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
export type Drawn = { image: string; /** Set when the page had to be drawn without its references. */ lostContinuity?: boolean };

export async function drawPlan(
  plan: PagePlan,
  style: string,
  reference?: { images: string[]; cast: string[] },
): Promise<Drawn> {
  const prompt = pagePrompt(plan, style);
  const fromText = async (): Promise<string> => {
    const [b64] = await generateImage({ prompt, size: "1024x1536" });
    return `data:image/webp;base64,${b64}`;
  };
  if (!reference?.images.length) return { image: await fromText() };

  const who = reference.cast.length
    ? ` The same people appear: ${reference.cast.join(", ")}. Keep each of them looking exactly as they do in the reference - same face, same clothes, same colours.`
    : "";
  const many = reference.images.length > 1;
  const images = reference.images.map((image, i) => attach(image, `reference-${i + 1}`));

  try {
    const [b64] = await editImage({
      prompt: `The attached ${many ? "images are earlier pages" : "image is an earlier page"} of the same comic, for reference only. Do not modify ${many ? "them" : "it"}, do not include any part of ${many ? "them" : "it"}, and do not copy ${many ? "their" : "its"} panel layout.

Draw a COMPLETELY NEW comic page, in the same drawing style, with the same characters.${who}

${prompt}`,
      images,
      size: "1024x1536",
    });
    return { image: `data:image/webp;base64,${b64}` };
  } catch (e) {
    if (!(e instanceof ContentFiltered)) throw e;
    // Drawing against a picture is refused more readily than drawing from
    // text. Rather than lose the page, draw it from its description alone and
    // tell the caller the cast may not have carried.
    return { image: await fromText(), lostContinuity: true };
  }
}

/** Idea in, drawn page out. */
export async function drawPage(
  idea: string,
  opts: { panels?: number; style?: keyof typeof STYLES | string } = {},
): Promise<{ image: string; plan: PagePlan }> {
  const plan = await planPage(idea, opts.panels);
  const style = STYLES[opts.style ?? "classic"] ?? STYLES.classic;
  const { image } = await drawPlan(plan, style);
  return { image, plan };
}


/** Draws the cast once, to be the reference every page is held against. */
export async function drawCastSheet(bible: StoryBible, style: string): Promise<string> {
  const people = bible.cast.map((c, i) => `${i + 1}. ${c.who}, ${c.look}`).join("\n");
  const [b64] = await generateImage({
    prompt: `A character reference sheet for a comic: ${bible.cast.length} character${
      bible.cast.length === 1 ? "" : "s"
    } standing in a row against a plain flat background, full body, facing forward, arms at their sides, even lighting, no shadows. From left to right:

${people}

Each one must be told apart from the others at a glance, by their clothes and their colours rather than their faces. ${style}

Draw the people only. NO text, NO labels, NO names, NO numbers, NO panels, NO borders, NO speech balloons.`,
    size: "1536x1024",
  });
  return `data:image/webp;base64,${b64}`;
}

/**
 * Describes the cast as they were actually drawn.
 *
 * The looks are written before anything exists, and the drawing does not
 * always oblige: a cast planned around "man in a red cap" comes back in a dark
 * one, and the description is then wrong about its own comic. That matters
 * twice over, because the same words are what a speech balloon's tail is aimed
 * by. Reading them back off the sheet makes the words true.
 */
export async function readCast(sheet: string, bible: StoryBible): Promise<StoryBible["cast"]> {
  if (!bible.cast.length) return bible.cast;
  const planned = bible.cast.map((c, i) => `${i + 1}. ${c.who}, meant to be: ${c.look}`).join("\n");
  try {
    const looks = await askJson<string[]>(
      [
        {
          type: "text",
          text: `This is a character sheet for a comic. From left to right it shows ${bible.cast.length} character${
            bible.cast.length === 1 ? "" : "s"
          }:

${planned}

Describe each one as they are actually drawn, not as they were meant to be, in two to five words, by clothing and colour - "man in a green apron", "girl in a yellow dress". No names, no pronouns: these are used to find each person in a picture, so they must tell them apart.

Reply with only a JSON array of ${bible.cast.length} strings, in the same order.`,
        },
        { type: "image_url", image_url: { url: sheet } },
      ],
      { maxTokens: 4000 },
    );
    return bible.cast.map((c, i) => ({ ...c, look: looks[i]?.trim() || c.look }));
  } catch {
    return bible.cast; // The planned words are better than none.
  }
}


/** Describes characters on a sheet someone supplied, left to right. */
export async function describeSheet(sheet: string, count: number): Promise<{ who: string; look: string }[]> {
  const people = await askJson<{ who: string; look: string }[]>(
    [
      {
        type: "text",
        text: `This is a character sheet for a comic, showing ${count} character${
          count === 1 ? "" : "s"
        } side by side, left to right.

For each one give "who" - a short part they could play in a story, such as "the tailor" or "the schoolgirl" - and "look": how they look in two to five words, by clothing and colour, as someone pointing at the sheet would say it: "man in a green apron", "girl in a yellow dress". No names, no pronouns: these are used to find each person in a picture, so they must tell them apart.

Reply with only a JSON array of ${count} objects, left to right, no commentary.`,
      },
      { type: "image_url", image_url: { url: sheet } },
    ],
    { maxTokens: 4000 },
  );
  return people.slice(0, count);
}
