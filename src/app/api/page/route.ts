import { drawPage } from "@/lib/compose";
import { detectPage } from "@/lib/detect";

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
    const found = await detectPage(image);
    return Response.json({ image, plan, ...found });
  } catch (e) {
    console.error("/api/page failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not draw that page." }, { status: 500 });
  }
}
