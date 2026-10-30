// Which noun phrase finds a thing on a comic page? One concept per call, $0.0025 each.
import { readFileSync } from "node:fs";
import { boxesOf, segment } from "../src/lib/meta/sam";

const [file, ...concepts] = process.argv.slice(2);
const image = `data:image/webp;base64,${readFileSync(file).toString("base64")}`;

async function main() {
for (const concept of concepts) {
  const t = Date.now();
  try {
    const r = await segment({ image, concept, confidence: true });
    const boxes = boxesOf(r);
    const conf = boxes.map((b) => b.confidence?.toFixed(2) ?? "-").join(" ");
    console.log(`${boxes.length.toString().padStart(2)} x "${concept}"  ${((Date.now() - t) / 1000).toFixed(1)}s  [${conf}]`);
  } catch (e) {
    console.log(` ! "${concept}": ${e instanceof Error ? e.message.slice(0, 120) : e}`);
  }
}
}
main();
