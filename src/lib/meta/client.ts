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

/** POSTs JSON and throws with the body on a non-2xx, so failures say why. */
export async function metaPost(path: string, body: unknown, opts?: { stream?: boolean }): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(opts?.stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Meta API ${path} -> ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res;
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
  if (!res.ok) throw new Error(`Meta API /images/edits -> ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return ((await res.json()) as ImageResponse).data.map((d) => d.b64_json);
}
