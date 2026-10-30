// SAM 3.1 segmentation. One short noun phrase per request ("speech balloon"),
// one image, and back come a box and a mask for every match.
// Docs: https://dev.meta.ai/docs/sam/segmenting

import {
  parseImageStream,
  recordsOfKind,
  type ImageSegmentationResult,
  type ResponsesEvent,
  type SegmentationBoxRecord,
  type SegmentationMaskRecord,
} from "@meta-sam/parser";
import { MODELS, metaPost } from "./client";

export type MaskEncoding = "lossless" | "one_bit";

/** Reads the SSE body into the structural events the parser consumes. */
async function* sseEvents(res: Response): AsyncIterable<ResponsesEvent> {
  const body = res.body;
  if (!body) throw new Error("SAM returned no body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    // Frames are separated by a blank line; a mask payload can split anywhere.
    let cut = buffered.indexOf("\n\n");
    for (; cut !== -1; cut = buffered.indexOf("\n\n")) {
      const frame = buffered.slice(0, cut);
      buffered = buffered.slice(cut + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        yield JSON.parse(data) as ResponsesEvent;
      }
    }
  }
}

/**
 * Segments one image by concept. `image` is a public URL or a data: URL.
 * Commands, questions, lists and negation are unreliable prompts; name one thing.
 */
export async function segment(opts: {
  image: string;
  concept: string;
  confidence?: boolean;
  encoding?: MaskEncoding;
}): Promise<ImageSegmentationResult> {
  const metadata: Record<string, string> = {};
  if (opts.confidence) metadata.include_confidence = "true";
  if (opts.encoding) metadata.mask_encoding = opts.encoding;

  const res = await metaPost(
    "/responses",
    {
      model: MODELS.sam,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: opts.concept },
            { type: "input_image", image_url: opts.image },
          ],
        },
      ],
      stream: true,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    },
    { stream: true },
  );

  const parsed = parseImageStream(sseEvents(res));
  for await (const _snapshot of parsed) {
    // Snapshots accumulate; we only want the final one.
  }
  return parsed.finalResult;
}

export const boxesOf = (r: ImageSegmentationResult): readonly SegmentationBoxRecord[] => recordsOfKind(r.records, "box");
export const masksOf = (r: ImageSegmentationResult): readonly SegmentationMaskRecord[] => recordsOfKind(r.records, "mask");
