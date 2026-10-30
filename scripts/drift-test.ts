// Does anchoring on page 1 keep a long comic's cast, or does another reference
// image cost more than it buys? Draws the same three-page comic both ways.
import { mkdirSync, writeFileSync } from "node:fs";
import { STYLES, type PagePlan, drawPlan, planNextPage, planStory } from "../src/lib/compose";

const BEATS = [
  "the landlord recognises him in the mirror and demands the rent",
  "the keke breaks down in the middle of the road and they both get out to push",
];

async function chain(label: string, anchorOnFirst: boolean, bible: Awaited<ReturnType<typeof planStory>>["bible"], first: PagePlan, firstImage: string) {
  const pages = [firstImage];
  const plans = [first];
  for (const [i, beat] of BEATS.entries()) {
    const plan = await planNextPage(bible, plans, beat, 3);
    const images = anchorOnFirst && i > 0 ? [pages[0], pages[pages.length - 1]] : [pages[pages.length - 1]];
    const t = Date.now();
    const image = await drawPlan(plan, STYLES.classic, { images, cast: bible.cast.map((c) => c.look) });
    console.log(`  ${label} page ${i + 2}: ${images.length} ref(s), ${((Date.now() - t) / 1000).toFixed(1)}s`);
    writeFileSync(`.spike/drift-${label}-p${i + 2}.webp`, Buffer.from(image.split(",")[1], "base64"));
    pages.push(image);
    plans.push(plan);
  }
}

async function main() {
  mkdirSync(".spike", { recursive: true });
  const { bible, plan } = await planStory("a keke napep driver in Aba picks up a passenger who turns out to be his landlord", 3);
  console.log(`"${bible.title}" -`, bible.cast.map((c) => c.look).join(" / "));
  const firstImage = await drawPlan(plan, STYLES.classic);
  writeFileSync(".spike/drift-p1.webp", Buffer.from(firstImage.split(",")[1], "base64"));
  console.log("  page 1 drawn (shared by both chains)");
  await chain("prev", false, bible, plan, firstImage);
  await chain("anchored", true, bible, plan, firstImage);
}
main();
