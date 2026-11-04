import type { Bubble } from "@/lib/doc";
import { translateBubbles } from "@/lib/translate";

import { readable } from "@/lib/errors";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { bubbles, language } = (await request.json()) as { bubbles?: Bubble[]; language?: string };
    if (!bubbles || !language) return Response.json({ error: "Send bubbles and a language." }, { status: 400 });
    return Response.json({ bubbles: await translateBubbles(bubbles, language) });
  } catch (e) {
    console.error(`/api/translate failed:`, e);
    return Response.json({ error: readable(e, "translation") }, { status: 500 });
  }
}
