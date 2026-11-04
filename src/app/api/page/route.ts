import {
  STYLES,
  type PagePlan,
  type StoryBible,
  describeSheet,
  drawCastSheet,
  drawPlan,
  planNextPage,
  planStory,
  readCast,
} from "@/lib/compose";
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
  /** A cast sheet the reader supplied, made from their own pictures. */
  sheet?: string;
  /** How many characters are on it. */
  castCount?: number;
};

/**
 * Plans a page and draws it. Nothing else.
 *
 * Finding the panels and laying the lettering over them take another half a
 * minute between them, and there is no reason to look at nothing while they
 * happen: the drawn page is worth showing the moment it exists. `/api/furnish`
 * takes it from there, against a page already on screen.
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
      // With a sheet of their own, the characters on it are read first and the
      // story is planned around them rather than around invented people.
      const known = body.sheet ? await describeSheet(body.sheet, body.castCount ?? 1) : undefined;
      const started = await planStory(body.idea.trim(), body.panels, known);
      bible = started.bible;
      plan = started.plan;
      // Draw the cast once, before any page, unless one was brought along.
      bible.sheet = body.sheet ?? (await drawCastSheet(bible, style));
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
      // A sheet the reader supplied has already been read; one we drew has not.
      bible.sheet && !body.what && !body.sheet
        ? readCast(bible.sheet, bible)
        : Promise.resolve(bible.cast),
    ]);
    const { image, lostContinuity } = drawn;
    bible = { ...bible, cast };

    return Response.json({
      image,
      plan,
      story: { ...bible, style: styleName },
      ...(lostContinuity
        ? {
            warning:
              "The drawing model would not work from the cast sheet this time, so the page was drawn from its description alone. The characters may not match it.",
          }
        : {}),
    });
  } catch (e) {
    console.error("/api/page failed:", e);
    return Response.json({ error: readable(e, "page") }, { status: 500 });
  }
}
