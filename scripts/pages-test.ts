// Three pages of one comic, drawn the way the app draws them: do the layouts
// vary, and do the people survive?
import { mkdirSync, writeFileSync } from "node:fs";
import { STYLES, type PagePlan, drawPlan, planNextPage, planStory } from "../src/lib/compose";

const BEATS = [
  "the landlord recognises him in the mirror and demands the rent",
  "the keke breaks down and they both get out to push it through the traffic",
];

async function main() {
  mkdirSync(".spike", { recursive: true });
  const { bible, plan } = await planStory(
    "a keke napep driver in Aba picks up a passenger who turns out to be his landlord",
    4,
  );
  console.log(`"${bible.title}"`);
  for (const c of bible.cast) console.log(`  ${c.who}: ${c.look}`);

  const pages: string[] = [];
  const plans: PagePlan[] = [];
  for (let i = 0; i < BEATS.length + 1; i++) {
    const p = i === 0 ? plan : await planNextPage(bible, plans, BEATS[i - 1], 4);
    console.log(`\npage ${i + 1} layout: ${p.layout ?? "(none given)"}`);
    console.log(`  sizes: ${p.panels.map((x) => x.size ?? "-").join(", ")}`);
    const refs = i === 0 ? undefined : { images: [...new Set([pages[0], pages[pages.length - 1]])], cast: bible.cast.map((c) => c.look) };
    const image = await drawPlan(p, STYLES.classic, refs);
    writeFileSync(`.spike/pg-${i + 1}.webp`, Buffer.from(image.split(",")[1], "base64"));
    pages.push(image);
    plans.push(p);
  }
}
main();
