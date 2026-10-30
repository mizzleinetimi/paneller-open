import type { Bubble } from "@/lib/doc";
import { translateBubbles } from "@/lib/translate";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { bubbles, language } = (await request.json()) as { bubbles?: Bubble[]; language?: string };
    if (!bubbles || !language) return Response.json({ error: "Send bubbles and a language." }, { status: 400 });
    return Response.json({ bubbles: await translateBubbles(bubbles, language) });
  } catch (e) {
    console.error(`/api/translate failed:`, e);
    return Response.json({ error: e instanceof Error ? e.message : "Could not translate." }, { status: 500 });
  }
}
