// Does a cast sheet hold a comic's people better than chaining page to page?
import { mkdirSync, writeFileSync } from "node:fs";
import { STYLES, drawCastSheet, drawPlan, planNextPage, planStory, readCast } from "../src/lib/compose";

const save = (name: string, data: string) =>
  writeFileSync(`.spike/${name}.webp`, Buffer.from(data.split(",")[1], "base64"));

async function main() {
  mkdirSync(".spike", { recursive: true });
  const { bible, plan } = await planStory(
    "a keke napep driver in Aba picks up a passenger who turns out to be his landlord",
    4,
  );
  console.log(`"${bible.title}"`);
  for (const c of bible.cast) console.log(`  planned  ${c.who}: ${c.look}`);

  let t = Date.now();
  const sheet = await drawCastSheet(bible, STYLES.classic);
  save("cast-sheet", sheet);
  console.log(`\nsheet drawn in ${((Date.now() - t) / 1000).toFixed(1)}s`);

  t = Date.now();
  const cast = await readCast(sheet, bible);
  console.log(`read back in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  for (const c of cast) console.log(`  as drawn  ${c.who}: ${c.look}`);

  const anchored = { ...bible, cast, sheet };
  t = Date.now();
  const p1 = await drawPlan(plan, STYLES.classic, { images: [sheet], cast: cast.map((c) => c.look) });
  save("cast-p1", p1.image);
  console.log(`\npage 1 in ${((Date.now() - t) / 1000).toFixed(1)}s`);

  const beat = "the landlord recognises him in the mirror and demands the rent";
  const next = await planNextPage(anchored, [plan], beat, 4);
  t = Date.now();
  const p2 = await drawPlan(next, STYLES.classic, { images: [sheet, p1.image], cast: cast.map((c) => c.look) });
  save("cast-p2", p2.image);
  console.log(`page 2 in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
main();
