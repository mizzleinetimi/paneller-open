// Meta Model API: one place for the base URL, the key and the model ids.
// Docs: https://dev.meta.ai/docs/quickstart — the surface mirrors the OpenAI API.

const BASE = "https://api.meta.ai/v1";

export const MODELS = {
  /** Text-to-image, edit and multi-image compose. $0.01 an image. */
  image: "muse-image-1.0",
  /** Segmentation from a noun phrase. $2.50 per 1k images. */
  sam: "sam-3.1",
  /** Text. */
  text: "muse-spark-1.1",
} as const;

function key(): string {
  const k = process.env.MODEL_API_KEY;
  if (!k) throw new Error("MODEL_API_KEY is not set. Create a key at https://dev.meta.ai and put it in .env.local");
  return k;
}

/**
 * The image models refuse things, and a refusal is not a fault to be retried:
 * the same prompt will be refused again. Drawing against a reference picture
 * is refused more readily than drawing from text alone, so callers that can
 * drop the reference and try again need to be able to tell this apart.
 */
export class ContentFiltered extends Error {
  readonly filtered = true;
  constructor(where: string) {
    super(`${where} was refused by the content filter`);
    this.name = "ContentFiltered";
  }
}

const isFiltered = (body: string) => /content_policy_violation|content management policy|safety/i.test(body);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POSTs JSON, and throws with the body on a non-2xx so failures say why.
 *
 * The connection drops now and then - often enough on a Lagos link that a demo
 * would lose a call to it - so a dropped connection or a 5xx is tried again.
 * A 4xx is not: a bad prompt or a bad key will fail the same way every time.
 */
export async function metaPost(path: string, body: unknown, opts?: { stream?: boolean; tries?: number }): Promise<Response> {
  const tries = opts?.tries ?? 3;
  let last = "";
  for (let attempt = 1; attempt <= tries; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key()}`,
          "Content-Type": "application/json",
          ...(opts?.stream ? { Accept: "text/event-stream" } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Node's fetch says only "fetch failed"; the reason is on the cause.
      const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : String(e);
      last = `could not be reached: ${cause}`;
      if (attempt < tries) await sleep(attempt * 800);
      continue;
    }
    if (res.ok) return res;
    const text = (await res.text()).slice(0, 500);
    if (isFiltered(text)) throw new ContentFiltered(`Meta API ${path}`);
    if (res.status < 500) throw new Error(`Meta API ${path} -> ${res.status}: ${text}`);
    last = `-> ${res.status}: ${text}`;
    if (attempt < tries) await sleep(attempt * 800);
  }
  throw new Error(`Meta API ${path} failed after ${tries} tries: ${last}`);
}

type ImageResponse = { data: { b64_json: string }[] };

/** Draws an image from a prompt. Returns base64 bytes, no data: prefix. */
export async function generateImage(opts: { prompt: string; size?: string; n?: number }): Promise<string[]> {
  const res = await metaPost("/images/generations", {
    model: MODELS.image,
    prompt: opts.prompt,
    n: opts.n ?? 1,
    ...(opts.size ? { size: opts.size } : {}),
  });
  return ((await res.json()) as ImageResponse).data.map((d) => d.b64_json);
}

export type InputImage = { bytes: Uint8Array; name: string; type?: string };

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

/**
 * Turns a data URL into something to attach, keeping the type it really is.
 *
 * Never assume: `canvas.toDataURL("image/webp")` quietly hands back a PNG
 * where WebP encoding is not supported, Safari among them. Declaring one type
 * and sending the bytes of another is rejected, and the message blames the
 * media rather than the label.
 */
export function attach(dataUrl: string, name = "image"): InputImage {
  const match = /^data:(image\/[\w+.-]+);base64,/.exec(dataUrl);
  const type = match?.[1] ?? "image/png";
  const bytes = Buffer.from(dataUrl.replace(/^data:[^,]+,/, ""), "base64");
  return { bytes, name: `${name}.${EXTENSION[type] ?? "png"}`, type };
}

/**
 * Edits one image, or composes several into one scene. `size` sets the aspect
 * ratio, not exact pixels.
 */
export async function editImage(opts: {
  prompt: string;
  images: InputImage[];
  size?: string;
  n?: number;
}): Promise<string[]> {
  const form = new FormData();
  form.set("model", MODELS.image);
  form.set("prompt", opts.prompt);
  form.set("n", String(opts.n ?? 1));
  if (opts.size) form.set("size", opts.size);
  for (const img of opts.images) {
    // Copying narrows the buffer type to ArrayBuffer, which Blob requires.
    const part = new Uint8Array(img.bytes);
    form.append("image", new Blob([part], { type: img.type ?? "image/webp" }), img.name);
  }
  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    if (isFiltered(text)) throw new ContentFiltered("Meta API /images/edits");
    throw new Error(`Meta API /images/edits -> ${res.status}: ${text}`);
  }
  return ((await res.json()) as ImageResponse).data.map((d) => d.b64_json);
}
