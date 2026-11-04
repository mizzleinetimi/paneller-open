// What does /images/edits actually accept? Send a tiny image as each type.
const KEY = process.env.MODEL_API_KEY!;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function tryType(name: string, bytes: Buffer, type: string) {
  const form = new FormData();
  form.set("model", "muse-image-1.0");
  form.set("prompt", "make it blue");
  form.append("image", new Blob([new Uint8Array(bytes)], { type }), name);
  const res = await fetch("https://api.meta.ai/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  const text = await res.text();
  console.log(`${type.padEnd(12)} -> ${res.status}: ${text.slice(0, 320)}`);
}

async function main() {
  await tryType("a.png", PNG, "image/png");
}
main();
