import { detectPage } from "@/lib/detect";
import { readable } from "@/lib/errors";

export const maxDuration = 120;

/** Reads a page. The key stays here; the browser only ever sends the image. */
export async function POST(request: Request) {
  try {
    const { image } = (await request.json()) as { image?: string };
    if (!image?.startsWith("data:image/")) {
      return Response.json({ error: "Send an image as a data: URL." }, { status: 400 });
    }
    return Response.json(await detectPage(image));
  } catch (e) {
    console.error("/api/detect failed:", e);
    return Response.json({ error: readable(e, "page") }, { status: 500 });
  }
}
