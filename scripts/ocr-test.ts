import { readFileSync } from "node:fs";
import { detectPage } from "../src/lib/detect";
import { readBubbles } from "../src/lib/ocr";

async function main() {
  const image = `data:image/webp;base64,${readFileSync(".spike/page.webp").toString("base64")}`;
  let t = Date.now();
  const found = await detectPage(image);
  console.log(`detect: ${JSON.stringify(found.counts)} in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  t = Date.now();
  const read = await readBubbles(image, found.bubbles);
  console.log(`ocr in ${((Date.now() - t) / 1000).toFixed(1)}s:`);
  for (const b of read) console.log(`  ${b.kind.padEnd(7)} "${b.text}"`);
}
main();
