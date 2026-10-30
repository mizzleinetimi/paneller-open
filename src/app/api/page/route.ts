import { drawPage } from "@/lib/compose";
import { detectPage } from "@/lib/detect";
import { letterPage } from "@/lib/letter";

export const maxDuration = 300;

/**
 * Idea in; a drawn page, read back into panels and bubbles, out. Drawing and
 * reading are one request because a drawn page is no use until it has parts.
 */
export async function POST(request: Request) {
  try {
    const { idea, panels, style } = (await request.json()) as {
      idea?: string;
      panels?: number;
      style?: string;
    };
    if (!idea?.trim()) return Response.json({ error: "Say what the page is about." }, { status: 400 });

    const { image, plan } = await drawPage(idea.trim(), { panels, style });
    // The art is clean, so the only thing worth finding is the panels; the
    // lettering is laid over them from the plan that drew them.
    const found = await detectPage(image);
    const bubbles = await letterPage(image, found.panels, plan);
    return Response.json({
      image,
      plan,
      panels: found.panels,
      bubbles,
      counts: { ...found.counts, lettered: bubbles.length },
    });
  } catch (e) {
    console.error("/api/page failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not draw that page." }, { status: 500 });
  }
}
