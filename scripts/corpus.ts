// Draws the benchmark corpus. Run once: pnpm corpus
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { PAGES } from "../bench/pages";
import { generateImage } from "../src/lib/meta/client";

const DIR = "bench/pages";

async function main() {
  mkdirSync(DIR, { recursive: true });
  for (const page of PAGES) {
    const file = `${DIR}/${page.id}.webp`;
    if (existsSync(file) && !process.argv.includes("--force")) {
      console.log(`${page.id}: already drawn`);
      continue;
    }
    const t = Date.now();
    const [b64] = await generateImage({ prompt: page.prompt, size: "1024x1536" });
    writeFileSync(file, Buffer.from(b64, "base64"));
    console.log(`${page.id}: drawn in ${((Date.now() - t) / 1000).toFixed(1)}s - ${page.stresses}`);
  }
}
main();
