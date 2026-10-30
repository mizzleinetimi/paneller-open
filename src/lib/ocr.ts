import "server-only";

// Reading the words out of the bubbles SAM found.
//
// SAM returns shapes and never text. Rather than ask the page as a whole and
// hope the answers line up with the boxes, each bubble is cropped and sent as
// its own small picture, numbered, in a single request: the model reads each
// crop knowing nothing else is in it, and we know which answer belongs where.

import sharp from "sharp";
import type { Bubble } from "./doc";
import { type Part, askJson } from "./meta/text";

/** Pads a crop a little so the outline, and any letters touching it, survive. */
const PAD = 6;

async function cropBubbles(page: Buffer, bubbles: Bubble[]): Promise<string[]> {
  const { width = 0, height = 0 } = await sharp(page).metadata();
  return Promise.all(
    bubbles.map(async (b) => {
      const left = Math.max(0, Math.round(b.x) - PAD);
      const top = Math.max(0, Math.round(b.y) - PAD);
      const crop = await sharp(page)
        .extract({
          left,
          top,
          width: Math.min(Math.round(b.width) + PAD * 2, width - left),
          height: Math.min(Math.round(b.height) + PAD * 2, height - top),
        })
        .png()
        .toBuffer();
      return `data:image/png;base64,${crop.toString("base64")}`;
    }),
  );
}

const INSTRUCTION = `Each image is one piece of lettering cut from a comic page: a speech bubble, a caption or a sound effect.

Read the words in each image, exactly as written. Keep the original spelling, punctuation and capitalisation. If a sound effect is stretched or repeated, write it as it appears. If an image holds no readable words, use an empty string.

Reply with only a JSON array of strings, one per image, in the same order as the images. No commentary.`;

/** Fills in the text of each bubble. Returns them in the order given. */
export async function readBubbles(pageImage: string, bubbles: Bubble[]): Promise<Bubble[]> {
  if (!bubbles.length) return bubbles;
  const page = Buffer.from(pageImage.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const crops = await cropBubbles(page, bubbles);

  const parts: Part[] = [{ type: "text", text: INSTRUCTION }];
  crops.forEach((url, i) => {
    parts.push({ type: "text", text: `Image ${i + 1} (${bubbles[i].kind}):` });
    parts.push({ type: "image_url", image_url: { url } });
  });

  const lines = await askJson<string[]>(parts, { maxTokens: 6000 });
  return bubbles.map((b, i) => ({ ...b, text: (lines[i] ?? "").trim() }));
}
