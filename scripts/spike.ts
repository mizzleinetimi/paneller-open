// Day-one spike: does Muse Image draw a comic page from text alone, and does
// SAM 3.1 find its panels and balloons? Run: pnpm spike
import { mkdirSync, writeFileSync } from "node:fs";
import { decodeMaskToRaster, decodeMaskToSVGPath } from "@meta-sam/parser";
import { generateImage } from "../src/lib/meta/client";
import { boxesOf, masksOf, segment } from "../src/lib/meta/sam";

const OUT = ".spike";
const since = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)}s`;

const PAGE_PROMPT = `A comic book page with four rectangular panels in a 2x2 grid,
separated by clean white gutters. Panel 1: a woman in a yellow raincoat stands at a
bus stop in heavy rain, with a speech balloon reading "It's late again." Panel 2:
close-up of a wet timetable, with a caption box reading "7:42". Panel 3: a red bus
arrives, a large sound effect reading "SKRRRT". Panel 4: the woman boards the bus,
with a speech balloon reading "Finally." Bold ink lines, flat colour, printed comic look.`;

async function main() {
  mkdirSync(OUT, { recursive: true });

  // ── Spike 1: text-to-image (fal has no Muse text-to-image endpoint) ──
  console.log("1. Muse Image text-to-image...");
  let t = Date.now();
  const [b64] = await generateImage({ prompt: PAGE_PROMPT, size: "1024x1536" });
  const bytes = Buffer.from(b64, "base64");
  writeFileSync(`${OUT}/page.webp`, bytes);
  console.log(`   drew a page in ${since(t)}, ${(bytes.length / 1024).toFixed(0)}kB -> ${OUT}/page.webp\n`);

  const dataUrl = `data:image/webp;base64,${b64}`;

  // ── Spike 2: SAM 3.1, one noun phrase per call ──
  for (const concept of ["comic panel", "speech balloon", "sound effect text"]) {
    t = Date.now();
    const result = await segment({ image: dataUrl, concept, confidence: true });
    const boxes = boxesOf(result);
    const masks = masksOf(result);
    console.log(`2. "${concept}": ${boxes.length} boxes, ${masks.length} masks in ${since(t)}`);

    for (const b of boxes.slice(0, 8)) {
      const c = b.confidence === undefined ? "" : ` c=${b.confidence.toFixed(2)}`;
      console.log(`     #${b.objectId} [${b.left},${b.top} -> ${b.right},${b.bottom}]${c}`);
    }
    if (masks.length) {
      const m = masks[0];
      const raster = decodeMaskToRaster(m.mask);
      const path = decodeMaskToSVGPath(m.mask);
      const on = raster.reduce((n, v) => n + v, 0);
      const pct = ((on / raster.length) * 100).toFixed(1);
      console.log(`     mask[0] ${m.mask.encoding} ${m.mask.width}x${m.mask.height}, ${on}px set (${pct}%), svg path ${path.length} chars`);
      console.log(`     bounds [${m.bounds.left},${m.bounds.top} -> ${m.bounds.right},${m.bounds.bottom}]`);
    }
    for (const d of result.diagnostics) console.log(`     ! ${d.severity} ${d.code}: ${d.message}`);
    console.log(`     outcome: ${result.outcome.status}`);
    writeFileSync(`${OUT}/${concept.replace(/\W+/g, "-")}.json`, JSON.stringify({ boxes, diagnostics: result.diagnostics }, null, 2));
    console.log();
  }
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
