import type { Panel } from "@/lib/doc";
import { drawPanel, redrawPanel } from "@/lib/draw";

export const maxDuration = 180;

/** With a page, redraws the panel in place; without one, draws the panel alone. */
export async function POST(request: Request) {
  try {
    const { image, panel, prompt } = (await request.json()) as {
      image?: string;
      panel?: Panel;
      prompt?: string;
    };
    if (!panel || !prompt) return Response.json({ error: "Send a panel and a prompt." }, { status: 400 });
    if (image) return Response.json({ page: await redrawPanel(image, panel, prompt) });

    const { width, height } = await import("@/lib/doc").then((m) => m.bounds(panel.shape));
    return Response.json({ art: await drawPanel(prompt, width, height) });
  } catch (e) {
    console.error(`/api/redraw failed:`, e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not draw that panel." }, { status: 500 });
  }
}
