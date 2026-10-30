// Does Muse Spark answer at all from here, and can it read an image?
import { readFileSync } from "node:fs";
import { MODELS, metaPost } from "../src/lib/meta/client";

const image = `data:image/webp;base64,${readFileSync(".spike/page.webp").toString("base64")}`;

async function chat(label: string, content: unknown) {
  const t = Date.now();
  try {
    const res = await metaPost("/chat/completions", {
      model: MODELS.text,
      messages: [{ role: "user", content }],
      max_tokens: 600,
    });
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    console.log(`${label} OK in ${((Date.now() - t) / 1000).toFixed(1)}s:`);
    console.log(j.choices[0].message.content.slice(0, 700), "\n");
  } catch (e) {
    console.log(`${label} FAILED: ${e instanceof Error ? e.message.slice(0, 300) : e}\n`);
  }
}

async function main() {
  await chat("1. text only", "Reply with exactly: ready");
  await chat("2. image + text", [
    { type: "text", text: "This is a comic page. List every line of dialogue and every sound effect you can read, one per line, exactly as written." },
    { type: "image_url", image_url: { url: image } },
  ]);
}
main();
