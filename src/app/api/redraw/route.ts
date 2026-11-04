import { readable } from "@/lib/errors";
import { attach, editImage, generateImage } from "@/lib/meta/client";

export const maxDuration = 180;

/**
 * Redraws one panel. A panel owns its art, so only that picture is sent and
 * only that picture comes back: the rest of the page is never in the request
 * and so cannot drift. With no art yet, the panel is drawn from the prompt.
 */
export async function POST(request: Request) {
  try {
    const { art, prompt } = (await request.json()) as { art?: string; prompt?: string };
    if (!prompt?.trim()) return Response.json({ error: "Say what to change." }, { status: 400 });

    if (!art) {
      const [b64] = await generateImage({
        prompt: `A single comic book panel, no border, no speech bubbles, no lettering. ${prompt}`,
      });
      return Response.json({ art: `data:image/webp;base64,${b64}` });
    }

    const [b64] = await editImage({
      prompt: `Redraw this comic panel. Keep the same art style, line weight and colouring. Draw artwork only: no speech balloons, no caption boxes, no lettering of any kind. ${prompt}`,
      images: [attach(art, "panel")],
    });
    return Response.json({ art: `data:image/webp;base64,${b64}` });
  } catch (e) {
    console.error("/api/redraw failed:", e);
    return Response.json({ error: readable(e, "panel") }, { status: 500 });
  }
}
