import type { Bubble } from "@/lib/doc";
import { readBubbles } from "@/lib/ocr";

import { readable } from "@/lib/errors";

export const maxDuration = 120;

/** Reads the words out of bubbles SAM already found. */
export async function POST(request: Request) {
  try {
    const { image, bubbles } = (await request.json()) as { image?: string; bubbles?: Bubble[] };
    if (!image || !bubbles) return Response.json({ error: "Send an image and its bubbles." }, { status: 400 });
    return Response.json({ bubbles: await readBubbles(image, bubbles) });
  } catch (e) {
    console.error(`/api/read failed:`, e);
    return Response.json({ error: readable(e, "lettering") }, { status: 500 });
  }
}
