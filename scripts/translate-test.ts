import { readFileSync } from "node:fs";
import { detectPage } from "../src/lib/detect";
import { readBubbles } from "../src/lib/ocr";
import { translateBubbles } from "../src/lib/translate";

async function main() {
  const image = `data:image/webp;base64,${readFileSync(".spike/page.webp").toString("base64")}`;
  const found = await detectPage(image);
  const read = await readBubbles(image, found.bubbles);
  for (const language of ["Yoruba", "Spanish", "Japanese"]) {
    const t = Date.now();
    const out = await translateBubbles(read, language);
    console.log(`\n${language} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    out.forEach((b, i) => console.log(`  ${read[i].text.replace(/\n/g, " / ")}  ->  ${b.text.replace(/\n/g, " / ")}`));
  }
}
main();
