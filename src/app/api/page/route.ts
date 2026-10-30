import { STYLES, type PagePlan, type StoryBible, drawPlan, planNextPage, planStory } from "@/lib/compose";
import { detectPage } from "@/lib/detect";
import { letterPage } from "@/lib/letter";

export const maxDuration = 300;

type Body = {
  /** A new comic: the idea it starts from. */
  idea?: string;
  /** A further page: what happens on it, with the story so far. */
  what?: string;
  story?: StoryBible & { style?: string };
  soFar?: PagePlan[];
  /** The page before this one, drawn, so the cast and style carry over. */
  reference?: string;
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
    let bible: StoryBible | undefined;

    if (body.what && body.story) {
      bible = body.story;
      plan = await planNextPage(body.story, body.soFar ?? [], body.what, body.panels);
    } else if (body.idea?.trim()) {
      const started = await planStory(body.idea.trim(), body.panels);
      bible = started.bible;
      plan = started.plan;
    } else {
      return Response.json({ error: "Say what the page is about." }, { status: 400 });
    }

    const image = await drawPlan(
      plan,
      style,
      body.reference ? { image: body.reference, cast: (bible?.cast ?? []).map((c) => c.look) } : undefined,
    );

    // The art is clean, so the only thing worth finding is the panels; the
    // lettering is laid over them from the plan that drew them.
    const found = await detectPage(image);
    const bubbles = await letterPage(image, found.panels, plan);

    return Response.json({
      image,
      plan,
      story: bible ? { ...bible, style: styleName } : undefined,
      panels: found.panels,
      bubbles,
      counts: { ...found.counts, lettered: bubbles.length },
    });
  } catch (e) {
    console.error("/api/page failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not draw that page." }, { status: 500 });
  }
}
