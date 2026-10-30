import type { Bubble } from "@/lib/doc";
import { readBubbles } from "@/lib/ocr";

export const maxDuration = 120;

/** Reads the words out of bubbles SAM already found. */
export async function POST(request: Request) {
  try {
    const { image, bubbles } = (await request.json()) as { image?: string; bubbles?: Bubble[] };
    if (!image || !bubbles) return Response.json({ error: "Send an image and its bubbles." }, { status: 400 });
    return Response.json({ bubbles: await readBubbles(image, bubbles) });
  } catch (e) {
    console.error(`/api/read failed:`, e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not read the lettering." }, { status: 500 });
  }
}
