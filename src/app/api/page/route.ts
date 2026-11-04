import {
  STYLES,
  type PagePlan,
  type StoryBible,
  drawCastSheet,
  drawPlan,
  planNextPage,
  planStory,
  readCast,
} from "@/lib/compose";
import { detectPage } from "@/lib/detect";
import { letterPage } from "@/lib/letter";
import { readable } from "@/lib/errors";

export const maxDuration = 300;

type Body = {
  /** A new comic: the idea it starts from. */
  idea?: string;
  /** A further page: what happens on it, with the story so far. */
  what?: string;
  story?: StoryBible & { style?: string };
  soFar?: PagePlan[];
  /** The page before this one, drawn, so the cast and style carry over. */
  reference?: string[];
  panels?: number;
  style?: string;
};

/**
 * Plans a page, draws it clean, reads its panels and letters it.
 *
 * One request, because a page is no use in pieces: a plan with no drawing, or
 * a drawing with no panels, is not something the editor can open.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const styleName = body.style ?? body.story?.style ?? "classic";
    const style = STYLES[styleName] ?? STYLES.classic;

    let plan: PagePlan;
    let bible: StoryBible;

    if (body.what && body.story) {
      bible = body.story;
      plan = await planNextPage(body.story, body.soFar ?? [], body.what, body.panels);
    } else if (body.idea?.trim()) {
      const started = await planStory(body.idea.trim(), body.panels);
      bible = started.bible;
      plan = started.plan;
      // Draw the cast once, before any page, and hold every page against it.
      bible.sheet = await drawCastSheet(bible, style);
    } else {
      return Response.json({ error: "Say what the page is about." }, { status: 400 });
    }

    // The sheet anchors the characters; the page before carries the place and
    // what has just happened. Two references, and one of them never drifts.
    const references = [bible.sheet, ...(body.reference ?? [])].filter(
      (img, i, all): img is string => Boolean(img) && all.indexOf(img) === i,
    );

    // Reading the cast back off the sheet only matters to later pages and to
    // aiming balloons, so it happens while this page is being drawn.
    const [drawn, cast] = await Promise.all([
      drawPlan(plan, style, references.length ? { images: references, cast: bible.cast.map((c) => c.look) } : undefined),
      bible.sheet && !body.what ? readCast(bible.sheet, bible) : Promise.resolve(bible.cast),
    ]);
    const { image, lostContinuity } = drawn;
    bible = { ...bible, cast };

    // The art is clean, so the only thing worth finding is the panels; the
    // lettering is laid over them from the plan that drew them.
    const found = await detectPage(image);
    const bubbles = await letterPage(image, found.panels, plan);

    // Panels come back in reading order, which is the order they were planned
    // in, so each one can carry the line of script it was drawn from.
    const panels = found.panels.map((panel, i) => {
      const said = plan.panels[i];
      if (!said) return panel;
      return {
        ...panel,
        script: said.description,
        size: said.size,
        said: {
          ...(said.speech ? { speech: said.speech } : {}),
          ...(said.speaker ? { speaker: said.speaker } : {}),
          ...(said.sfx ? { sfx: said.sfx } : {}),
          ...(said.caption ? { caption: said.caption } : {}),
        },
      };
    });

    return Response.json({
      image,
      plan,
      story: { ...bible, style: styleName },
      panels,
      bubbles,
      counts: { ...found.counts, lettered: bubbles.length },
      ...(lostContinuity
        ? {
            warning:
              "The models would not draw this page against the pages before it, so it was drawn from its description alone. The characters may not match.",
          }
        : {}),
    });
  } catch (e) {
    console.error("/api/page failed:", e);
    return Response.json({ error: readable(e, "page") }, { status: 500 });
  }
}
