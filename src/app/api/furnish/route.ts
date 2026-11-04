import type { PagePlan } from "@/lib/compose";
import { detectPage } from "@/lib/detect";
import { readable } from "@/lib/errors";
import { letterPage } from "@/lib/letter";

export const maxDuration = 180;

/**
 * Finds what is on a drawn page and letters it.
 *
 * Split from drawing so the page can be looked at while this happens. It runs
 * against a page already on screen, so a failure here costs the panels and the
 * lettering, not the page.
 */
export async function POST(request: Request) {
  try {
    const { image, plan } = (await request.json()) as { image?: string; plan?: PagePlan };
    if (!image?.startsWith("data:image/")) {
      return Response.json({ error: "Send the drawn page as a data: URL." }, { status: 400 });
    }

    const found = await detectPage(image);
    const bubbles = plan ? await letterPage(image, found.panels, plan) : [];

    // Panels come back in reading order, which is the order they were planned
    // in, so each one can carry the line of script it was drawn from.
    const panels = found.panels.map((panel, i) => {
      const said = plan?.panels[i];
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

    return Response.json({ panels, bubbles, counts: { ...found.counts, lettered: bubbles.length } });
  } catch (e) {
    console.error("/api/furnish failed:", e);
    return Response.json({ error: readable(e, "page") }, { status: 500 });
  }
}
